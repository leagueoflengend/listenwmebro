require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { google } = require('googleapis');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });

app.use(express.static(__dirname));

let playlist = [];
let users = {};
let roomState = { videoId: null, time: 0, isPlaying: false, lastUpdate: Date.now() };

function playNext() {
    if (playlist.length > 0) {
        const next = playlist.shift();
        roomState = { videoId: next.id, time: 0, isPlaying: true, lastUpdate: Date.now() };
        io.emit("changeVideo", next.id);
        io.emit("updateQueue", playlist);
    } else {
        roomState.videoId = null;
        roomState.isPlaying = false;
        io.emit("updateQueue", []);
    }
}

io.on('connection', socket => {
    socket.on("join", name => {
        users[socket.id] = name || "Khách";
        io.emit("updateUserList", Object.values(users));
        socket.emit("initRoom", { 
            videoId: roomState.videoId, 
            time: roomState.isPlaying ? roomState.time + (Date.now() - roomState.lastUpdate)/1000 : roomState.time, 
            isPlaying: roomState.isPlaying 
        });
        socket.emit("updateQueue", playlist);
    });

    socket.on("searchSong", async q => {
        try {
            const res = await youtube.search.list({ part: 'snippet', q, maxResults: 5, type: 'video' });
            const results = res.data.items.map(v => ({ id: v.id.videoId, title: v.snippet.title, thumbnail: v.snippet.thumbnails.medium.url }));
            socket.emit("searchResults", results);
        } catch (e) { socket.emit("searchResults", []); }
    });

    socket.on("addLinkToQueue", async (id) => {
        try {
            const res = await youtube.videos.list({ part: 'snippet', id: id });
            if (res.data.items[0]) {
                const v = res.data.items[0];
                playlist.push({ id, title: v.snippet.title, thumbnail: v.snippet.thumbnails.medium.url });
                io.emit("updateQueue", playlist);
                if (!roomState.videoId) playNext();
            }
        } catch (e) { console.log(e); }
    });

    socket.on("addToQueue", item => {
        playlist.push(item);
        io.emit("updateQueue", playlist);
        if (!roomState.videoId) playNext();
    });

    // --- LOGIC ƯU TIÊN & XÓA ---
    socket.on("priorityVideo", index => {
        if (playlist[index]) {
            const item = playlist.splice(index, 1)[0];
            playlist.unshift(item); // Đưa lên đầu mảng
            io.emit("updateQueue", playlist);
        }
    });

    socket.on("removeVideo", index => {
        if (playlist[index]) {
            playlist.splice(index, 1); // Xóa khỏi mảng
            io.emit("updateQueue", playlist);
        }
    });

    socket.on("play", t => { roomState.time = t; roomState.isPlaying = true; roomState.lastUpdate = Date.now(); socket.broadcast.emit("play", t); });
    socket.on("pause", t => { roomState.time = t; roomState.isPlaying = false; socket.broadcast.emit("pause", t); });
    socket.on("skip", () => playNext());
    socket.on("ended", () => playNext());
    socket.on("chatMessage", d => io.emit("chatMessage", d));
    socket.on("disconnect", () => {
        delete users[socket.id];
        io.emit("updateUserList", Object.values(users));
    });
});

server.listen(process.env.PORT || 10000);
