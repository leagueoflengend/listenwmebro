const socket = io();
const statusText = document.getElementById('statusText');
const playlistUI = document.getElementById('playlistUI');
const youtubeLinkInput = document.getElementById('youtubeLink');
const searchResultsBox = document.getElementById('searchResultsBox');
const userCountElem = document.getElementById('userCount');

let player; 
let isSyncing = false; 
let currentVideoId = ''; 
let syncTimeout;

// 1. KHỞI TẠO YOUTUBE PLAYER
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '360',
        width: '640',
        videoId: 'y881t8SK8tE', 
        playerVars: { 'playsinline': 1, 'autoplay': 1, 'controls': 1 },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    statusText.innerText = "Trạng thái: Sẵn sàng.";
}

// 2. ĐỒNG BỘ TỪ SERVER (LISTENERS)

// Cập nhật số người online
socket.on('updateUserCount', (count) => {
    if (userCountElem) userCountElem.innerText = count;
});

// Khởi tạo phòng khi mới vào
socket.on('initRoom', (state) => {
    isSyncing = true;
    currentVideoId = state.videoId;
    
    // Đợi player sẵn sàng mới load
    const checkReady = setInterval(() => {
        if (player && player.loadVideoById) {
            clearInterval(checkReady);
            if (state.isPlaying) {
                player.loadVideoById(state.videoId, state.time);
            } else {
                player.cueVideoById(state.videoId, state.time);
            }
            setTimeout(() => isSyncing = false, 1500);
        }
    }, 500);
});

socket.on('changeVideo', (videoId) => {
    if (currentVideoId === videoId) return;
    currentVideoId = videoId;
    isSyncing = true;
    player.loadVideoById(videoId);
    statusText.innerText = "Trạng thái: Đang chuyển bài mới...";
    setTimeout(() => isSyncing = false, 2000);
});

socket.on('play', (time) => {
    isSyncing = true;
    if (Math.abs(player.getCurrentTime() - time) > 1.5) {
        player.seekTo(time, true);
    }
    player.playVideo();
    statusText.innerText = "Trạng thái: Đang phát.";
    setTimeout(() => isSyncing = false, 1000);
});

socket.on('pause', () => {
    isSyncing = true;
    player.pauseVideo();
    statusText.innerText = "Trạng thái: Tạm dừng.";
    setTimeout(() => isSyncing = false, 1000);
});

// 3. XỬ LÝ SỰ KIỆN TRÌNH PHÁT (EMITS)
function onPlayerStateChange(event) {
    if (isSyncing) return; // Không gửi lệnh lên server nếu đang được đồng bộ xuống

    if (event.data == YT.PlayerState.PLAYING) {
        socket.emit('play', player.getCurrentTime());
    } else if (event.data == YT.PlayerState.PAUSED) {
        socket.emit('pause', player.getCurrentTime());
    } else if (event.data == YT.PlayerState.ENDED) {
        socket.emit('skipVideo'); // Hết bài tự chuyển
    }
}

// 4. TÌM KIẾM NHẠC (GOOGLE API)
function searchSong() {
    const query = youtubeLinkInput.value.trim();
    if (!query) return;

    // Nếu là link thì không tìm kiếm, nhắc người dùng dùng nút Phát Link
    if (getValidId()) {
        return alert("Đây là link YouTube, hãy dùng nút 'Phát Link' hoặc '+ Hàng Đợi'!");
    }

    searchResultsBox.style.display = 'block';
    searchResultsBox.innerHTML = '<div style="padding:20px; text-align:center;">Đang tìm kiếm...</div>';
    socket.emit('searchSong', query);
}

socket.on('searchResults', (results) => {
    searchResultsBox.innerHTML = '';
    if (results.length === 0) {
        searchResultsBox.innerHTML = '<div style="padding:15px;">Không tìm thấy bài nào!</div>';
        return;
    }

    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-item';
        div.innerHTML = `
            <img src="${item.thumbnail}" alt="thumb">
            <div class="search-info">
                <div class="search-title">${item.title}</div>
                <div class="search-meta"><span>${item.duration}</span> • ${item.author}</div>
                <div class="search-actions">
                    <button onclick="playFromSearch('${item.id}')">▶ Phát Ngay</button>
                    <button class="btn-secondary" onclick="addFromSearch('${item.id}')">+ Hàng Đợi</button>
                </div>
            </div>
        `;
        searchResultsBox.appendChild(div);
    });
});

function playFromSearch(id) {
    socket.emit('changeVideo', id);
    closeSearch();
}

function addFromSearch(id) {
    socket.emit('addToList', id);
    statusText.innerText = "Trạng thái: Đã thêm vào hàng đợi.";
    closeSearch();
}

function closeSearch() {
    searchResultsBox.style.display = 'none';
    youtubeLinkInput.value = '';
}

// 5. QUẢN LÝ PLAYLIST
socket.on('updatePlaylist', (playlist) => {
    playlistUI.innerHTML = '';
    if (playlist.length === 0) {
        playlistUI.innerHTML = '<li>Danh sách đang trống...</li>';
        return;
    }
    playlist.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'playlist-item';
        li.innerHTML = `
            <span class="playlist-item-title">${index + 1}. 🎵 ${item.title}</span>
            <div class="playlist-actions">
                ${index > 0 ? `<button class="btn-up" onclick="socket.emit('moveVideoToTop', ${index})">⬆️ Ưu tiên</button>` : ''}
                <button class="btn-del" onclick="socket.emit('removeVideo', ${index})">❌ Xóa</button>
            </div>
        `;
        playlistUI.appendChild(li);
    });
});

// 6. CÁC HÀM HỖ TRỢ KHÁC
function getValidId() {
    const input = youtubeLinkInput.value;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = input.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function playNow() {
    const id = getValidId();
    if (id) { socket.emit('changeVideo', id); youtubeLinkInput.value = ''; }
}

function addToList() {
    const id = getValidId();
    if (id) { socket.emit('addToList', id); youtubeLinkInput.value = ''; }
}

function skipVideo() {
    socket.emit('skipVideo');
}

function toggleVideoMode() {
    const container = document.getElementById('youtubePlayerContainer');
    const btn = document.getElementById('toggleBtn');
    if (container.classList.contains('audio-only-mode')) {
        container.classList.remove('audio-only-mode');
        btn.innerText = "🎧 Chế độ: Đang xem Video";
        btn.style.backgroundColor = "#7aa2f7";
    } else {
        container.classList.add('audio-only-mode');
        btn.innerText = "📺 Chế độ: Chỉ nghe Nhạc";
        btn.style.backgroundColor = "#9ece6a";
    }
}

// 7. CHATBOX
function sendMessage() {
    const name = document.getElementById('nickname').value || "Khách";
    const input = document.getElementById('chatInput');
    if (input.value.trim()) {
        socket.emit('chatMessage', { name, message: input.value });
        input.value = '';
    }
}

function handleKeyPress(e) { if (e.key === 'Enter') sendMessage(); }

socket.on('chatMessage', (data) => {
    const chat = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${data.name}:</strong> ${data.message}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
});
