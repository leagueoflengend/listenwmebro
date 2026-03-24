const socket = io();
const statusText = document.getElementById('statusText');
const playlistUI = document.getElementById('playlistUI');
let player; 
let isSyncing = false; 
let syncTimeout; 
let currentVideoId = ''; 
let initialRoomState = null; 

var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '360',
        width: '640',
        videoId: 'y881t8SK8tE', 
        playerVars: { 'playsinline': 1, 'autoplay': 0, 'controls': 1 },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    if (initialRoomState) {
        applyRoomState(initialRoomState);
    } else {
        statusText.innerText = "Trạng thái: Sẵn sàng.";
    }
}

function applyRoomState(state) {
    isSyncing = true;
    clearTimeout(syncTimeout);
    
    currentVideoId = state.videoId;
    
    if (state.isPlaying) {
        player.loadVideoById(state.videoId, state.time);
        statusText.innerText = "Trạng thái: Đã đồng bộ vào phòng trực tiếp.";
    } else {
        player.cueVideoById(state.videoId, state.time);
        statusText.innerText = "Trạng thái: Đồng bộ phòng (Đang tạm dừng).";
    }
    syncTimeout = setTimeout(() => isSyncing = false, 1500);
}

socket.on('initRoom', (state) => {
    initialRoomState = state;
    if (player && player.loadVideoById) {
        applyRoomState(state);
    }
});

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

function onPlayerStateChange(event) {
    if (isSyncing) return; 
    if (event.data == YT.PlayerState.PLAYING) {
        socket.emit('play', player.getCurrentTime());
    } else if (event.data == YT.PlayerState.PAUSED) {
        socket.emit('pause', player.getCurrentTime());
    } else if (event.data == YT.PlayerState.ENDED) {
        skipVideo(); 
    }
}

socket.on('changeVideo', (videoId) => {
    if (currentVideoId === videoId) return; 
    currentVideoId = videoId;

    isSyncing = true;
    clearTimeout(syncTimeout);
    
    player.loadVideoById(videoId);
    statusText.innerText = `Trạng thái: Đang tải bài mới...`;
    
    syncTimeout = setTimeout(() => {
        isSyncing = false;
        statusText.innerText = `Trạng thái: Đang phát.`;
    }, 2500); 
});

// ==========================================
// ĐÃ SỬA: Tích hợp Nút bấm vào Danh sách phát
// ==========================================
socket.on('updatePlaylist', (playlist) => {
    playlistUI.innerHTML = ''; 
    if (playlist.length === 0) {
        playlistUI.innerHTML = '<li style="padding: 10px;">Danh sách đang trống...</li>'; return;
    }
    playlist.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'playlist-item';
        
        // Tên bài hát
        const titleSpan = document.createElement('span');
        titleSpan.className = 'playlist-item-title';
        titleSpan.innerText = `${index + 1}. 🎵 ${item.title}`;
        
        // Cụm chứa 2 nút bấm
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'playlist-actions';
        
        // Chỉ hiện nút "Ưu tiên" nếu không phải bài đầu tiên
        if (index > 0) {
            const upBtn = document.createElement('button');
            upBtn.className = 'btn-up';
            upBtn.innerText = '⬆️ Ưu tiên';
            upBtn.onclick = () => socket.emit('moveVideoToTop', index); // Bấm phát là đẩy số index lên server
            actionsDiv.appendChild(upBtn);
        }
        
        // Nút Xóa (bài nào cũng có)
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-del';
        delBtn.innerText = '❌ Xóa';
        delBtn.onclick = () => socket.emit('removeVideo', index);
        actionsDiv.appendChild(delBtn);
        
        li.appendChild(titleSpan);
        li.appendChild(actionsDiv);
        playlistUI.appendChild(li);
    });
});
// ==========================================

socket.on('play', (time) => {
    isSyncing = true;
    clearTimeout(syncTimeout);
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
