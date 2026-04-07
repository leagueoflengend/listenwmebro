const socket = io();
const statusText = document.getElementById('statusText');
const playlistUI = document.getElementById('playlistUI');
const youtubeLinkInput = document.getElementById('youtubeLink');
const searchResultsBox = document.getElementById('searchResultsBox');

let player, isSyncing = false, userName = '';

// TẢI YOUTUBE PLAYER
var tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '360', width: '640', videoId: 'y881t8SK8tE',
        playerVars: { 'playsinline': 1, 'autoplay': 1, 'controls': 1 },
        events: { 
            'onReady': () => { statusText.innerText = "Sẵn sàng!"; },
            'onStateChange': (e) => {
                if (isSyncing) return;
                if (e.data == YT.PlayerState.PLAYING) socket.emit('play', player.getCurrentTime());
                else if (e.data == YT.PlayerState.PAUSED) socket.emit('pause', player.getCurrentTime());
                else if (e.data == YT.PlayerState.ENDED) socket.emit('skipVideo');
            }
        }
    });
}

function searchSong() {
    const q = youtubeLinkInput.value.trim();
    if (!q || getValidId()) return;

    searchResultsBox.style.display = 'block';
    searchResultsBox.innerHTML = `
        <div style="padding:10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; background:var(--inner);">
            <b>KẾT QUẢ</b><span onclick="closeSearch()" style="cursor:pointer; color:#f7768e;">[Đóng]</span>
        </div>
        <div id="innerS" style="padding:15px; text-align:center;">Đang tìm kiếm...</div>
    `;
    socket.emit('searchSong', q);
}

// HIỂN THỊ KẾT QUẢ TÌM KIẾM
socket.on('searchResults', (res) => {
    const inner = document.getElementById('innerS');
    if (!inner) return;
    if (res.length === 0) { inner.innerHTML = "Không tìm thấy bài nào."; return; }

    inner.innerHTML = res.map(v => `
        <div class="search-item" onclick="socket.emit('addToList','${v.id}');closeSearch();" style="display:flex; gap:10px; padding:10px; border-bottom:1px solid var(--border); cursor:pointer; text-align:left;">
            <img src="${v.thumbnail}" style="width:80px; border-radius:4px;">
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:0.85em; color:var(--accent);">${v.title}</div>
                <div style="font-size:0.75em; color:var(--sub);">${v.duration} • ${v.author}</div>
                <div style="font-size:0.7em; color:#9ece6a; margin-top:4px;">(Click để thêm vào hàng chờ)</div>
            </div>
        </div>`).join('');
});

// HIỂN THỊ LỖI NẾU CÓ
socket.on('searchError', (msg) => {
    const inner = document.getElementById('innerS');
    if (inner) inner.innerHTML = `<b style="color:#f7768e;">LỖI: ${msg}</b>`;
});

function playNow() {
    const id = getValidId();
    if (id) { socket.emit('changeVideo', id); closeSearch(); }
    else alert("Link không hợp lệ!");
}

function closeSearch() { searchResultsBox.style.display = 'none'; youtubeLinkInput.value = ''; }
function getValidId() {
    const url = youtubeLinkInput.value.trim();
    const m = url.match(/^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/);
    return (m && m[1].length === 11) ? m[1] : null;
}

function joinRoom() {
    const input = document.getElementById('joinNameInput');
    if (!input.value.trim()) return alert("Nhập tên!");
    userName = input.value.trim();
    socket.emit('join', userName);
    document.getElementById('joinModal').style.display = 'none';
}

socket.on('updateUserList', (l) => {
    document.getElementById('userCount').innerText = l.length;
    document.getElementById('userList').innerHTML = l.map(n => `<small style="background:var(--accent); color:#fff; padding:2px 6px; border-radius:10px; margin-right:4px;">${n}</small>`).join('');
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
    document.getElementById('playlistUI').innerHTML = list.map((item, i) => `
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
    box.innerHTML += `<div><strong>${d.name}:</strong> ${d.message}</div>`; 
    box.scrollTop = box.scrollHeight; 
});

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    document.getElementById('theme-icon').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function skipVideo() { socket.emit('skipVideo'); }
function sendMessage() {
    const input = document.getElementById('chatInput');
    if (input.value.trim()) { socket.emit('chatMessage', { name: userName, message: input.value }); input.value = ''; }
}

(function() { 
    if (localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark-theme'); document.getElementById('theme-icon').className = 'fas fa-sun'; }
    window.addEventListener('click', (e) => { if(searchResultsBox && !searchResultsBox.contains(e.target) && e.target !== youtubeLinkInput) closeSearch(); });
})();
