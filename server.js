const socket = io();
let myName = "";
let player;
let syncing = false;

// 1. JOIN
function handleJoin() {
    myName = document.getElementById("userName").value.trim();
    if (!myName) return;
    socket.emit("join", myName);
    document.getElementById("join").style.display = "none";
}

// 2. YOUTUBE API
function onYouTubeIframeAPIReady() {
    player = new YT.Player("player", {
        height: '100%', width: '100%',
        events: {
            onStateChange: e => {
                if (syncing) return;
                if (e.data === 1) socket.emit("play", player.getCurrentTime());
                if (e.data === 2) socket.emit("pause", player.getCurrentTime());
                if (e.data === 0) socket.emit("ended");
            }
        }
    });
}

// 3. SEARCH
function handleSearch() {
    const q = document.getElementById("searchInp").value.trim();
    if (!q) return;
    document.getElementById("results").innerHTML = "<p style='padding:10px'>Đang tìm...</p>";
    socket.emit("searchSong", q);
}

socket.on("searchResults", list => {
    const box = document.getElementById("results");
    box.innerHTML = list.map(v => `
        <div class="res-item" onclick="addToQueue('${v.id}','${v.title.replace(/'/g, "")}','${v.thumbnail}')">
            <img src="${v.thumbnail}" width="60">
            <div style="font-size:0.8rem">${v.title}</div>
        </div>
    `).join("");
});

function addToQueue(id, title, thumbnail) {
    socket.emit("addToQueue", { id, title, thumbnail });
    document.getElementById("results").innerHTML = "";
    document.getElementById("searchInp").value = "";
}

// 4. SYNC LOGIC
socket.on("initRoom", d => {
    if (d.videoId) {
        syncing = true;
        player.loadVideoById({ videoId: d.videoId, startSeconds: d.time });
        if (!d.isPlaying) setTimeout(() => player.pauseVideo(), 500);
        setTimeout(() => syncing = false, 1500);
    }
});

socket.on("changeVideo", id => {
    syncing = true;
    player.loadVideoById(id);
    setTimeout(() => syncing = false, 1000);
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

// 5. QUEUE & CHAT
socket.on("updateQueue", list => {
    document.getElementById("queueBox").innerHTML = list.map(v => `
        <div style="display:flex; gap:10px; margin:5px 0; font-size:0.8rem">
            <img src="${v.thumbnail}" width="40"> <span>${v.title}</span>
        </div>
    `).join("");
});

function handleSkip() { socket.emit("skip"); }

function handleSend() {
    let m = document.getElementById("msgInp").value.trim();
    if (!m) return;
    const emojiMap = { ":D": "😄", ":)": "🙂", "<3": "❤️" };
    Object.keys(emojiMap).forEach(k => m = m.replaceAll(k, emojiMap[k]));
    socket.emit("chatMessage", { name: myName, message: m });
    document.getElementById("msgInp").value = "";
}

socket.on("chatMessage", d => {
    const div = document.createElement("div");
    div.innerHTML = `<b>${d.name}:</b> ${d.message}`;
    document.getElementById("chatMsgs").appendChild(div);
    document.getElementById("chatMsgs").scrollTop = document.getElementById("chatMsgs").scrollHeight;
});

// Load YT API
const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);
