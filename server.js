require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { google } = require('googleapis');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Cấu hình YouTube API
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

app.use(express.static(__dirname));

// --- QUẢN LÝ DỮ LIỆU PHÒNG ---
let users = {};
let playlist = [];
let roomState = {
    videoId: null,
    time: 0,
    isPlaying: false,
    lastUpdate: Date.now()
};

// Hàm tính thời gian thực tế đang phát
function getTime() {
    if (!roomState.isPlaying) return roomState.time;
    return roomState.time + (Date.now() - roomState.lastUpdate) / 1000;
}

// Hàm hỗ trợ format thời gian YouTube (ISO 8601 sang 0:00)
function formatDuration(iso) {
    if (!iso || iso === 'P0D') return "Live";
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return "0:00";
    const h = (parseInt(m[1]) || 0);
    const min = (parseInt(m[2]) || 0);
    const s = (parseInt(m[3]) || 0);
    if (h > 0) return `${h}:${min.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${min}:${s.toString().padStart(2, '0')}`;
}

// --- LOGIC PHÁT BÀI TIẾP THEO ---
function playNext() {
    if (playlist.length === 0) {
        roomState.videoId = null;
        roomState.isPlaying = false;
        io.emit("status", "Hết bài trong hàng đợi");
        return;
    }

    const next = playlist.shift();
    roomState = {
        videoId: next.id,
        time: 0,
        isPlaying: true,
        lastUpdate: Date.now()
    };

    io.emit("changeVideo", next.id);
    io.emit("updatePlaylist", playlist);
}

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {

    socket.on("join", (name) => {
        const username = name || "Khách";
        users[socket.id] = username;

        // Gửi trạng thái phòng cho người mới
        socket.emit("initRoom", {
            videoId: roomState.videoId,
            time: getTime(),
            isPlaying: roomState.isPlaying
        });

        socket.emit("updatePlaylist", playlist);
        
        // Thông báo cho mọi người
        io.emit("users", Object.values(users));
        io.emit("chatMessage", { 
            name: "Hệ thống", 
            message: `👋 ${username} đã tham gia phòng.` 
        });
    });

    // Chat
    socket.on("chatMessage", (data) => {
        io.emit("chatMessage", data);
    });

    // Tìm kiếm (Nâng cao: Lấy thêm Duration)
    socket.on("searchSong", async (q) => {
        try {
            if (!process.env.YOUTUBE_API_KEY) {
                return console.log("Lỗi: Thiếu API KEY trong .env");
            }

            const res = await youtube.search.list({
                part: 'snippet',
                q,
                maxResults: 5,
                type: 'video'
            });

            const ids = res.data.items.map(v => v.id.videoId).join(',');
            if(!ids) return socket.emit("searchResults", []);

            // Lấy thêm chi tiết thời lượng
            const detailRes = await youtube.videos.list({
                part: 'contentDetails,snippet',
                id: ids
            });

            const results = detailRes.data.items.map(v => ({
                id: v.id,
                title: v.snippet.title,
                thumbnail: v.snippet.thumbnails.medium.url,
                author: v.snippet.channelTitle,
                duration: formatDuration(v.contentDetails.duration)
            }));

            socket.emit("searchResults", results);
        } catch (e) {
            console.log("YouTube Search Error:", e.message);
            socket.emit("searchResults", []);
        }
    });

    // Thêm vào hàng chờ
    socket.on("addToList", async (id) => {
        // Tránh trùng bài đang phát
        if (roomState.videoId === id) return;
        // Tránh trùng trong hàng đợi
        if (playlist.find(v => v.id === id)) return;

        try {
            const res = await youtube.videos.list({ part: 'snippet,thumbnails', id });
            const v = res.data.items[0];
            if (!v) return;

            const item = {
                id: v.id,
                title: v.snippet.title,
                thumbnail: v.snippet.thumbnails.medium.url
            };

            if (!roomState.videoId) {
                // Nếu phòng đang trống thì phát luôn
                roomState = {
                    videoId: item.id,
                    time: 0,
                    isPlaying: true,
                    lastUpdate: Date.now()
                };
                io.emit("changeVideo", item.id);
            } else {
                playlist.push(item);
                io.emit("updatePlaylist", playlist);
            }
        } catch (e) {
            console.log(e);
        }
    });

    // Xóa bài khỏi hàng chờ
    socket.on("removeVideo", (index) => {
        if (playlist[index]) {
            playlist.splice(index, 1);
            io.emit("updatePlaylist", playlist);
        }
    });

    // Đưa bài lên đầu hàng chờ (Ưu tiên)
    socket.on("moveVideoToTop", (index) => {
        if (playlist[index]) {
            const item = playlist.splice(index, 1)[0];
            playlist.unshift(item);
            io.emit("updatePlaylist", playlist);
        }
    });

    // Skip bài
    socket.on("skipVideo", () => {
        playNext();
    });

    // Đồng bộ trạng thái (Play/Pause)
    socket.on("play", (t) => {
        roomState.time = t;
        roomState.isPlaying = true;
        roomState.lastUpdate = Date.now();
        socket.broadcast.emit("play", t);
    });

    socket.on("pause", (t) => {
        roomState.time = t;
        roomState.isPlaying = false;
        socket.broadcast.emit("pause", t);
    });

    socket.on("ended", () => {
        playNext();
    });

    // Ngắt kết nối
    socket.on("disconnect", () => {
        const username = users[socket.id];
        delete users[socket.id];
        io.emit("users", Object.values(users));
        if (username) {
            io.emit("chatMessage", { 
                name: "Hệ thống", 
                message: `🚶 ${username} đã rời phòng.` 
            });
        }
    });
});

// Port cho Render hoặc Localhost
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 Music Room Server is running on port ${PORT}`);
});
