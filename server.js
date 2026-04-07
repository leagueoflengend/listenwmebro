require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { google } = require('googleapis');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ===== YOUTUBE API =====
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

app.use(express.static(__dirname));

let playlist = [];
let users = {}; 

// 🔥 STATE CHUẨN (có lastUpdate)
let roomState = { 
    videoId: 'y881t8SK8tE', 
    time: 0, 
    isPlaying: false, 
    lastUpdate: Date.now() 
};

// 🔥 TIME REAL (QUAN TRỌNG NHẤT)
function getCurrentTime() {
    if (!roomState.isPlaying) return roomState.time;
    return roomState.time + (Date.now() - roomState.lastUpdate) / 1000;
}

// 🔥 FIX duration (không crash)
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

io.on('connection', (socket) => {

    console.log("👤 Connected:", socket.id);

    socket.on('join', (name) => {
        users[socket.id] = name || `Khách ${socket.id.substring(0,4)}`;
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
        console.log("🔍 Search:", q);

        try {
            if (!process.env.YOUTUBE_API_KEY) {
                return socket.emit('searchError', "Chưa cấu hình API Key!");
            }

            const res = await youtube.search.list({ 
                part: 'snippet', 
                q, 
                maxResults: 5, 
                type: 'video' 
            });

            if (!res.data.items || res.data.items.length === 0) {
                return socket.emit('searchResults', []);
            }

            const ids = res.data.items
                .map(i => i.id.videoId)
                .filter(Boolean)
                .join(',');

            if (!ids) return socket.emit('searchResults', []);

            const vRes = await youtube.videos.list({ 
                part: 'contentDetails,snippet', 
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
            socket.emit('searchError', "Google lỗi: " + e.message);
        }
    });

    // ===== PLAYLIST =====
    socket.on('addToList', async (id) => {
        try {
            const res = await youtube.videos.list({ part: 'snippet', id });
            if (res.data.items[0]) {
                playlist.push({ id, title: res.data.items[0].snippet.title });
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

    // 🔥 FIX PLAY (có lastUpdate)
    socket.on('play', (t) => { 
        roomState.isPlaying = true; 
        roomState.time = t; 
        roomState.lastUpdate = Date.now();
        socket.broadcast.emit('play', t); 
    });

    // 🔥 FIX PAUSE (có lastUpdate)
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

    socket.on('removeVideo', (i) => { 
        playlist.splice(i, 1); 
        io.emit('updatePlaylist', playlist); 
    });

    socket.on('moveVideoToTop', (i) => { 
        playlist.unshift(playlist.splice(i, 1)[0]); 
        io.emit('updatePlaylist', playlist); 
    });

    socket.on('chatMessage', (d) => io.emit('chatMessage', d));

    socket.on('disconnect', () => { 
        delete users[socket.id]; 
        io.emit('updateUserList', Object.values(users)); 
        console.log("❌ Disconnected:", socket.id);
    });
});

server.listen(process.env.PORT || 10000, () => {
    console.log("🚀 Server running");
});
