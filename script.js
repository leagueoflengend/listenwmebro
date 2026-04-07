const socket = io();

let myName = "";
let player;
let playerReady = false;
let pendingInit = null;
let isSyncing = false;

// ================= JOIN =================
function joinRoom() {
    const input = document.getElementById("joinNameInput");
    const name = input.value.trim();

    if (!name) {
        alert("Nhập tên đi bro 😅");
        return;
    }

    myName = name;

    socket.emit("join", name); // 🔥 QUAN TRỌNG

    document.getElementById("joinModal").style.display = "none";
}

// ================= USER =================
socket.on("updateUserList", (list) => {
    document.getElementById("userCount").innerText = list.length;
});

// ================= YOUTUBE =================
function onYouTubeIframeAPIReady() {
    player = new YT.Player("player", {
        events: {
            onReady: () => {
                playerReady = true;

                if (pendingInit) {
                    startRoom(pendingInit);
                    pendingInit = null;
                }
            },
            onStateChange: onPlayerStateChange
        }
    });
}

function onPlayerStateChange(e) {
    if (isSyncing) return;

    if (e.data === YT.PlayerState.PLAYING) {
        socket.emit("play", player.getCurrentTime());
    }

    if (e.data === YT.PlayerState.PAUSED) {
        socket.emit("pause", player.getCurrentTime());
    }
}

// ================= SYNC =================
socket.on("initRoom", (data) => {
    if (!playerReady) {
        pendingInit = data;
        return;
    }
    startRoom(data);
});

socket.on("changeVideo", (id) => {
    loadVideo(id, 0, true);
});

socket.on("play", (t) => {
    syncTo(t, true);
});

socket.on("pause", () => {
    player.pauseVideo();
});

function startRoom(data) {
    if (!data.videoId) return;

    loadVideo(data.videoId, data.time, data.isPlaying);
}

function loadVideo(id, time = 0, play = true) {
    isSyncing = true;

    player.loadVideoById({
        videoId: id,
        startSeconds: time
    });

    setTimeout(() => {
        if (play) player.playVideo();
        else player.pauseVideo();
        isSyncing = false;
    }, 1200);
}

function syncTo(time, play) {
    isSyncing = true;

    player.seekTo(time, true);
    if (play) player.playVideo();

    setTimeout(() => isSyncing = false, 500);
}

// ================= SEARCH =================
function searchSong() {
    const q = document.getElementById("youtubeLink").value.trim();
    if (!q) return;

    socket.emit("searchSong", q);
}

socket.on("searchResults", (list) => {
    const box = document.getElementById("searchResultsBox");
    box.innerHTML = "";
    box.style.display = "block";

    list.forEach(v => {
        const div = document.createElement("div");
        div.className = "search-item";
        div.innerHTML = `<img src="${v.thumbnail}" width="80">
            <div><b>${v.title}</b></div>`;

        div.onclick = () => {
            socket.emit("addToList", v.id);
            box.style.display = "none";
        };

        box.appendChild(div);
    });
});

// ================= CHAT =================
function sendMessage() {
    const input = document.getElementById("chatInput");
    const msg = input.value.trim();
    if (!msg) return;

    socket.emit("chatMessage", { name: myName, message: msg });
    input.value = "";
}

socket.on("chatMessage", (d) => {
    const box = document.getElementById("chatMessages");

    const div = document.createElement("div");
    div.innerHTML = `<b>${d.name}:</b> ${d.message}`;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});

// ================= YOUTUBE LOAD =================
const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);
