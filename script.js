require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { google } = require('googleapis');

const app = express();
const server = http.createServer(app);
const io = new Server(server); // Khởi tạo io ngay từ đầu

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

function formatDuration(isoDuration) {
    if(!isoDuration) return "0:00";
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const h = (parseInt(match[1]) || 0), m = (parseInt(match[2]) || 0), s = (parseInt(match[3]) || 0);
    if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m}:${s.toString().padStart(2,'0')}`;
}

io.on('connection', (socket) => {
    socket.on('join', (username) => {
        users[socket.id] = username || `Khách ${socket.id.substring(0,4)}`;
        io.emit('updateUserList', Object.values(users));
    });

    let currentTime = roomState.time;
    if (roomState.isPlaying) currentTime += (Date.now() - roomState.lastUpdate) / 1000;
    socket.emit('initRoom', { videoId: roomState.videoId, time: currentTime, isPlaying: roomState.isPlaying });
    socket.emit('updatePlaylist', playlist);

    socket.on('searchSong', async (query) => {
        try {
            const searchRes = await youtube.search.list({ part: 'snippet', q: query, maxResults: 5, type: 'video' });
            const videoIds = searchRes.data.items.map(i => i.id.videoId).join(',');
            const videoRes = await youtube.videos.list({ part: 'contentDetails,snippet', id: videoIds });
            const results = videoRes.data.items.map(v => ({
                id: v.id, title: v.snippet.title, thumbnail: v.snippet.thumbnails.medium.url,
                author: v.snippet.channelTitle, duration: formatDuration(v.contentDetails.duration)
            }));
            socket.emit('searchResults', results);
        } catch (e) { socket.emit('searchResults', []); }
    });

    socket.on('addToList', async (id) => {
        try {
            const res = await youtube.videos.list({ part: 'snippet', id });
            playlist.push({ id, title: res.data.items[0]?.snippet.title || "Video" });
            io.emit('updatePlaylist', playlist);
        } catch (e) {}
    });

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
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
