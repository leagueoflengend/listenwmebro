require('dotenv').config(); // Đọc API Key từ file .env
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { google } = require('googleapis');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Cấu hình Google YouTube API
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

app.use(express.static(__dirname));

// Dữ liệu phòng và Playlist
let playlist = [];
let roomState = {
    videoId: 'y881t8SK8tE', 
    time: 0,
    isPlaying: false,
    lastUpdate: Date.now()
};

// Hàm hỗ trợ: Chuyển đổi định dạng thời gian YouTube (PT3M45S -> 3:45)
function formatDuration(isoDuration) {
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

io.on('connection', (socket) => {
    // --- TÍNH NĂNG: ĐẾM NGƯỜI ONLINE ---
    io.emit('updateUserCount', io.engine.clientsCount);
    console.log('Một người dùng kết nối. Tổng số:', io.engine.clientsCount);

    // Gửi trạng thái hiện tại cho người mới vào
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

    // --- TÍNH NĂNG: TÌM KIẾM NHẠC (GOOGLE API) ---
    socket.on('searchSong', async (query) => {
        try {
            const searchRes = await youtube.search.list({
                part: 'snippet',
                q: query,
                maxResults: 5,
                type: 'video'
            });
            const videoIds = searchRes.data.items.map(item => item.id.videoId).join(',');
            const videoRes = await youtube.videos.list({
                part: 'contentDetails,snippet',
                id: videoIds
            });

            const results = videoRes.data.items.map(v => ({
                id: v.id,
                title: v.snippet.title,
                thumbnail: v.snippet.thumbnails.medium.url,
                author: v.snippet.channelTitle,
                duration: formatDuration(v.contentDetails.duration)
            }));
            socket.emit('searchResults', results);
        } catch (error) {
            console.error("Lỗi tìm kiếm:", error);
            socket.emit('searchResults', []);
        }
    });

    // --- QUẢN LÝ PLAYLIST ---
    socket.on('addToList', async (videoId) => {
        try {
            const res = await youtube.videos.list({ part: 'snippet', id: videoId });
            const videoTitle = res.data.items[0]?.snippet.title || "Video không xác định";
            playlist.push({ id: videoId, title: videoTitle });
            io.emit('updatePlaylist', playlist);
        } catch (error) {
            console.error("Lỗi lấy thông tin video:", error);
        }
    });

    socket.on('removeVideo', (index) => {
        if (index >= 0 && index < playlist.length) {
            playlist.splice(index, 1);
            io.emit('updatePlaylist', playlist);
        }
    });

    socket.on('moveVideoToTop', (index) => {
        if (index > 0 && index < playlist.length) {
            const item = playlist.splice(index, 1)[0];
            playlist.unshift(item);
            io.emit('updatePlaylist', playlist);
        }
    });

    socket.on('skipVideo', () => {
        if (playlist.length > 0) {
            const nextVideo = playlist.shift();
            updateAndBroadcast(nextVideo.id, 0, true);
            io.emit('changeVideo', nextVideo.id);
            io.emit('updatePlaylist', playlist);
        }
    });

    // --- ĐIỀU KHIỂN ĐỒNG BỘ ---
    function updateAndBroadcast(id, time, isPlaying) {
        roomState.videoId = id || roomState.videoId;
        roomState.time = time;
        roomState.isPlaying = isPlaying;
        roomState.lastUpdate = Date.now();
    }

    socket.on('changeVideo', (videoId) => {
        updateAndBroadcast(videoId, 0, true);
        io.emit('changeVideo', videoId);
    });

    socket.on('play', (time) => {
        updateAndBroadcast(null, time, true);
        socket.broadcast.emit('play', time);
    });

    socket.on('pause', (time) => {
        updateAndBroadcast(null, time || roomState.time, false);
        socket.broadcast.emit('pause');
    });

    socket.on('chatMessage', (data) => {
        io.emit('chatMessage', data);
    });

    socket.on('disconnect', () => {
        io.emit('updateUserCount', io.engine.clientsCount);
        console.log('Người dùng ngắt kết nối. Còn lại:', io.engine.clientsCount);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy tại port ${PORT}`);
});
