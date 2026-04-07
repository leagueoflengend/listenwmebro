const socket = io();

// --- KHAI BÁO CÁC BIẾN DOM ---
const joinOverlay = document.getElementById("join");
const nameInput = document.getElementById("name");
const searchInput = document.getElementById("search");
const resultsBox = document.getElementById("results");
const queueBox = document.getElementById("queue");
const chatBox = document.getElementById("chatMessages");
const msgInput = document.getElementById("msg");
const statusText = document.getElementById("statusText");

let myName = "";
let player;
let syncing = false;

// --- 1. HÀM GIA NHẬP PHÒNG ---
function join() {
    myName = nameInput.value.trim();
    if (!myName) {
        alert("Vui lòng nhập tên!");
        return;
    }
    socket.emit("join", myName);
    joinOverlay.classList.add("fade-out"); // Hiệu ứng biến mất mượt mà
    setTimeout(() => joinOverlay.style.display = "none", 500);
}

// --- 2. CẤU HÌNH YOUTUBE PLAYER ---
function onYouTubeIframeAPIReady() {
    player = new YT.Player("player", {
        height: '100%',
        width: '100%',
        videoId: 'y881t8SK8tE', // Video mặc định
        playerVars: { 'playsinline': 1, 'autoplay': 1, 'controls': 1 },
        events: {
            onReady: () => statusText.innerText = "Sẵn sàng!",
            onStateChange: e => {
                if (syncing) return;
                // 1: Đang phát, 2: Tạm dừng, 0: Kết thúc
                if (e.data === 1) socket.emit("play", player.getCurrentTime());
                if (e.data === 2) socket.emit("pause", player.getCurrentTime());
                if (e.data === 0) socket.emit("skip");
            }
        }
    });
}

// --- 3. ĐỒNG BỘ HÓA (SOCKET LISTENERS) ---
socket.on("initRoom", d => {
    if (d.videoId) loadVideo(d.videoId, d.time, d.isPlaying);
});

socket.on("changeVideo", id => {
    loadVideo(id, 0, true);
});

socket.on("play", t => {
    syncing = true;
    if (Math.abs(player.getCurrentTime() - t) > 1.5) player.seekTo(t, true);
    player.playVideo();
    setTimeout(() => syncing = false, 1000);
});

socket.on("pause", () => {
    syncing = true;
    player.pauseVideo();
    setTimeout(() => syncing = false, 1000);
});

function loadVideo(id, t, play) {
    syncing = true;
    player.loadVideoById({ videoId: id, startSeconds: t });
    statusText.innerText = "Đang chuyển bài...";
    setTimeout(() => {
        play ? player.playVideo() : player.pauseVideo();
        syncing = false;
        statusText.innerText = "Đang phát";
    }, 1000);
}

// --- 4. TÌM KIẾM BÀI HÁT ---
function search() {
    const q = searchInput.value.trim();
    if (!q) return;
    resultsBox.classList.add("active");
    resultsBox.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-sub);">🔍 Đang tìm kiếm...</p>';
    socket.emit("searchSong", q);
}

socket.on("searchResults", list => {
    resultsBox.innerHTML = "";
    if (list.length === 0) {
        resultsBox.innerHTML = '<p style="padding:15px; color:var(--text-sub);">Không tìm thấy bài nào.</p>';
        return;
    }
    list.forEach(v => {
        const d = document.createElement("div");
        d.className = "result-item";
        d.innerHTML = `
            <img src="${v.thumbnail}">
            <div>
                <div class="result-title">${v.title}</div>
                <div class="result-author">${v.author || ''}</div>
            </div>
        `;
        d.onclick = () => {
            socket.emit("addToList", v.id); // Thêm vào hàng chờ
            resultsBox.classList.remove("active");
            searchInput.value = "";
        };
        resultsBox.appendChild(d);
    });
});

// --- 5. QUẢN LÝ HÀNG ĐỢI ---
socket.on("updatePlaylist", list => {
    queueBox.innerHTML = "";
    if (list.length === 0) {
        queueBox.innerHTML = '<p style="color:var(--text-sub); text-align:center; font-size:0.8em; margin-top:100px;">Trống...</p>';
        return;
    }
    list.forEach((v, index) => {
        const d = document.createElement("div");
        d.className = "queue-item";
        d.innerHTML = `
            <div style="font-size: 0.8em; color: var(--accent-color); font-weight: bold; width: 20px;">${index + 1}</div>
            <img src="${v.thumbnail || 'https://via.placeholder.com/60x34'}">
            <div class="queue-title">${v.title}</div>
            <i class="fas fa-trash" style="font-size: 0.8em; color: #ef4444; cursor: pointer" onclick="socket.emit('removeVideo', ${index})"></i>
        `;
        queueBox.appendChild(d);
    });
});

function skip() {
    socket.emit("skipVideo");
}

function playNow() {
    // Hàm này dành cho việc dán link và phát ngay (nếu server của bạn hỗ trợ)
    const q = searchInput.value.trim();
    if(q.includes("youtube.com") || q.includes("youtu.be")) {
        const id = q.match(/(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|vi\/|u\/\w\/|shorts\/|e\/|(?:\?|&)v=)([^#\&\?]*).*/)[1];
        if(id) socket.emit("changeVideo", id);
        searchInput.value = "";
    }
}

function addToList() {
    const q = searchInput.value.trim();
    if(q.includes("youtube.com") || q.includes("youtu.be")) {
        const id = q.match(/(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|vi\/|u\/\w\/|shorts\/|e\/|(?:\?|&)v=)([^#\&\?]*).*/)[1];
        if(id) socket.emit("addToList", id);
        searchInput.value = "";
    }
}

// --- 6. CHAT VÀ BỘ LỌC EMOJI ---
function send() {
    let t = msgInput.value.trim();
    if (!t) return;

    // BỘ LỌC EMOJI TỰ ĐỘNG
    const emojiMap = {
        ":D": "😄",
        ":)": "🙂",
        ":(": "😟",
        ":P": "😛",
        "<3": "❤️"
    };

    Object.keys(emojiMap).forEach(key => {
        t = t.replaceAll(key, emojiMap[key]);
    });

    socket.emit("chatMessage", { name: myName, message: t });
    msgInput.value = "";
}

socket.on("chatMessage", d => {
    const div = document.createElement("div");
    div.className = "msg";
    if (d.name === myName) div.classList.add("me");
    else div.classList.add("other");

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
        <span class="msg-sender">${d.name} • ${time}</span>
        ${d.message}
    `;

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
});

// --- KHỞI TẠO YOUTUBE API ---
const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);
