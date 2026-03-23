const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// Danh sách giờ sẽ chứa cả Tên bài và ID
let playlist = [];

io.on('connection', (socket) => {
    console.log('Một người dùng đã kết nối:', socket.id);

    socket.emit('updatePlaylist', playlist);

    socket.on('chatMessage', (data) => {
        io.emit('chatMessage', data);
    });

    // ==========================================
    // TỰ ĐỘNG LẤY TÊN BÀI HÁT TỪ YOUTUBE
    // ==========================================
    socket.on('addToList', async (videoId) => {
        let videoTitle = `Đang tải tên bài hát... (ID: ${videoId})`; 
        
        try {
            // Dùng API miễn phí của YouTube để lấy tên video
            const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            if (response.ok) {
                const data = await response.json();
                videoTitle = data.title; // Lấy được tên bài rồi!
            }
        } catch (error) {
            console.log("Lỗi mạng, không lấy được tên.");
            videoTitle = `Video ID: ${videoId}`; // Nếu lỗi thì hiện ID chữa cháy
        }
        
        // Thêm vào danh sách cả ID lẫn Tên
        playlist.push({ id: videoId, title: videoTitle });
        io.emit('updatePlaylist', playlist); 
    });

    socket.on('skipVideo', () => {
        if (playlist.length > 0) {
            const nextVideo = playlist.shift(); 
            // Phát bài tiếp theo (chỉ cần gửi ID cho trình duyệt)
            io.emit('changeVideo', nextVideo.id);  
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy tại port ${PORT}`);
});
