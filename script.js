const socket = io();
const statusText = document.getElementById('statusText');
const playlistUI = document.getElementById('playlistUI');
const youtubeLinkInput = document.getElementById('youtubeLink');
const searchResultsBox = document.getElementById('searchResultsBox');
const userCountElem = document.getElementById('userCount');
const userListElem = document.getElementById('userList');

let player, isSyncing = false, userName = '';

var tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '360', width: '640', videoId: 'y881t8SK8tE',
        playerVars: { 'playsinline': 1, 'autoplay': 1, 'controls': 1 },
        events: { 
            'onReady': () => { if(statusText) statusText.innerText = "Sẵn sàng!"; },
            'onStateChange': (e) => {
                if (isSyncing) return;
                if (e.data == YT.PlayerState.PLAYING) socket.emit('play', player.getCurrentTime());
                else if (e.data == YT.PlayerState.PAUSED) socket.emit('pause', player.getCurrentTime());
                else if (e.data == YT.PlayerState.ENDED) socket.emit('skipVideo');
            }
        }
    });
}

// LOGIC TÌM KIẾM - ĐÃ SỬA ĐỂ HIỆN KẾT QUẢ
function searchSong() {
    const q = youtubeLinkInput.value.trim();
    if (!q) return alert("Nhập tên bài hát!");
    // Nếu là link thì không cho tìm, bắt bấm Phát Link
    if (getValidId()) return alert("Đây là link, hãy bấm nút 'Phát Link'!");

    searchResultsBox.style.display = 'block';
    searchResultsBox.innerHTML = `<div style="padding:10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; background:var(--inner);">
        <small>KẾT QUẢ TÌM KIẾM</small><span onclick="closeSearch()" style="cursor:pointer; color:#f7768e; font-weight:bold;">[Đóng X]</span>
    </div><div id="innerS" style="padding:10px; text-align:center;">Đang tìm...</div>`;
    
    socket.emit('searchSong', q);
}

socket.on('searchResults', (res) => {
    const inner = document.getElementById('innerS');
    if (!inner) return;
    if (res.length === 0) {
        inner.innerHTML = "Không tìm thấy bài nào. Kiểm tra API Key trên Render!";
        return;
    }

    inner.innerHTML = res.map(v => `
        <div class="search-item" onclick="addToQueue('${v.id}')" style="display:flex; gap:10px; padding:10px; border-bottom:1px solid var(--border); cursor:pointer;">
            <img src="${v.thumbnail}" style="width:80px; border-radius:4px;">
            <div style="flex:1; text-align:left;">
                <div style="font-weight:bold; font-size:0.85em; color:var(--accent);">${v.title}</div>
                <div style="font-size:0.75em; color:var(--sub);">${v.duration} • ${v.author}</div>
                <div style="font-size:0.7em; color:#9ece6a; margin-top:4px;">[Bấm để thêm vào hàng chờ]</div>
            </div>
        </div>`).join('');
});

// HÀM CHỈ THÊM VÀO HÀNG CHỜ
function addToQueue(id) {
    socket.emit('addToList', id);
    closeSearch();
}

// HÀM PHÁT NGAY LẬP TỨC (DÀNH CHO DÁN LINK)
function playNow() {
    const id = getValidId();
    if (id) {
        socket.emit('changeVideo', id);
        closeSearch();
    } else {
        alert("Link YouTube không hợp lệ!");
    }
}

// CÁC HÀM KHÁC GIỮ NGUYÊN
function closeSearch() { searchResultsBox.style.display = 'none'; youtubeLinkInput.value = ''; }
function getValidId() {
    const url = youtubeLinkInput.value.trim();
    const reg = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const m = url.match(reg);
    return (m && m[1].length === 11) ? m[1] : null;
}

function skipVideo() { socket.emit('skipVideo'); }
function sendMessage() {
    const input = document.getElementById('chatInput');
    if (input.value.trim()) { socket.emit('chatMessage', { name: userName || "Khách", message: input.value }); input.value = ''; }
}

function joinRoom() {
    const input = document.getElementById('joinNameInput');
    if (!input.value.trim()) return alert("Nhập tên!");
    userName = input.value.trim();
    socket.emit('join', userName);
    document.getElementById('joinModal').style.display = 'none';
}

socket.on('updateUserList', (list) => {
    if(userCountElem) userCountElem.innerText = list.length;
    if(userListElem) userListElem.innerHTML = list.map(n => `<small style="background:var(--accent); color:#fff; padding:2px 6px; border-radius:10px; margin-right:4px;">${n}</small>`).join('');
});

socket.on('initRoom', (s) => {
    isSyncing = true;
    const check = setInterval(() => {
        if (player && player.loadVideoById) {
            clearInterval(check);
            s.isPlaying ? player.loadVideoById(s.videoId, s.time) : player.cueVideoById(s.videoId, s.time);
            setTimeout(() => isSyncing = false, 1500);
        }
    }, 500);
});

socket.on('changeVideo', (id) => { isSyncing = true; player.loadVideoById(id); setTimeout(() => isSyncing = false, 2000); });
socket.on('play', (t) => { isSyncing = true; if(Math.abs(player.getCurrentTime()-t)>1.5) player.seekTo(t,true); player.playVideo(); setTimeout(()=>isSyncing=false,1000); });
socket.on('pause', () => { isSyncing = true; player.pauseVideo(); setTimeout(()=>isSyncing=false,1000); });

socket.on('updatePlaylist', (list) => {
    if(!playlistUI) return;
    playlistUI.innerHTML = list.map((item, i) => `
        <li style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid var(--border); font-size:0.85em;">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${i+1}. ${item.title}</span>
            <div style="display:flex; gap:5px;">
                <button onclick="socket.emit('moveVideoToTop',${i})" style="padding:2px 5px; font-size:0.7em;">⬆️</button>
                <button onclick="socket.emit('removeVideo',${i})" style="padding:2px 5px; font-size:0.7em; background:#f7768e;">❌</button>
            </div>
        </li>`).join('') || '<li style="font-size:0.8em; color:var(--sub);">Trống...</li>';
});

socket.on('chatMessage', (d) => {
    const box = document.getElementById('chatMessages');
    if(box) { box.innerHTML += `<div><strong>${d.name}:</strong> ${d.message}</div>`; box.scrollTop = box.scrollHeight; }
});

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    document.getElementById('theme-icon').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

(function() { 
    if (localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark-theme'); document.getElementById('theme-icon').className = 'fas fa-sun'; }
    window.addEventListener('click', (e) => { if(searchResultsBox && !searchResultsBox.contains(e.target) && e.target !== youtubeLinkInput) closeSearch(); });
})();
