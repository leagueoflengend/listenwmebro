const socket = io();
const statusText = document.getElementById('statusText');
const playlistUI = document.getElementById('playlistUI');
let player; 
let isSyncing = false; 
let syncTimeout; // Quản lý độ trễ chống loạn nhịp
let currentVideoId = ''; // Nhớ bài đang phát để chống load đúp

// TẢI YOUTUBE API
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '360',
        width: '640',
        videoId: 'bwB9EMpW8eY', 
        playerVars: { 'playsinline': 1, 'autoplay': 0, 'controls': 1 },
        events: {
            'onReady': () => { statusText.innerText = "Trạng thái: Sẵn sàng."; },
            'onStateChange': onPlayerStateChange
        }
    });
}

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

// Tuyệt chiêu 1: Khóa nút Skip chống spam click
let isSkipping = false;
function skipVideo() { 
    if (isSkipping) return; 
    isSkipping = true;
    socket.emit('skipVideo'); 
    statusText.innerText = "Trạng thái: Đang chuyển bài...";
    setTimeout(() => isSkipping = false, 2000); // Khóa 2 giây
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

function onPlayerStateChange(event) {
    if (isSyncing) return; 
    
    // Chỉ bắt sự kiện khi thực sự Phát/Dừng, bỏ qua lúc đang xoay vòng tròn (Buffering)
    if (event.data == YT.PlayerState.PLAYING) {
        socket.emit('play', player.getCurrentTime());
    } else if (event.data == YT.PlayerState.PAUSED) {
        socket.emit('pause');
    } else if (event.data == YT.PlayerState.ENDED) {
        skipVideo(); // Dùng hàm skip có chống spam
    }
}

// ==========================================
// ĐỒNG BỘ MƯỢT MÀ TỪ SERVER
// ==========================================

socket.on('changeVideo', (videoId) => {
    // Tuyệt chiêu 2: Bỏ qua nếu trùng bài hiện tại
    if (currentVideoId === videoId) return; 
    currentVideoId = videoId;

    isSyncing = true;
    clearTimeout(syncTimeout);
    
    player.loadVideoById(videoId);
    statusText.innerText = `Trạng thái: Đang tải bài mới...`;
    
    // Tuyệt chiêu 3: Cho 2.5s để mạng ổn định tải video
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
    // Độ dung sai 1 giây: Lệch ít thì kệ cho mượt, lệch nhiều mới tua
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
    const finalName = nicknameInput === "" ? "ai đó ( nhập tên vào đây)" : nicknameInput;

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
