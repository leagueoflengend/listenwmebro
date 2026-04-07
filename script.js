const socket = io();
const app = {
    myName: "", player: null, syncing: false,

    join: function() {
        this.myName = document.getElementById("uNameInp").value.trim();
        if (!this.myName) return;
        socket.emit("join", this.myName);
        document.getElementById("join").style.display = "none";
    },

    search: function() {
        const q = document.getElementById("sInp").value.trim();
        if (!q) return;
        const idMatch = q.match(/(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|vi\/|u\/\w\/|shorts\/|e\/|(?:\?|&)v=)([^#\&\?]*).*/);
        if (idMatch && idMatch[1]) {
            socket.emit("addLinkToQueue", idMatch[1]);
            document.getElementById("sInp").value = "";
            return;
        }
        const resBox = document.getElementById("results");
        resBox.classList.add("active");
        resBox.innerHTML = "<p style='padding:15px'>Đang tìm...</p>";
        socket.emit("searchSong", q);
    },

    playLink: function() {
        const q = document.getElementById("sInp").value.trim();
        const idMatch = q.match(/(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|vi\/|u\/\w\/|shorts\/|e\/|(?:\?|&)v=)([^#\&\?]*).*/);
        if (idMatch && idMatch[1]) {
            socket.emit("addLinkToQueue", idMatch[1]);
            document.getElementById("sInp").value = "";
        }
    },

    send: function() {
        let m = document.getElementById("mInp").value.trim();
        if (!m) return;
        const emoji = { ":D":"😄", ":)":"🙂", "<3":"❤️" };
        Object.keys(emoji).forEach(k => m = m.replaceAll(k, emoji[k]));
        socket.emit("chatMessage", { name: this.myName, message: m });
        document.getElementById("mInp").value = "";
    },

    skip: function() { socket.emit("skip"); },

    toggleTheme: function() {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        document.getElementById('theme-icon').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }
};

function onYouTubeIframeAPIReady() {
    app.player = new YT.Player("player", {
        events: {
            onStateChange: e => {
                if (app.syncing) return;
                if (e.data === 1) socket.emit("play", app.player.getCurrentTime());
                if (e.data === 2) socket.emit("pause", app.player.getCurrentTime());
                if (e.data === 0) socket.emit("ended");
            }
        }
    });
}

socket.on("searchResults", list => {
    const box = document.getElementById("results");
    box.innerHTML = list.map(v => `
        <div class="result-item" onclick="socket.emit('addToQueue', {id:'${v.id}', title:'${v.title.replace(/'/g,"")}', thumbnail:'${v.thumbnail}'}); document.getElementById('results').classList.remove('active'); document.getElementById('sInp').value=''">
            <img src="${v.thumbnail}" width="70"> <div style="font-size:0.8em; padding: 5px;">${v.title}</div>
        </div>
    `).join("");
});

socket.on("updateQueue", list => {
    document.getElementById("qBox").innerHTML = list.map((v, i) => `
        <div style="display:flex; gap:10px; margin-bottom:8px; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:5px">
            <img src="${v.thumbnail}" width="40" style="border-radius:4px">
            <div style="font-size:0.75em; flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${v.title}</div>
            <div style="display:flex; gap:5px;">
                <i class="fas fa-arrow-up q-btn" title="Ưu tiên" onclick="socket.emit('priorityVideo', ${i})"></i>
                <i class="fas fa-trash q-btn" title="Xóa" onclick="socket.emit('removeVideo', ${i})" style="color:#ef4444"></i>
            </div>
        </div>
    `).join("") || "<p style='color:#666; font-size:0.8em; text-align:center;'>Trống</p>";
});

socket.on("initRoom", d => {
    if (d.videoId) {
        app.syncing = true;
        app.player.loadVideoById({ videoId: d.videoId, startSeconds: d.time });
        if (!d.isPlaying) setTimeout(() => app.player.pauseVideo(), 800);
        setTimeout(() => app.syncing = false, 1500);
    }
});

socket.on("changeVideo", id => {
    app.syncing = true;
    app.player.loadVideoById(id);
    setTimeout(() => app.syncing = false, 1000);
});

socket.on("play", t => {
    app.syncing = true;
    if (Math.abs(app.player.getCurrentTime() - t) > 1.5) app.player.seekTo(t, true);
    app.player.playVideo();
    setTimeout(() => app.syncing = false, 1000);
});

socket.on("pause", () => {
    app.syncing = true; app.player.pauseVideo();
    setTimeout(() => app.syncing = false, 1000);
});

socket.on("updateUserList", names => {
    document.getElementById("uCount").innerText = names.length;
    document.getElementById("uList").innerText = names.join(", ");
});

socket.on("chatMessage", d => {
    const div = document.createElement("div");
    div.className = `msg ${d.name === app.myName ? 'me' : 'other'}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<b>${d.name}:</b> ${d.message} <span class="msg-time">${time}</span>`;
    const box = document.getElementById("chatMsgs");
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});

(function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('theme-icon').className = 'fas fa-sun';
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    window.onclick = e => { if (!document.getElementById("results").contains(e.target) && e.target !== document.getElementById("sInp")) document.getElementById("results").classList.remove("active"); };
})();
