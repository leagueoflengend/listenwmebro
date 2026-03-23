const socket = io();
const statusText = document.getElementById('statusText');
const playlistUI = document.getElementById('playlistUI');
let player; 
let isSyncing = false; 

// TẢI YOUTUBE API
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '360',
        width: '640',
        videoId: 'bwB9EMpW8eY', // Stand By You
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

function skipVideo() { socket.emit('skipVideo'); }

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
    if (event.data == YT.PlayerState.PLAYING) socket.emit('play', player.getCurrentTime());
    else if (event.data == YT.PlayerState.PAUSED) socket.emit('pause');
    else if (event.data == YT.PlayerState.ENDED) socket.emit('skipVideo');
}

// Lắng nghe sự kiện từ Server
socket.on('changeVideo', (videoId) => {
    isSyncing = true;
    player.loadVideoById(videoId);
    statusText.innerText = `Trạng thái: Đang phát bài mới.`;
    setTimeout(() => isSyncing = false, 1000); 
});

// ĐÃ SỬA Ở ĐÂY: Hiện Tên thay vì ID
socket.on('updatePlaylist', (playlist) => {
    playlistUI.innerHTML = ''; 
    if (playlist.length === 0) {
        playlistUI.innerHTML = '<li>Danh sách đang trống...</li>'; return;
    }
    playlist.forEach((item, index) => {
        const li = document.createElement('li');
        // In ra tên bài hát (item.title)
        li.innerText = `${index + 1}. 🎵 ${item.title}`;
        playlistUI.appendChild(li);
    });
});

socket.on('play', (time) => {
    isSyncing = true;
    if (Math.abs(player.getCurrentTime() - time) > 0.5) player.seekTo(time, true);
    player.playVideo();
    setTimeout(() => isSyncing = false, 500);
});

socket.on('pause', () => {
    isSyncing = true;
    player.pauseVideo();
    setTimeout(() => isSyncing = false, 500);
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
