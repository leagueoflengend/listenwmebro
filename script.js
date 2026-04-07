require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { google } = require('googleapis');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

app.use(express.static(__dirname));

let playlist = [];
let users = {};
let roomState = {
    videoId: null,
    time: 0,
    isPlaying: false,
    lastUpdate: Date.now()
};

function getCurrentTime() {
    if (!roomState.isPlaying) return roomState.time;
    return roomState.time + (Date.now() - roomState.lastUpdate) / 1000;
}

io.on('connection', (socket) => {

    socket.on('join', (name) => {
        users[socket.id] = name || "Khách";
        io.emit('updateUserList', Object.values(users));

        socket.emit('initRoom', {
            videoId: roomState.videoId,
            time: getCurrentTime(),
            isPlaying: roomState.isPlaying
        });

        socket.emit('updatePlaylist', playlist);
    });

    socket.on('searchSong', async (q) => {
        try {
            const res = await youtube.search.list({
                part: 'snippet',
                q,
                maxResults: 5,
                type: 'video'
            });

            const ids = res.data.items.map(i => i.id.videoId).join(',');

            const vRes = await youtube.videos.list({
                part: 'contentDetails,snippet',
                id: ids
            });

            const results = vRes.data.items.map(v => ({
                id: v.id,
                title: v.snippet.title,
                thumbnail: v.snippet.thumbnails.medium.url,
                author: v.snippet.channelTitle,
                duration: v.contentDetails.duration
            }));

            socket.emit('searchResults', results);
        } catch (e) {
            socket.emit('searchError', e.message);
        }
    });

    // 🔥 AUTO PLAY LOGIC
    socket.on('addToList', async (id) => {
        const res = await youtube.videos.list({ part: 'snippet', id });

        if (!res.data.items[0]) return;

        const video = {
            id,
            title: res.data.items[0].snippet.title
        };

        // 👉 nếu chưa có gì phát → phát luôn
        if (!roomState.videoId) {
            roomState = {
                videoId: id,
                time: 0,
                isPlaying: true,
                lastUpdate: Date.now()
            };
            io.emit('changeVideo', id);
        } else {
            // 👉 đang phát → thêm vào queue
            playlist.push(video);
            io.emit('updatePlaylist', playlist);
        }
    });

    socket.on('changeVideo', (id) => {
        roomState = {
            videoId: id,
            time: 0,
            isPlaying: true,
            lastUpdate: Date.now()
        };
        io.emit('changeVideo', id);
    });

    socket.on('play', (t) => {
        roomState.isPlaying = true;
        roomState.time = t;
        roomState.lastUpdate = Date.now();
        socket.broadcast.emit('play', t);
    });

    socket.on('pause', (t) => {
        roomState.isPlaying = false;
        roomState.time = t;
        roomState.lastUpdate = Date.now();
        socket.broadcast.emit('pause');
    });

    socket.on('skipVideo', () => {
        if (playlist.length > 0) {
            const next = playlist.shift();
            roomState = {
                videoId: next.id,
                time: 0,
                isPlaying: true,
                lastUpdate: Date.now()
            };
            io.emit('changeVideo', next.id);
            io.emit('updatePlaylist', playlist);
        } else {
            roomState.videoId = null;
            roomState.isPlaying = false;
        }
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('updateUserList', Object.values(users));
    });
});

server.listen(process.env.PORT || 10000);
