require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { google } = require('googleapis');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

app.use(express.static(__dirname));

let users = {};
let playlist = [];

// 🔥 trạng thái phòng
let roomState = {
    videoId: null,
    time: 0,
    isPlaying: false,
    lastUpdate: Date.now()
};

function getCurrentTime() {
    if (!roomState.isPlaying) return roomState.time;
    return roomState.time + (Date.now() - roomState.lastUpdate) / 1000;
}

io.on('connection', (socket) => {

    socket.on('join', (name) => {
        users[socket.id] = name || "Khách";
        io.emit('updateUserList', Object.values(users));

        // 🔥 gửi trạng thái thật
        socket.emit('initRoom', {
            videoId: roomState.videoId,
            time: getCurrentTime(),
            isPlaying: roomState.isPlaying
        });
    });

    // ===== CHAT FIX =====
    socket.on('chatMessage', (data) => {
        io.emit('chatMessage', data);
    });

    // ===== SEARCH =====
    socket.on('searchSong', async (q) => {
        try {
            const res = await youtube.search.list({
                part: 'snippet',
                q,
                maxResults: 5,
                type: 'video'
            });

            const ids = res.data.items.map(i => i.id.videoId).join(',');

            const vRes = await youtube.videos.list({
                part: 'contentDetails,snippet',
                id: ids
            });

            const results = vRes.data.items.map(v => ({
                id: v.id,
                title: v.snippet.title,
                thumbnail: v.snippet.thumbnails.medium.url
            }));

            socket.emit('searchResults', results);
        } catch (e) {
            console.log(e);
        }
    });

    // ===== CHANGE VIDEO =====
    socket.on('changeVideo', (id) => {
        roomState = {
            videoId: id,
            time: 0,
            isPlaying: true,
            lastUpdate: Date.now()
        };

        io.emit('changeVideo', id);
    });

    // ===== PLAY =====
    socket.on('play', (t) => {
        roomState.time = t;
        roomState.isPlaying = true;
        roomState.lastUpdate = Date.now();

        socket.broadcast.emit('play', t);
    });

    // ===== PAUSE =====
    socket.on('pause', (t) => {
        roomState.time = t;
        roomState.isPlaying = false;

        socket.broadcast.emit('pause', t);
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('updateUserList', Object.values(users));
    });
});

server.listen(process.env.PORT || 10000);
