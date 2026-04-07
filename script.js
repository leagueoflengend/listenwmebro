require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { google } = require('googleapis');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

// ===== CHECK API KEY =====
if (!process.env.YOUTUBE_API_KEY) {
    console.error("❌ THIẾU YOUTUBE_API_KEY!");
} else {
    console.log("✅ API KEY OK");
}

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

// ===== DATA =====
let playlist = [];
let users = {};

let roomState = {
    videoId: 'y881t8SK8tE',
    time: 0,
    isPlaying: false,
    lastUpdate: Date.now()
};

// ===== REAL TIME SYNC =====
function getCurrentTime() {
    if (!roomState.isPlaying) return roomState.time;
    return roomState.time + (Date.now() - roomState.lastUpdate) / 1000;
}

// ===== FORMAT TIME =====
function formatDuration(iso) {
    if (!iso) return "0:00";
    const m = iso.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!m) return "0:00";

    const h = m[1] ? parseInt(m[1]) : 0;
    const min = m[2] ? parseInt(m[2]) : 0;
    const s = m[3] ? parseInt(m[3]) : 0;

    if (h > 0) return `${h}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${min}:${String(s).padStart(2,'0')}`;
}

// ===== SOCKET =====
io.on('connection', (socket) => {

    console.log("👤 Connected:", socket.id);

    socket.on('join', (name) => {
        users[socket.id] = name || "Khách";
        io.emit('updateUserList', Object.values(users));
    });

    // 🔥 INIT ROOM (SYNC CHUẨN)
    socket.emit('initRoom', {
        videoId: roomState.videoId,
        time: getCurrentTime(),
        isPlaying: roomState.isPlaying
    });

    socket.emit('updatePlaylist', playlist);

    // ===== SEARCH =====
    socket.on('searchSong', async (q) => {
        try {
            if (!process.env.YOUTUBE_API_KEY) {
                return socket.emit('searchError', "Chưa có API KEY!");
            }

            const res = await youtube.search.list({
                part: 'snippet',
                q,
                maxResults: 5,
                type: 'video'
            });

            const ids = res.data.items
                .map(i => i.id.videoId)
                .filter(Boolean)
                .join(',');

            if (!ids) return socket.emit('searchResults', []);

            const vRes = await youtube.videos.list({
                part: 'snippet,contentDetails',
                id: ids
            });

            const results = vRes.data.items.map(v => ({
                id: v.id,
                title: v.snippet.title,
                thumbnail: v.snippet.thumbnails.medium.url,
                author: v.snippet.channelTitle,
                duration: formatDuration(v.contentDetails.duration)
            }));

            socket.emit('searchResults', results);

        } catch (e) {
            console.error("❌ API ERROR:", e.message);
            socket.emit('searchError', e.message);
        }
    });

    // ===== PLAYLIST =====
    socket.on('addToList', async (id) => {
        try {
            const res = await youtube.videos.list({
                part: 'snippet',
                id
            });

            if (res.data.items[0]) {
                playlist.push({
                    id,
                    title: res.data.items[0].snippet.title
                });
                io.emit('updatePlaylist', playlist);
            }
        } catch {}
    });

    socket.on('changeVideo', (videoId) => {
        roomState = {
            videoId,
            time: 0,
            isPlaying: true,
            lastUpdate: Date.now()
        };
        io.emit('changeVideo', videoId);
    });

    socket.on('play', (t) => {
        roomState.isPlaying = true;
        roomState.time = t;
        roomState.lastUpdate = Date.now();
        socket.broadcast.emit('play', t);
    });

    socket.on('pause', (t) => {
        roomState.isPlaying = false;
        roomState.time = t;
        roomState.lastUpdate = Date.now();
        socket.broadcast.emit('pause');
    });

    socket.on('skipVideo', () => {
        if (playlist.length > 0) {
            const next = playlist.shift();
            roomState = {
                videoId: next.id,
                time: 0,
                isPlaying: true,
                lastUpdate: Date.now()
            };
            io.emit('changeVideo', next.id);
            io.emit('updatePlaylist', playlist);
        }
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('updateUserList', Object.values(users));
    });
});

server.listen(process.env.PORT || 10000, () => {
    console.log("🚀 Server running");
});
