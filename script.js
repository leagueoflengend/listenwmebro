const socket = io();
const statusText = document.getElementById('statusText');
const playlistUI = document.getElementById('playlistUI');
const youtubeLinkInput = document.getElementById('youtubeLink');
const searchResultsBox = document.getElementById('searchResultsBox');
const userCountElem = document.getElementById('userCount');
const userListElem = document.getElementById('userList');

let player, isSyncing = false, userName = '';

// YOUTUBE API
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

// THEME
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    document.getElementById('theme-icon').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// JOIN
function joinRoom() {
    const input = document.getElementById('joinNameInput');
    if (!input.value.trim()) return alert("Nhập tên bạn nhé!");
    userName = input.value.trim();
    socket.emit('join', userName);
    document.getElementById('joinModal').style.display = 'none';
}

// SOCKET LISTENERS
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

socket.on('updateUserList', (list) => {
    if(userCountElem) userCountElem.innerText = list.length;
    if(userListElem) userListElem.innerHTML = list.map(n => `<small style="background:var(--accent); color:#fff; padding:2px 6px; border-radius:10px; margin-right:4px;">${n}</small>`).join('');
});

socket.on('changeVideo', (id) => { isSyncing = true; player.loadVideoById(id); setTimeout(() => isSyncing = false, 2000); });
socket.on('play', (t) => { isSyncing = true; if(Math.abs(player.getCurrentTime()-t)>1.5) player.seekTo(t,true); player.playVideo(); setTimeout(()=>isSyncing=false,1000); });
socket.on('pause', () => { isSyncing = true; player.pauseVideo(); setTimeout(()=>isSyncing=false,1000); });

socket.on('chatMessage', (d) => {
    const box = document.getElementById('chatMessages');
    if(box) { box.innerHTML += `<div><strong>${d.name}:</strong> ${d.message}</div>`; box.scrollTop = box.scrollHeight; }
});

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

// SEARCH
function searchSong() {
    const q = youtubeLinkInput.value.trim(); if (!q) return;
    searchResultsBox.style.display = 'block';
    searchResultsBox.innerHTML = `<div style="padding:10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;">
        <small>KẾT QUẢ</small><span onclick="closeSearch()" style="cursor:pointer; color:#f7768e;">[Đóng]</span>
    </div><div id="innerS" style="padding:10px; text-align:center;">Đang tìm...</div>`;
    socket.emit('searchSong', q);
}

socket.on('searchResults', (res) => {
    const inner = document.getElementById('innerS'); if (!inner) return;
    inner.innerHTML = res.map(v => `
        <div class="search-item">
            <img src="${v.thumbnail}">
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:0.85em; color:var(--accent);">${v.title}</div>
                <div style="font-size:0.75em; color:var(--sub);">${v.duration} • ${v.author}</div>
                <div style="margin-top:5px; display:flex; gap:5px;">
                    <button onclick="socket.emit('changeVideo','${v.id}');closeSearch()" style="padding:3px 8px; font-size:0.7em;">▶ Phát</button>
                    <button onclick="socket.emit('addToList','${v.id}');closeSearch()" style="padding:3px 8px; font-size:0.7em; background:#bb9af7;">+ Đợi</button>
                </div>
            </div>
        </div>`).join('') || "Không thấy bài nào!";
});

function closeSearch() { searchResultsBox.style.display = 'none'; youtubeLinkInput.value = ''; }
function sendMessage() {
    const input = document.getElementById('chatInput');
    if (input.value.trim()) { socket.emit('chatMessage', { name: userName || "Khách", message: input.value }); input.value = ''; }
}
function skipVideo() { socket.emit('skipVideo'); }
function toggleVideoMode() {
    const c = document.getElementById('youtubePlayerContainer');
    c.classList.toggle('audio-only-mode');
    document.getElementById('toggleBtn').innerText = c.classList.contains('audio-only-mode') ? "📺 Chế độ: Nhạc" : "🎧 Chế độ: Video";
}

// Khởi tạo theme & Click ngoài
(function() { 
    if (localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark-theme'); document.getElementById('theme-icon').className = 'fas fa-sun'; }
    window.addEventListener('click', (e) => { if(searchResultsBox && !searchResultsBox.contains(e.target) && e.target !== youtubeLinkInput) closeSearch(); });
})();
