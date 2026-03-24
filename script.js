const socket = io();
const statusText = document.getElementById('statusText');
const playlistUI = document.getElementById('playlistUI');
let player; 
let isSyncing = false; 
let syncTimeout; 
let currentVideoId = ''; // Biến quan trọng để theo dõi bài đang phát
let initialRoomState = null; // Biến lưu dữ liệu phòng lúc vừa vào

// TẢI YOUTUBE API
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '360',
        width: '640',
        
        // ==========================================
        // Dùng Video mặc định là "Khung Trống/Đen" lúc khởi tạo
        // (y881t8SK8tE - Không tiếng, không hình)
        videoId: 'y881t8SK8tE', 
        // ==========================================

        playerVars: { 'playsinline': 1, 'autoplay': 0, 'controls': 1 },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    // Nếu máy chủ đã gửi thông tin phòng, áp dụng ngay lập tức
    if (initialRoomState) {
        applyRoomState(initialRoomState);
    } else {
        statusText.innerText = "Trạng thái: Sẵn sàng.";
    }
}

// Hàm Xử Lý Gói Dữ Liệu Máy Chủ Gửi Lúc Mới Vào
function applyRoomState(state) {
    isSyncing = true;
    clearTimeout(syncTimeout);
    
    // Cập nhật currentVideoId NGAY LẬP TỨC 
    currentVideoId = state.videoId;
    
    if (state.isPlaying) {
        // Nếu phòng đang phát -> Load và Phát luôn ở giây hiện tại
        player.loadVideoById(state.videoId, state.time);
        statusText.innerText = "Trạng thái: Đã đồng bộ vào phòng trực tiếp.";
    } else {
        // Nếu phòng đang dừng -> Chỉ load sẵn video ở giây hiện tại (cueVideo)
        player.cueVideoById(state.videoId, state.time);
        statusText.innerText = "Trạng thái: Đồng bộ phòng (Đang tạm dừng).";
    }
    
    // Khóa đồng bộ 1.5 giây để video load ổn định
    syncTimeout = setTimeout(() => isSyncing = false, 1500);
}

// Lắng nghe dữ liệu phòng lúc vừa Load Web
socket.on('initRoom', (state) => {
    initialRoomState = state;
    // Nếu API YouTube tải nhanh hơn Socket, cập nhật luôn
    if (player && player.loadVideoById) {
        applyRoomState(state);
    }
});

// CÁC HÀM NÚT BẤM CƠ BẢN
function getValidId() {
    const linkInput = document.getElementById('youtubeLink').value;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = linkInput.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function playNow() {
    const videoId = getValidId();
    if (videoId) { socket.emit('changeVideo', videoId); document.getElementById('youtubeLink').value = ''; } 
    else alert("Link không hợp lệ!");
}

function addToList() {
    const videoId = getValidId();
    if (videoId) { 
        socket.emit('addToList', videoId); 
        document.getElementById('youtubeLink').value = ''; 
        statusText.innerText = "Trạng thái: Đang tải bài hát vào hàng đợi..."; 
    } 
    else alert("Link không hợp lệ!");
}

let isSkipping = false;
function skipVideo() { 
    if (isSkipping) return; 
    isSkipping = true;
    socket.emit('skipVideo'); 
    statusText.innerText = "Trạng thái: Đang chuyển bài...";
    setTimeout(() => isSkipping = false, 2000); 
}

let isAudioOnly = false;
function toggleVideoMode() {
    const container = document.getElementById('youtubePlayerContainer');
    const btn = document.getElementById('toggleBtn');
    isAudioOnly = !isAudioOnly;
    if (isAudioOnly) {
        container.classList.add('audio-only-mode');
        btn.innerText = "📺 Chế độ: Chỉ nghe Nhạc";
        btn.style.backgroundColor = "#9ece6a";
    } else {
        container.classList.remove('audio-only-mode');
        btn.innerText = "🎧 Chế độ: Đang xem Video";
        btn.style.backgroundColor = "#7aa2f7";
    }
}

// BẮT SỰ KIỆN TỪ NGƯỜI DÙNG
function onPlayerStateChange(event) {
    if (isSyncing) return; 
    
    // Chỉ bắt sự kiện khi thực sự Phát/Dừng, bỏ qua lúc đang load video (Buffering)
    if (event.data == YT.PlayerState.PLAYING) {
        socket.emit('play', player.getCurrentTime());
    } else if (event.data == YT.PlayerState.PAUSED) {
        // Gửi luôn số giây hiện tại lên để server nhớ chính xác lúc pause
        socket.emit('pause', player.getCurrentTime());
    } else if (event.data == YT.PlayerState.ENDED) {
        skipVideo(); 
    }
}

// BẮT SỰ KIỆN TỪ SERVER ĐANG CHẠY
socket.on('changeVideo', (videoId) => {
    if (currentVideoId === videoId) return; 
    currentVideoId = videoId;

    isSyncing = true;
    clearTimeout(syncTimeout);
    
    player.loadVideoById(videoId);
    statusText.innerText = `Trạng thái: Đang tải bài mới...`;
    
    // Tăng thời gian khóa đồng bộ cho video mới ổn định
    syncTimeout = setTimeout(() => {
        isSyncing = false;
        statusText.innerText = `Trạng thái: Đang phát.`;
    }, 2500); 
});

socket.on('updatePlaylist', (playlist) => {
    playlistUI.innerHTML = ''; 
    if (playlist.length === 0) {
        playlistUI.innerHTML = '<li>Danh sách đang trống...</li>'; return;
    }
    playlist.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerText = `${index + 1}. 🎵 ${item.title}`;
        playlistUI.appendChild(li);
    });
});

socket.on('play', (time) => {
    isSyncing = true;
    clearTimeout(syncTimeout);
    // Dung sai 1 giây: Lệch ít kệ cho mượt, lệch nhiều mới tua
    if (Math.abs(player.getCurrentTime() - time) > 1.0) player.seekTo(time, true);
    player.playVideo();
    syncTimeout = setTimeout(() => isSyncing = false, 1500);
});

socket.on('pause', () => {
    isSyncing = true;
    clearTimeout(syncTimeout);
    player.pauseVideo();
    syncTimeout = setTimeout(() => isSyncing = false, 1500);
});

// LOGIC KHUNG CHAT
function sendMessage() {
    const nicknameInput = document.getElementById('nickname').value.trim();
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    const finalName = nicknameInput === "" ? "Khách Ẩn Danh" : nicknameInput;

    if (message !== "") {
        socket.emit('chatMessage', { name: finalName, message: message });
        chatInput.value = ''; 
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter') sendMessage();
}

socket.on('chatMessage', (data) => {
    const chatMessages = document.getElementById('chatMessages');
    const msgElement = document.createElement('div');
    msgElement.classList.add('chat-msg');
    msgElement.innerHTML = `<strong>${data.name}:</strong> ${data.message}`;
    chatMessages.appendChild(msgElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});
