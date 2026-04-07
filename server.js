require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { google } = require('googleapis');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });

app.use(express.static(__dirname));

let playlist = [];
let users = {};
let roomState = { videoId: null, time: 0, isPlaying: false, lastUpdate: Date.now() };

// Hàm chuyển bài tự động
function playNext() {
    if (playlist.length > 0) {
        const next = playlist.shift();
        roomState = { 
            videoId: next.id, 
            time: 0, 
            isPlaying: true, 
            lastUpdate: Date.now() 
        };
        io.emit("changeVideo", next.id);
        io.emit("updateQueue", playlist);
    } else {
        // Nếu hết bài, đưa trạng thái về trống
        roomState.videoId = null;
        roomState.isPlaying = false;
        io.emit("updateQueue", []);
    }
}

io.on('connection', socket => {
    socket.on("join", name => {
        users[socket.id] = name || "Khách";
        io.emit("updateUserList", Object.values(users));
        
        // Gửi trạng thái hiện tại cho người mới vào
        socket.emit("initRoom", { 
            videoId: roomState.videoId, 
            time: roomState.isPlaying ? roomState.time + (Date.now() - roomState.lastUpdate)/1000 : roomState.time, 
            isPlaying: roomState.isPlaying 
        });
        socket.emit("updateQueue", playlist);
    });

    socket.on("searchSong", async q => {
        try {
            const res = await youtube.search.list({ part: 'snippet', q, maxResults: 5, type: 'video' });
            const results = res.data.items.map(v => ({ 
                id: v.id.videoId, 
                title: v.snippet.title, 
                thumbnail: v.snippet.thumbnails.medium.url 
            }));
            socket.emit("searchResults", results);
        } catch (e) { socket.emit("searchResults", []); }
    });

    socket.on("addToQueue", item => {
        playlist.push(item);
        io.emit("updateQueue", playlist);

        // NẾU PHÒNG ĐANG TRỐNG (Không có videoId), TỰ ĐỘNG PHÁT LUÔN
        if (!roomState.videoId) {
            playNext();
        }
    });

    socket.on("changeVideo", id => {
        roomState = { videoId: id, time: 0, isPlaying: true, lastUpdate: Date.now() };
        io.emit("changeVideo", id);
    });

    socket.on("play", t => { 
        roomState.time = t; 
        roomState.isPlaying = true; 
        roomState.lastUpdate = Date.now(); 
        socket.broadcast.emit("play", t); 
    });

    socket.on("pause", t => { 
        roomState.time = t; 
        roomState.isPlaying = false; 
        socket.broadcast.emit("pause", t); 
    });

    socket.on("skip", () => playNext());
    socket.on("ended", () => playNext()); // Tự động phát tiếp khi kết thúc bài

    socket.on("chatMessage", d => io.emit("chatMessage", d));
    
    socket.on("disconnect", () => {
        delete users[socket.id];
        io.emit("updateUserList", Object.values(users));
    });
});

server.listen(process.env.PORT || 10000);
