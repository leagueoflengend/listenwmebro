require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // Khai báo thư viện
const { google } = require('googleapis');

const app = express();
const server = http.createServer(app);
const io = new Server(server); // ĐỊNH NGHĨA io Ở ĐÂY TRƯỚC KHI DÙNG

// Cấu hình Google YouTube API
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

app.use(express.static(__dirname));

// Dữ liệu phòng
let playlist = [];
let users = {}; // Lưu danh sách user online
let roomState = {
    videoId: 'y881t8SK8tE', 
    time: 0,
    isPlaying: false,
    lastUpdate: Date.now()
};

// Hàm helper đổi thời gian
function formatDuration(isoDuration) {
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// BẮT ĐẦU DÙNG io TỪ ĐÂY
io.on('connection', (socket) => {
    // Khi có người mới vào và nhập tên
    socket.on('join', (username) => {
        users[socket.id] = username || `Khách ${socket.id.substring(0,4)}`;
        io.emit('updateUserList', Object.values(users));
        console.log(`${users[socket.id]} đã tham gia.`);
    });

    // Gửi trạng thái hiện tại
    let currentTime = roomState.time;
    if (roomState.isPlaying) currentTime += (Date.now() - roomState.lastUpdate) / 1000;
    socket.emit('initRoom', { videoId: roomState.videoId, time: currentTime, isPlaying: roomState.isPlaying });
    socket.emit('updatePlaylist', playlist);

    // Xử lý tìm kiếm
    socket.on('searchSong', async (query) => {
        try {
            const searchRes = await youtube.search.list({ part: 'snippet', q: query, maxResults: 5, type: 'video' });
            const videoIds = searchRes.data.items.map(item => item.id.videoId).join(',');
            const videoRes = await youtube.videos.list({ part: 'contentDetails,snippet', id: videoIds });
            const results = videoRes.data.items.map(v => ({
                id: v.id, title: v.snippet.title, thumbnail: v.snippet.thumbnails.medium.url,
                author: v.snippet.channelTitle, duration: formatDuration(v.contentDetails.duration)
            }));
            socket.emit('searchResults', results);
        } catch (error) { socket.emit('searchResults', []); }
    });

    socket.on('addToList', async (videoId) => {
        try {
            const res = await youtube.videos.list({ part: 'snippet', id: videoId });
            playlist.push({ id: videoId, title: res.data.items[0]?.snippet.title || "Video" });
            io.emit('updatePlaylist', playlist);
        } catch (e) { console.log(e); }
    });

    socket.on('changeVideo', (videoId) => {
        roomState = { videoId, time: 0, isPlaying: true, lastUpdate: Date.now() };
        io.emit('changeVideo', videoId);
    });

    socket.on('play', (time) => {
        roomState.isPlaying = true; roomState.time = time; roomState.lastUpdate = Date.now();
        socket.broadcast.emit('play', time);
    });

    socket.on('pause', (time) => {
        roomState.isPlaying = false; roomState.time = time; roomState.lastUpdate = Date.now();
        socket.broadcast.emit('pause');
    });

    socket.on('skipVideo', () => {
        if (playlist.length > 0) {
            const next = playlist.shift();
            roomState = { videoId: next.id, time: 0, isPlaying: true, lastUpdate: Date.now() };
            io.emit('changeVideo', next.id);
            io.emit('updatePlaylist', playlist);
        }
    });

    socket.on('removeVideo', (idx) => { playlist.splice(idx, 1); io.emit('updatePlaylist', playlist); });
    socket.on('moveVideoToTop', (idx) => { const item = playlist.splice(idx, 1)[0]; playlist.unshift(item); io.emit('updatePlaylist', playlist); });
    socket.on('chatMessage', (data) => io.emit('chatMessage', data));

    socket.on('disconnect', () => {
        if (users[socket.id]) {
            delete users[socket.id];
            io.emit('updateUserList', Object.values(users));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server đang chạy tại port ${PORT}`));
