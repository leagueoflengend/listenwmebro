const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ĐÃ SỬA Ở ĐÂY: Dùng __dirname để đọc file ngay tại thư mục gốc
app.use(express.static(__dirname));

let playlist = [];

io.on('connection', (socket) => {
    console.log('Một người dùng đã kết nối:', socket.id);

    socket.emit('updatePlaylist', playlist);

    socket.on('addToList', (videoId) => {
        playlist.push(videoId);
        io.emit('updatePlaylist', playlist); 
    });

    socket.on('skipVideo', () => {
        if (playlist.length > 0) {
            const nextVideo = playlist.shift(); 
            io.emit('changeVideo', nextVideo);  
            io.emit('updatePlaylist', playlist);
        }
    });

    socket.on('changeVideo', (videoId) => {
        io.emit('changeVideo', videoId);
    });

    socket.on('play', (time) => socket.broadcast.emit('play', time));
    socket.on('pause', () => socket.broadcast.emit('pause'));

    socket.on('disconnect', () => {
        console.log('Người dùng ngắt kết nối:', socket.id);
    });
});

// ĐÃ SỬA Ở ĐÂY: Tự động nhận Port của Render cấp, nếu test ở máy thì dùng 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy tại port ${PORT}`);
});
