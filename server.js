const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Biến lưu trữ danh sách phát chung cho cả phòng
let playlist = [];

io.on('connection', (socket) => {
    console.log('Một người dùng đã kết nối:', socket.id);

    // Vừa vào phòng là gửi ngay danh sách phát hiện tại cho người đó
    socket.emit('updatePlaylist', playlist);

    // 1. Thêm video vào danh sách
    socket.on('addToList', (videoId) => {
        playlist.push(videoId);
        io.emit('updatePlaylist', playlist); // Báo cho cả phòng cập nhật UI
    });

    // 2. Chuyển bài (Skip)
    socket.on('skipVideo', () => {
        if (playlist.length > 0) {
            const nextVideo = playlist.shift(); // Lấy bài đầu tiên ra khỏi danh sách
            io.emit('changeVideo', nextVideo);  // Phát bài đó
            io.emit('updatePlaylist', playlist);// Cập nhật lại danh sách cho cả phòng
        }
    });

    // 3. Đổi video trực tiếp (Bỏ qua danh sách)
    socket.on('changeVideo', (videoId) => {
        io.emit('changeVideo', videoId);
    });

    // 4. Đồng bộ Play/Pause
    socket.on('play', (time) => socket.broadcast.emit('play', time));
    socket.on('pause', () => socket.broadcast.emit('pause'));

    socket.on('disconnect', () => {
        console.log('Người dùng ngắt kết nối:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});