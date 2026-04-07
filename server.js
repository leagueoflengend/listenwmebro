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

let users = {};
let playlist = [];
let roomState = { videoId: 'y881t8SK8tE', time: 0, isPlaying: false, lastUpdate: Date.now() };

function playNext() {
    if (playlist.length === 0) return;
    const next = playlist.shift();
    roomState = { videoId: next.id, time: 0, isPlaying: true, lastUpdate: Date.now() };
    io.emit("changeVideo", next.id);
    io.emit("updateQueue", playlist);
}

io.on('connection', socket => {
    // 1. JOIN
    socket.on("join", name => {
        users[socket.id] = name || "Khách";
        socket.emit("initRoom", { 
            videoId: roomState.videoId, 
            time: roomState.isPlaying ? roomState.time + (Date.now() - roomState.lastUpdate)/1000 : roomState.time, 
            isPlaying: roomState.isPlaying 
        });
        socket.emit("updateQueue", playlist);
        io.emit("chatMessage", { name: "Hệ thống", message: `👋 ${users[socket.id]} đã vào.` });
    });

    // 2. SEARCH
    socket.on("searchSong", async q => {
        try {
            const res = await youtube.search.list({ part: 'snippet', q, maxResults: 5, type: 'video' });
            const results = res.data.items.map(v => ({
                id: v.id.videoId, title: v.snippet.title, thumbnail: v.snippet.thumbnails.medium.url
            }));
            socket.emit("searchResults", results);
        } catch (e) { socket.emit("searchResults", []); }
    });

    // 3. QUEUE LOGIC
    socket.on("addToQueue", item => {
        if (!roomState.videoId) {
            roomState = { videoId: item.id, time: 0, isPlaying: true, lastUpdate: Date.now() };
            io.emit("changeVideo", item.id);
        } else {
            playlist.push(item);
            io.emit("updateQueue", playlist);
        }
    });

    socket.on("skip", () => playNext());
    socket.on("ended", () => playNext());

    // 4. SYNC
    socket.on("play", t => {
        roomState.time = t; roomState.isPlaying = true; roomState.lastUpdate = Date.now();
        socket.broadcast.emit("play", t);
    });
    socket.on("pause", t => {
        roomState.time = t; roomState.isPlaying = false;
        socket.broadcast.emit("pause", t);
    });

    socket.on("chatMessage", d => io.emit("chatMessage", d));
    socket.on("disconnect", () => { delete users[socket.id]; });
});

server.listen(process.env.PORT || 10000);
