const socket = io();
let myName = "";
let player;
let syncing = false;

// --- 1. JOIN ---
function handleJoinClick() {
    myName = document.getElementById("uNameInput").value.trim();
    if (!myName) return;
    socket.emit("join", myName);
    document.getElementById("join").style.display = "none";
}

// --- 2. YOUTUBE API ---
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

// --- 3. SEARCH & LINK ---
function handleSearchClick() {
    const inp = document.getElementById("sQueryInput");
    const q = inp.value.trim();
    if (!q) return;

    const idMatch = q.match(/(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|vi\/|u\/\w\/|shorts\/|e\/|(?:\?|&)v=)([^#\&\?]*).*/);
    if (idMatch && idMatch[1]) {
        socket.emit("addLinkToQueue", idMatch[1]);
        inp.value = "";
        return;
    }

    const resBox = document.getElementById("results");
    resBox.classList.add("active");
    resBox.innerHTML = "<p style='padding:15px; text-align:center;'>🔍 Đang tìm bài...</p>";
    socket.emit("searchSong", q);
}

function handleLinkClick() {
    const q = document.getElementById("sQueryInput").value.trim();
    const idMatch = q.match(/(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|vi\/|u\/\w\/|shorts\/|e\/|(?:\?|&)v=)([^#\&\?]*).*/);
    if (idMatch && idMatch[1]) {
        socket.emit("addLinkToQueue", idMatch[1]);
        document.getElementById("sQueryInput").value = "";
    } else { alert("Dán link YouTube chuẩn bạn ơi!"); }
}

// --- 4. CHAT & SKIP ---
function handleChatClick() {
    const inp = document.getElementById("mChatInput");
    let m = inp.value.trim();
    if (!m) return;
    const emojiMap = { ":D":"😄", ":)":"🙂", "<3":"❤️" };
    Object.keys(emojiMap).forEach(k => m = m.replaceAll(k, emojiMap[k]));
    socket.emit("chatMessage", { name: myName, message: m });
    inp.value = "";
}

function handleSkipClick() { socket.emit("skip"); }

// --- SOCKET LISTENERS ---
socket.on("searchResults", data => {
    const box = document.getElementById("results");
    if (data.error === "QuotaExceeded") {
        box.innerHTML = `<div style="padding:15px; color:#ef4444; text-align:center;"><b>Lỗi API Google:</b> Hết lượt tìm kiếm trong ngày!<br>Hãy dán Link YouTube trực tiếp vào ô trên.</div>`;
        return;
    }
    box.innerHTML = data.map(v => `
        <div class="result-item" onclick="socket.emit('addToQueue', {id:'${v.id}', title:'${v.title.replace(/'/g,"")}', thumbnail:'${v.thumbnail}'}); document.getElementById('results').classList.remove('active'); document.getElementById('sQueryInput').value=''">
            <img src="${v.thumbnail}" width="70"> <div style="font-size:0.8em; padding: 5px;">${v.title}</div>
        </div>
    `).join("") || "<p style='padding:15px'>Không tìm thấy bài nào</p>";
});

socket.on("updateQueue", list => {
    document.getElementById("qBox").innerHTML = list.map((v, i) => `
        <div style="display:flex; gap:10px; margin-bottom:8px; align-items:center; border-bottom:1px solid var(--border); padding-bottom:5px">
            <img src="${v.thumbnail}" width="45" style="border-radius:4px">
            <div style="font-size:0.75em; flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${v.title}</div>
            <div style="display:flex; gap:8px;">
                <i class="fas fa-arrow-up q-btn" onclick="socket.emit('priorityVideo', ${i})" style="color:var(--accent)"></i>
                <i class="fas fa-trash q-btn" onclick="socket.emit('removeVideo', ${i})" style="color:#ef4444"></i>
            </div>
        </div>
    `).join("") || "<p style='color:#666; font-size:0.8em; text-align:center; margin-top:20px;'>Hàng đợi trống</p>";
});

socket.on("updateUserList", names => {
    document.getElementById("uCount").innerText = names.length;
    document.getElementById("uList").innerText = names.join(", ");
});

socket.on("chatMessage", d => {
    const div = document.createElement("div");
    div.className = `msg ${d.name === myName ? 'me' : 'other'}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<b>${d.name}:</b> ${d.message} <span class="msg-time">${time}</span>`;
    const box = document.getElementById("chatMsgs");
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});

// SYNC HANDLERS
socket.on("initRoom", d => { if (d.videoId) { syncing = true; player.loadVideoById({ videoId: d.videoId, startSeconds: d.time }); if (!d.isPlaying) setTimeout(() => player.pauseVideo(), 800); setTimeout(() => syncing = false, 1500); } });
socket.on("changeVideo", id => { syncing = true; player.loadVideoById(id); setTimeout(() => syncing = false, 1000); });
socket.on("play", t => { syncing = true; if (Math.abs(player.getCurrentTime() - t) > 1.5) player.seekTo(t, true); player.playVideo(); setTimeout(() => syncing = false, 1000); });
socket.on("pause", () => { syncing = true; player.pauseVideo(); setTimeout(() => syncing = false, 1000); });

// THEME
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    document.getElementById('theme-icon').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

(function() {
    if (localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark-theme'); document.getElementById('theme-icon').className = 'fas fa-sun'; }
    const tag = document.createElement("script"); tag.src = "https://www.youtube.com/iframe_api"; document.body.appendChild(tag);
    window.onclick = e => { const res = document.getElementById("results"); if (!res.contains(e.target) && e.target.id !== "sQueryInput") res.classList.remove("active"); };
})();
