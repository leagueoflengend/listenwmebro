const socket = io();
const statusText = document.getElementById('statusText');
const playlistUI = document.getElementById('playlistUI');
const youtubeLinkInput = document.getElementById('youtubeLink');
const searchResultsBox = document.getElementById('searchResultsBox');
const userCountElem = document.getElementById('userCount');
const userListElem = document.getElementById('userList');

let player; 
let isSyncing = false; 
let currentVideoId = ''; 

// 1. KHỞI TẠO YOUTUBE PLAYER
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '360',
        width: '640',
        videoId: 'y881t8SK8tE', 
        playerVars: { 'playsinline': 1, 'autoplay': 1, 'controls': 1 },
        events: {
            'onReady': () => statusText.innerText = "Sẵn sàng!",
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    if (isSyncing) return;
    if (event.data == YT.PlayerState.PLAYING) {
        socket.emit('play', player.getCurrentTime());
    } else if (event.data == YT.PlayerState.PAUSED) {
        socket.emit('pause', player.getCurrentTime());
    } else if (event.data == YT.PlayerState.ENDED) {
        socket.emit('skipVideo');
    }
}

// 2. GIAO DIỆN (THEME & SEARCH)

// Đổi Dark/Light Mode
function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('theme-icon');
    body.classList.toggle('dark-theme');
    
    if (body.classList.contains('dark-theme')) {
        icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    } else {
        icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    }
}

// Kiểm tra theme đã lưu
(function() {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        if(document.getElementById('theme-icon')) document.getElementById('theme-icon').className = 'fas fa-sun';
    }
})();

// Tắt tìm kiếm khi click ra ngoài
window.addEventListener('click', function(e) {
    if (searchResultsBox.style.display === 'block' && !searchResultsBox.contains(e.target) && e.target !== youtubeLinkInput) {
        closeSearch();
    }
});

function closeSearch() {
    searchResultsBox.style.display = 'none';
    youtubeLinkInput.value = '';
}

// 3. LOGIC PHÒNG & NGƯỜI DÙNG

function joinRoom() {
    const nameInput = document.getElementById('joinNameInput');
    const name = nameInput.value.trim();
    if (!name) return alert("Vui lòng nhập tên để mọi người biết bạn là ai nè!");
    
    socket.emit('join', name);
    document.getElementById('nickname').value = name; // Đồng bộ sang ô chat
    document.getElementById('joinModal').style.display = 'none';
}

socket.on('updateUserList', (names) => {
    userCountElem.innerText = names.length;
    userListElem.innerHTML = names.map(n => 
        `<span style="background:var(--accent-color); color:#fff; padding:2px 8px; border-radius:10px; font-size:0.8em; margin-right:5px;">${n}</span>`
    ).join('');
});

// 4. ĐỒNG BỘ NHẠC (SOCKET LISTENERS)

socket.on('initRoom', (state) => {
    isSyncing = true;
    currentVideoId = state.videoId;
    const checkReady = setInterval(() => {
        if (player && player.loadVideoById) {
            clearInterval(checkReady);
            state.isPlaying ? player.loadVideoById(state.videoId, state.time) : player.cueVideoById(state.videoId, state.time);
            setTimeout(() => isSyncing = false, 1500);
        }
    }, 500);
});

socket.on('changeVideo', (id) => {
    isSyncing = true;
    currentVideoId = id;
    player.loadVideoById(id);
    statusText.innerText = "Đang chuyển bài...";
    setTimeout(() => isSyncing = false, 2000);
});

socket.on('play', (time) => {
    isSyncing = true;
    if (Math.abs(player.getCurrentTime() - time) > 1.5) player.seekTo(time, true);
    player.playVideo();
    setTimeout(() => isSyncing = false, 1000);
});

socket.on('pause', () => {
    isSyncing = true;
    player.pauseVideo();
    setTimeout(() => isSyncing = false, 1000);
});

// 5. TÌM KIẾM & PLAYLIST

function searchSong() {
    const q = youtubeLinkInput.value.trim();
    if (!q || getValidId()) return;
    
    searchResultsBox.style.display = 'block';
    searchResultsBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; padding:5px 10px; background:var(--playlist-bg); border-radius:5px 5px 0 0; border-bottom:1px solid var(--border-color)">
            <small>KẾT QUẢ TÌM KIẾM</small>
            <span onclick="closeSearch()" style="cursor:pointer; color:#f7768e; font-weight:bold;">[Đóng X]</span>
        </div>
        <div id="searchInner" style="padding:10px; text-align:center;">Đang tìm...</div>
    `;
    socket.emit('searchSong', q);
}

socket.on('searchResults', (results) => {
    const inner = document.getElementById('searchInner');
    if (!inner) return;
    if (results.length === 0) { inner.innerHTML = "Không thấy bài nào phù hợp rồi!"; return; }

    inner.innerHTML = results.map(v => `
        <div class="search-item">
            <img src="${v.thumbnail}">
            <div class="search-info">
                <div class="search-title">${v.title}</div>
                <div style="font-size:0.8em; color:var(--sub-text)"><span>${v.duration}</span> • ${v.author}</div>
                <div class="search-actions" style="margin-top:5px; display:flex; gap:5px">
                    <button onclick="socket.emit('changeVideo','${v.id}');closeSearch()" style="padding:4px 8px; font-size:0.7em;">▶ Phát</button>
                    <button onclick="socket.emit('addToList','${v.id}');closeSearch()" class="btn-secondary" style="padding:4px 8px; font-size:0.7em;">+ Đợi</button>
                </div>
            </div>
        </div>
    `).join('');
});

socket.on('updatePlaylist', (list) => {
    playlistUI.innerHTML = list.map((item, i) => `
        <li class="playlist-item">
            <span class="playlist-item-title">${i+1}. ${item.title}</span>
            <div class="playlist-actions" style="display:flex; gap:5px">
                <button class="btn-up" onclick="socket.emit('moveVideoToTop',${i})" style="padding:2px 5px; font-size:0.7em;">⬆️</button>
                <button class="btn-del" onclick="socket.emit('removeVideo',${i})" style="padding:2px 5px; font-size:0.7em;">❌</button>
            </div>
        </li>`).join('') || '<li>Danh sách đang trống...</li>';
});

// 6. HÀM HỖ TRỢ

function getValidId() {
    const reg = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const m = youtubeLinkInput.value.match(reg); 
    return (m && m[2].length === 11) ? m[2] : null;
}

function playNow() { const id = getValidId(); if(id) socket.emit('changeVideo', id); }
function addToList() { const id = getValidId(); if(id) socket.emit('addToList', id); }
function skipVideo() { socket.emit('skipVideo'); }

function toggleVideoMode() {
    const container = document.getElementById('youtubePlayerContainer');
    const btn = document.getElementById('toggleBtn');
    container.classList.toggle('audio-only-mode');
    if (container.classList.contains('audio-only-mode')) {
        btn.innerText = "📺 Chế độ: Chỉ nghe Nhạc";
        btn.style.backgroundColor = "#9ece6a";
    } else {
        btn.innerText = "🎧 Chế độ: Đang xem Video";
        btn.style.backgroundColor = "#7aa2f7";
    }
}

// 7. CHAT
function sendMessage() {
    const msg = document.getElementById('chatInput').value.trim();
    if(msg) {
        socket.emit('chatMessage', {name: document.getElementById('nickname').value, message: msg});
        document.getElementById('chatInput').value = '';
    }
}
function handleKeyPress(e) { if(e.key === 'Enter') sendMessage(); }

socket.on('chatMessage', (d) => {
    const box = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${d.name}:</strong> ${d.message}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});
