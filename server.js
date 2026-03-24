const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let playlist = [];

let roomState = {
    videoId: 'y881t8SK8tE', 
    time: 0,
    isPlaying: false,
    lastUpdate: Date.now()
};

io.on('connection', (socket) => {
    console.log('Một người dùng đã kết nối:', socket.id);

    let currentTime = roomState.time;
    if (roomState.isPlaying) {
        currentTime += (Date.now() - roomState.lastUpdate) / 1000;
    }
    
    socket.emit('initRoom', {
        videoId: roomState.videoId,
        time: currentTime,
        isPlaying: roomState.isPlaying
    });

    socket.emit('updatePlaylist', playlist);

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

    // ==========================================
    // TÍNH NĂNG MỚI: XÓA VÀ ĐƯA LÊN ĐẦU
    // ==========================================
    socket.on('removeVideo', (index) => {
        if (index >= 0 && index < playlist.length) {
            playlist.splice(index, 1); // Xóa 1 bài tại vị trí index
            io.emit('updatePlaylist', playlist);
        }
    });

    socket.on('moveVideoToTop', (index) => {
        if (index > 0 && index < playlist.length) {
            const item = playlist.splice(index, 1)[0]; // Rút bài đó ra
            playlist.unshift(item); // Nhét lên đầu danh sách
            io.emit('updatePlaylist', playlist);
        }
    });
    // ==========================================

    socket.on('skipVideo', () => {
        if (playlist.length > 0) {
            const nextVideo = playlist.shift(); 
            
            roomState.videoId = nextVideo.id;
            roomState.time = 0;
            roomState.isPlaying = true;
            roomState.lastUpdate = Date.now();

            io.emit('changeVideo', nextVideo.id);  
            io.emit('updatePlaylist', playlist);
        }
    });

    socket.on('changeVideo', (videoId) => {
        roomState.videoId = videoId;
        roomState.time = 0;
        roomState.isPlaying = true;
        roomState.lastUpdate = Date.now();
        
        io.emit('changeVideo', videoId);
    });

    socket.on('play', (time) => {
        roomState.time = time;
        roomState.isPlaying = true;
        roomState.lastUpdate = Date.now();
        
        socket.broadcast.emit('play', time);
    });

    socket.on('pause', (time) => {
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
