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

let playlist = [];
let users = {}; 
let roomState = {
    videoId: 'y881t8SK8tE', 
    time: 0,
    isPlaying: false,
    lastUpdate: Date.now()
};

function formatDuration(iso) {
    if(!iso) return "0:00";
    const m = iso.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const h = (parseInt(m[1]) || 0), min = (parseInt(m[2]) || 0), s = (parseInt(m[3]) || 0);
    if (h > 0) return `${h}:${min.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${min}:${s.toString().padStart(2,'0')}`;
}

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        users[socket.id] = name || `Khách ${socket.id.substring(0,4)}`;
        io.emit('updateUserList', Object.values(users));
    });

    let currentT = roomState.time;
    if (roomState.isPlaying) currentT += (Date.now() - roomState.lastUpdate) / 1000;
    socket.emit('initRoom', { videoId: roomState.videoId, time: currentT, isPlaying: roomState.isPlaying });
    socket.emit('updatePlaylist', playlist);

    // LOGIC TÌM KIẾM
    socket.on('searchSong', async (q) => {
        try {
            const res = await youtube.search.list({ part: 'snippet', q, maxResults: 5, type: 'video' });
            const ids = res.data.items.map(i => i.id.videoId).filter(id => id).join(',');
            if (!ids) return socket.emit('searchResults', []);

            const vRes = await youtube.videos.list({ part: 'contentDetails,snippet', id: ids });
            const results = vRes.data.items.map(v => ({
                id: v.id, title: v.snippet.title, thumbnail: v.snippet.thumbnails.medium.url,
                author: v.snippet.channelTitle, duration: formatDuration(v.contentDetails.duration)
            }));
            socket.emit('searchResults', results);
        } catch (e) {
            console.error("LỖI API YOUTUBE:", e.message); // Kiểm tra lỗi này ở tab Logs trên Render
            socket.emit('searchResults', []);
        }
    });

    // CHỈ THÊM VÀO DANH SÁCH, KHÔNG PHÁT
    socket.on('addToList', async (id) => {
        try {
            const res = await youtube.videos.list({ part: 'snippet', id });
            const video = res.data.items[0];
            if (video) {
                playlist.push({ id, title: video.snippet.title });
                io.emit('updatePlaylist', playlist);
                // Gửi thông báo nhỏ cho người dùng
                socket.emit('chatMessage', { name: "Hệ thống", message: `Đã thêm [${video.snippet.title}] vào hàng chờ.` });
            }
        } catch (e) {}
    });

    // CHỈ PHÁT KHI BẤM "PHÁT LINK" HOẶC SKIP
    socket.on('changeVideo', (videoId) => {
        roomState = { videoId, time: 0, isPlaying: true, lastUpdate: Date.now() };
        io.emit('changeVideo', videoId);
    });

    socket.on('play', (t) => { roomState.isPlaying = true; roomState.time = t; roomState.lastUpdate = Date.now(); socket.broadcast.emit('play', t); });
    socket.on('pause', (t) => { roomState.isPlaying = false; roomState.time = t; roomState.lastUpdate = Date.now(); socket.broadcast.emit('pause'); });
    
    socket.on('skipVideo', () => {
        if (playlist.length > 0) {
            const next = playlist.shift();
            roomState = { videoId: next.id, time: 0, isPlaying: true, lastUpdate: Date.now() };
            io.emit('changeVideo', next.id);
            io.emit('updatePlaylist', playlist);
        }
    });

    socket.on('removeVideo', (i) => { playlist.splice(i, 1); io.emit('updatePlaylist', playlist); });
    socket.on('moveVideoToTop', (i) => { playlist.unshift(playlist.splice(i, 1)[0]); io.emit('updatePlaylist', playlist); });
    socket.on('chatMessage', (d) => io.emit('chatMessage', d));
    socket.on('disconnect', () => { delete users[socket.id]; io.emit('updateUserList', Object.values(users)); });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server chạy tại port ${PORT}`));
