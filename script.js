const socket = io();
const statusText = document.getElementById('statusText');
const playlistUI = document.getElementById('playlistUI');
let player; 
let isSyncing = false; 

// 1. TẢI YOUTUBE API
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

// 2. CÁC HÀM XỬ LÝ NÚT BẤM

function getValidId() {
    const linkInput = document.getElementById('youtubeLink').value;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = linkInput.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function playNow() {
    const videoId = getValidId();
    if (videoId) {
        socket.emit('changeVideo', videoId);
        document.getElementById('youtubeLink').value = ''; 
    } else alert("Link không hợp lệ!");
}

function addToList() {
    const videoId = getValidId();
    if (videoId) {
        socket.emit('addToList', videoId);
        document.getElementById('youtubeLink').value = ''; 
        statusText.innerText = "Trạng thái: Đã thêm vào hàng đợi.";
    } else alert("Link không hợp lệ!");
}

function skipVideo() {
    socket.emit('skipVideo');
}

// Hàm tắt/bật hình ảnh (Chỉ nghe nhạc)
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

// 3. XỬ LÝ SỰ KIỆN TRÌNH PHÁT YOUTUBE
function onPlayerStateChange(event) {
    if (isSyncing) return; 

    if (event.data == YT.PlayerState.PLAYING) {
        socket.emit('play', player.getCurrentTime());
    } else if (event.data == YT.PlayerState.PAUSED) {
        socket.emit('pause');
    } else if (event.data == YT.PlayerState.ENDED) {
        // Tự động nhảy bài khi video kết thúc (người đầu tiên gửi lệnh)
        socket.emit('skipVideo');
    }
}

// 4. NHẬN LỆNH TỪ SERVER

socket.on('changeVideo', (videoId) => {
    isSyncing = true;
    player.loadVideoById(videoId);
    statusText.innerText = `Trạng thái: Đang phát bài mới.`;
    setTimeout(() => isSyncing = false, 1000); 
});

socket.on('updatePlaylist', (playlist) => {
    playlistUI.innerHTML = ''; // Xóa danh sách cũ
    if (playlist.length === 0) {
        playlistUI.innerHTML = '<li>Danh sách đang trống...</li>';
        return;
    }
    // In danh sách mới (Vì không có API key nên mình in tạm ID video ra nhé)
    playlist.forEach((id, index) => {
        const li = document.createElement('li');
        li.innerText = `${index + 1}. Video ID: ${id}`;
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