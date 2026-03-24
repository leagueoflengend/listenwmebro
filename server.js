const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let playlist = [];

// BỘ NHỚ CỦA SERVER: Lưu lại trạng thái phòng hiện tại
let roomState = {
    videoId: 'bwB9EMpW8eY', // Bài mặc định khi chưa ai bật gì
    time: 0,
    isPlaying: false,
    lastUpdate: Date.now()
};

io.on('connection', (socket) => {
    console.log('Một người dùng đã kết nối:', socket.id);

    // ==========================================
    // ĐỒNG BỘ NGAY LẬP TỨC CHO NGƯỜI VỪA VÀO PHÒNG
    // ==========================================
    let currentTime = roomState.time;
    // Nếu nhạc đang chạy, tính toán bù trừ thời gian trôi qua từ lần cuối cập nhật
    if (roomState.isPlaying) {
        currentTime += (Date.now() - roomState.lastUpdate) / 1000;
    }
    
    // Gửi gói dữ liệu chào mừng chứa thông tin video hiện tại
    socket.emit('initRoom', {
        videoId: roomState.videoId,
        time: currentTime,
        isPlaying: roomState.isPlaying
    });

    // Gửi danh sách phát hiện tại
    socket.emit('updatePlaylist', playlist);

    // ==========================================

    socket.on('chatMessage', (data) => {
        io.emit('chatMessage', data);
    });

    socket.on('addToList', async (videoId) => {
        let videoTitle = `Đang tải tên bài hát... (ID: ${videoId})`; 
        try {
            const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            if (response.ok) {
                const data = await response.json();
                videoTitle = data.title; 
            }
        } catch (error) {
            videoTitle = `Video ID: ${videoId}`; 
        }
        playlist.push({ id: videoId, title: videoTitle });
        io.emit('updatePlaylist', playlist); 
    });

    socket.on('skipVideo', () => {
        if (playlist.length > 0) {
            const nextVideo = playlist.shift(); 
            // Cập nhật bộ nhớ Server
            roomState.videoId = nextVideo.id;
            roomState.time = 0;
            roomState.isPlaying = true;
            roomState.lastUpdate = Date.now();

            io.emit('changeVideo', nextVideo.id);  
            io.emit('updatePlaylist', playlist);
        }
    });

    socket.on('changeVideo', (videoId) => {
        // Cập nhật bộ nhớ Server
        roomState.videoId = videoId;
        roomState.time = 0;
        roomState.isPlaying = true;
        roomState.lastUpdate = Date.now();
        
        io.emit('changeVideo', videoId);
    });

    socket.on('play', (time) => {
        // Cập nhật bộ nhớ Server
        roomState.time = time;
        roomState.isPlaying = true;
        roomState.lastUpdate = Date.now();
        
        socket.broadcast.emit('play', time);
    });

    socket.on('pause', (time) => {
        // Cập nhật bộ nhớ Server
        if (time) roomState.time = time;
        roomState.isPlaying = false;
        roomState.lastUpdate = Date.now();
        
        socket.broadcast.emit('pause');
    });

    socket.on('disconnect', () => {
        console.log('Người dùng ngắt kết nối:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy tại port ${PORT}`);
});
