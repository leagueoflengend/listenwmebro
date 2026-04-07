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

let users = {};
let playlist = [];

let roomState = {
    videoId: null,
    time: 0,
    isPlaying: false,
    lastUpdate: Date.now()
};

function getTime(){
    if(!roomState.isPlaying) return roomState.time;
    return roomState.time + (Date.now()-roomState.lastUpdate)/1000;
}

// ===== PLAY NEXT =====
function playNext(){
    if(playlist.length===0){
        roomState.videoId=null;
        return;
    }

    const next=playlist.shift();

    roomState={
        videoId: next.id,
        time:0,
        isPlaying:true,
        lastUpdate:Date.now()
    };

    io.emit("changeVideo", next.id);
    io.emit("updateQueue", playlist);
}

// ===== SOCKET =====
io.on('connection', socket=>{

    socket.on("join", name=>{
        users[socket.id]=name || "Khách";

        socket.emit("initRoom",{
            videoId:roomState.videoId,
            time:getTime(),
            isPlaying:roomState.isPlaying
        });

        socket.emit("updateQueue", playlist);
        io.emit("users", Object.values(users));
    });

    // ===== CHAT =====
    socket.on("chatMessage", d=>{
        io.emit("chatMessage", d);
    });

    // ===== SEARCH =====
    socket.on("searchSong", async q=>{
        try{
            const res=await youtube.search.list({
                part:'snippet',
                q,
                maxResults:5,
                type:'video'
            });

            const results=res.data.items.map(v=>({
                id:v.id.videoId,
                title:v.snippet.title,
                thumbnail:v.snippet.thumbnails.medium.url
            }));

            socket.emit("searchResults", results);
        }catch(e){
            console.log(e);
        }
    });

    // ===== ADD QUEUE =====
    socket.on("addToQueue", item=>{

        // tránh trùng
        if(roomState.videoId===item.id) return;
        if(playlist.find(v=>v.id===item.id)) return;

        if(!roomState.videoId){
            roomState={
                videoId:item.id,
                time:0,
                isPlaying:true,
                lastUpdate:Date.now()
            };

            io.emit("changeVideo", item.id);
        }else{
            playlist.push(item);
            io.emit("updateQueue", playlist);
        }
    });

    // ===== SKIP =====
    socket.on("skip", ()=>{
        playNext();
    });

    // ===== SYNC =====
    socket.on("play", t=>{
        roomState.time=t;
        roomState.isPlaying=true;
        roomState.lastUpdate=Date.now();
        socket.broadcast.emit("play", t);
    });

    socket.on("pause", t=>{
        roomState.time=t;
        roomState.isPlaying=false;
        socket.broadcast.emit("pause", t);
    });

    socket.on("ended", ()=>{
        playNext();
    });

    socket.on("disconnect", ()=>{
        delete users[socket.id];
        io.emit("users", Object.values(users));
    });
});

server.listen(process.env.PORT || 10000);
