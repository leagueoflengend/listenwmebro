const socket = io();

let player;
let myName = "";
let isSyncing = false;

// ================= JOIN =================
function joinRoom() {
    const name = document.getElementById("joinNameInput").value.trim();
    if (!name) return alert("Nhập tên đi bro 😅");

    myName = name;
    socket.emit("join", name);

    document.getElementById("joinModal").style.display = "none";
}

// ================= USER LIST =================
socket.on("updateUserList", (list) => {
    document.getElementById("userCount").innerText = list.length;
    document.getElementById("userList").innerText = list.join(", ");
});

// ================= YOUTUBE PLAYER =================
function onYouTubeIframeAPIReady() {
    player = new YT.Player("player", {
        height: "360",
        width: "640",
        videoId: "",
        events: {
            onReady: () => console.log("Player ready"),
            onStateChange: onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    if (isSyncing) return;

    if (event.data === YT.PlayerState.PLAYING) {
        socket.emit("play", player.getCurrentTime());
    }

    if (event.data === YT.PlayerState.PAUSED) {
        socket.emit("pause", player.getCurrentTime());
    }
}

// ================= SYNC =================
socket.on("initRoom", (data) => {
    loadVideo(data.videoId, data.time, data.isPlaying);
});

socket.on("changeVideo", (videoId) => {
    loadVideo(videoId, 0, true);
});

socket.on("play", (time) => {
    syncTo(time, true);
});

socket.on("pause", () => {
    player.pauseVideo();
});

function loadVideo(videoId, time = 0, play = true) {
    isSyncing = true;

    player.loadVideoById(videoId, time);

    setTimeout(() => {
        if (!play) player.pauseVideo();
        isSyncing = false;
    }, 1000);
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

socket.on("searchResults", (results) => {
    const box = document.getElementById("searchResultsBox");
    box.innerHTML = "";
    box.style.display = "block";

    results.forEach(v => {
        const div = document.createElement("div");
        div.className = "search-item";
        div.innerHTML = `
            <img src="${v.thumbnail}">
            <div>
                <b>${v.title}</b><br>
                <small>${v.author} • ${v.duration}</small>
            </div>
        `;
        div.onclick = () => {
            socket.emit("addToList", v.id);
            box.style.display = "none";
        };
        box.appendChild(div);
    });
});

socket.on("searchError", (msg) => {
    alert(msg);
});

// ================= PLAY LINK =================
function playNow() {
    const input = document.getElementById("youtubeLink").value.trim();
    if (!input) return;

    let id = input;

    if (input.includes("youtube.com") || input.includes("youtu.be")) {
        const url = new URL(input);
        id = url.searchParams.get("v") || input.split("/").pop();
    }

    socket.emit("changeVideo", id);
}

// ================= PLAYLIST =================
socket.on("updatePlaylist", (list) => {
    const ul = document.getElementById("playlistUI");
    ul.innerHTML = "";

    list.forEach((v, i) => {
        const li = document.createElement("li");
        li.innerHTML = `
            ${v.title}
            <button onclick="playFromList('${v.id}')">▶</button>
            <button onclick="removeVideo(${i})">❌</button>
        `;
        ul.appendChild(li);
    });
});

function playFromList(id) {
    socket.emit("changeVideo", id);
}

function removeVideo(i) {
    socket.emit("removeVideo", i);
}

function skipVideo() {
    socket.emit("skipVideo");
}

// ================= CHAT =================
function sendMessage() {
    const input = document.getElementById("chatInput");
    const msg = input.value.trim();
    if (!msg) return;

    socket.emit("chatMessage", {
        name: myName,
        message: msg
    });

    input.value = "";
}

socket.on("chatMessage", (data) => {
    const box = document.getElementById("chatMessages");

    const div = document.createElement("div");
    div.innerHTML = `<b>${data.name}:</b> ${data.message}`;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});

// ================= THEME =================
function toggleTheme() {
    document.body.classList.toggle("dark-theme");
}

// ================= LOAD YOUTUBE API =================
const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);
