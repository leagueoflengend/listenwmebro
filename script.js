const socket = io();
const sInput = document.getElementById("sQueryInput");
const rBox = document.getElementById("results");
const chatBox = document.getElementById("chatMsgs");
const userCount = document.getElementById("userCount");
const userList = document.getElementById("userList");

let myName = "";
let player;
let syncing = false;

// 1. JOIN
function handleJoin() {
    myName = document.getElementById("uNameInput").value.trim();
    if (!myName) return;
    socket.emit("join", myName);
    document.getElementById("join").style.display = "none";
}

// 2. YOUTUBE API
function onYouTubeIframeAPIReady() {
    player = new YT.Player("player", {
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

// 3. SEARCH & PLAY
function handleSearch() {
    const q = sInput.value.trim();
    if (!q) return;
    rBox.classList.add("active");
    rBox.innerHTML = '<p style="text-align:center; padding:15px;">🔍 Đang tìm...</p>';
    socket.emit("searchSong", q);
}

socket.on("searchResults", list => {
    rBox.innerHTML = "";
    if (list.length === 0) { rBox.innerHTML = '<p style="padding:15px;">Không thấy bài nào.</p>'; return; }
    list.forEach(v => {
        const d = document.createElement("div");
        d.className = "result-item";
        d.innerHTML = `<img src="${v.thumbnail}" width="80"><div><b style="font-size:0.85em">${v.title}</b></div>`;
        d.onclick = () => {
            socket.emit("addToQueue", v);
            rBox.classList.remove("active");
            sInput.value = "";
        };
        rBox.appendChild(d);
    });
});

function handlePlayNow() {
    const q = sInput.value.trim();
    const match = q.match(/(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|vi\/|u\/\w\/|shorts\/|e\/|(?:\?|&)v=)([^#\&\?]*).*/);
    if (match && match[1]) {
        socket.emit("changeVideo", match[1]);
        sInput.value = "";
    }
}

// 4. SYNC
socket.on("initRoom", d => {
    if (d.videoId) {
        syncing = true;
        player.loadVideoById({ videoId: d.videoId, startSeconds: d.time });
        if (!d.isPlaying) setTimeout(() => player.pauseVideo(), 800);
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

// 5. QUEUE, ONLINE & CHAT
socket.on("updateQueue", list => {
    document.getElementById("queue").innerHTML = list.map(v => `
        <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
            <img src="${v.thumbnail}" width="50" style="border-radius:4px">
            <div style="font-size:0.75em; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${v.title}</div>
        </div>
    `).join("") || "Trống...";
});

socket.on("updateUserList", names => {
    userCount.innerText = names.length;
    userList.innerText = names.join(", ");
});

function handleSkip() { socket.emit("skip"); }

function handleSend() {
    let m = document.getElementById("mInput").value.trim();
    if (!m) return;
    const emoj = { ":D":"😄",":)":"🙂",":(":"😟","<3":"❤️" };
    Object.keys(emoj).forEach(k => m = m.replaceAll(k, emoj[k]));
    socket.emit("chatMessage", { name: myName, message: m });
    document.getElementById("mInput").value = "";
}

socket.on("chatMessage", d => {
    const div = document.createElement("div");
    div.className = `msg ${d.name === myName ? 'me' : 'other'}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<b>${d.name}:</b> ${d.message} <span class="msg-time">${time}</span>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
});

window.onclick = e => { if (!rBox.contains(e.target) && e.target !== sInput) rBox.classList.remove("active"); };

const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);
