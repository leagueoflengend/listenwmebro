const socket = io();

let myName = "";
let player;

// emoji
function convertEmoji(text) {
    return text
        .replace(/:\)\)/g, "😂")
        .replace(/:D/g, "😄")
        .replace(/:\)/g, "🙂")
        .replace(/:\(/g, "🙁")
        .replace(/<3/g, "❤️");
}

// join
function joinRoom() {
    const name = document.getElementById("joinNameInput").value.trim();
    if (!name) return alert("Nhập tên");

    myName = name;
    socket.emit("join", name);
    document.getElementById("joinModal").style.display = "none";
}

// users
socket.on("updateUserList", list => {
    document.getElementById("userCount").innerText = list.length;
});

// youtube
function onYouTubeIframeAPIReady() {
    player = new YT.Player("player");
}

// search
function searchSong() {
    const q = document.getElementById("youtubeLink").value;
    socket.emit("searchSong", q);
}

socket.on("searchResults", list => {
    const box = document.getElementById("searchResultsBox");
    box.innerHTML = "";

    list.forEach(v => {
        const div = document.createElement("div");
        div.innerHTML = v.title;
        div.onclick = () => socket.emit("changeVideo", v.id);
        box.appendChild(div);
    });
});

// chat
function sendMessage() {
    let msg = document.getElementById("chatInput").value.trim();
    if (!msg) return;

    msg = convertEmoji(msg);

    socket.emit("chatMessage", {
        name: myName,
        message: msg
    });

    document.getElementById("chatInput").value = "";
}

socket.on("chatMessage", d => {
    const box = document.getElementById("chatMessages");

    const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

    const div = document.createElement("div");
    div.className = "chat-item";

    if (d.name === myName) div.classList.add("me");

    div.innerHTML = `
        <div class="chat-header">
            <span>${d.name}</span>
            <span>${time}</span>
        </div>
        <div>${d.message}</div>
    `;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});

// load yt api
const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);
