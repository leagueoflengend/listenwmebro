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
let roomState = { videoId: null, time: 0, isPlaying: false, lastUpdate: Date.now() };

function getTime() {
    if (!roomState.isPlaying) return roomState.time;
    return roomState.time + (Date.now() - roomState.lastUpdate) / 1000;
}

function playNext() {
    if (playlist.length === 0) {
        roomState.videoId = null; roomState.isPlaying = false;
        return io.emit("updateQueue", []);
    }
    const next = playlist.shift();
    roomState = { videoId: next.id, time: 0, isPlaying: true, lastUpdate: Date.now() };
    io.emit("changeVideo", next.id);
    io.emit("updateQueue", playlist);
}

io.on('connection', socket => {
    socket.on("join", name => {
        users[socket.id] = name || "Khách";
        socket.emit("initRoom", { videoId: roomState.videoId, time: getTime(), isPlaying: roomState.isPlaying });
        socket.emit("updateQueue", playlist);
        io.emit("chatMessage", { name: "Hệ thống", message: `👋 ${users[socket.id]} đã vào phòng.` });
    });

    socket.on("chatMessage", d => io.emit("chatMessage", d));

    socket.on("searchSong", async q => {
        try {
            const res = await youtube.search.list({ part: 'snippet', q, maxResults: 5, type: 'video' });
            const results = res.data.items.map(v => ({
                id: v.id.videoId, title: v.snippet.title, thumbnail: v.snippet.thumbnails.medium.url
            }));
            socket.emit("searchResults", results);
        } catch (e) { socket.emit("searchResults", []); }
    });

    socket.on("addToQueue", item => {
        if (!roomState.videoId) {
            roomState = { videoId: item.id, time: 0, isPlaying: true, lastUpdate: Date.now() };
            io.emit("changeVideo", item.id);
        } else {
            playlist.push(item);
            io.emit("updateQueue", playlist);
        }
    });

    socket.on("removeVideo", index => {
        playlist.splice(index, 1);
        io.emit("updateQueue", playlist);
    });

    socket.on("skip", () => playNext());
    socket.on("ended", () => playNext());

    socket.on("play", t => {
        roomState.time = t; roomState.isPlaying = true; roomState.lastUpdate = Date.now();
        socket.broadcast.emit("play", t);
    });

    socket.on("pause", t => {
        roomState.time = t; roomState.isPlaying = false;
        socket.broadcast.emit("pause", t);
    });

    socket.on("changeVideo", id => {
        roomState = { videoId: id, time: 0, isPlaying: true, lastUpdate: Date.now() };
        io.emit("changeVideo", id);
    });

    socket.on("disconnect", () => {
        if (users[socket.id]) io.emit("chatMessage", { name: "Hệ thống", message: `🚶 ${users[socket.id]} đã rời phòng.` });
        delete users[socket.id];
    });
});

server.listen(process.env.PORT || 10000);
