const socket = io();

let name = "";
let player;
let syncing = false;

// emoji
function emoji(t){
    return t.replace(/:D/g,"😄").replace(/:\)/g,"🙂").replace(/:\(/g,"🙁");
}

// join
function join(){
    name = document.getElementById("name").value;
    socket.emit("join", name);
    document.getElementById("join").style.display="none";
}

// youtube
function onYouTubeIframeAPIReady(){
    player = new YT.Player("player", {
        events:{
            onStateChange:e=>{
                if(syncing) return;

                if(e.data===1)
                    socket.emit("play", player.getCurrentTime());

                if(e.data===2)
                    socket.emit("pause", player.getCurrentTime());
            }
        }
    });
}

// sync
socket.on("initRoom", d=>{
    if(!d.videoId) return;
    load(d.videoId,d.time,d.isPlaying);
});

socket.on("changeVideo", id=>{
    load(id,0,true);
});

socket.on("play", t=>{
    syncing=true;
    player.seekTo(t);
    player.playVideo();
    setTimeout(()=>syncing=false,500);
});

socket.on("pause", t=>{
    syncing=true;
    player.seekTo(t);
    player.pauseVideo();
    setTimeout(()=>syncing=false,500);
});

function load(id,t,play){
    syncing=true;
    player.loadVideoById({videoId:id,startSeconds:t});
    setTimeout(()=>{
        play?player.playVideo():player.pauseVideo();
        syncing=false;
    },1000);
}

// search
function search(){
    socket.emit("searchSong", document.getElementById("search").value);
}

socket.on("searchResults", list=>{
    const r=document.getElementById("results");
    r.innerHTML="";
    list.forEach(v=>{
        const d=document.createElement("div");
        d.innerText=v.title;
        d.onclick=()=>socket.emit("changeVideo",v.id);
        r.appendChild(d);
    });
});

// chat FIX
function send(){
    let t=document.getElementById("msg").value;
    if(!t) return;

    t=emoji(t);

    socket.emit("chatMessage",{name,message:t});
    document.getElementById("msg").value="";
}

socket.on("chatMessage", d=>{
    const box=document.getElementById("chat");

    const div=document.createElement("div");
    div.className="msg";
    if(d.name===name) div.classList.add("me");

    const time=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});

    div.innerHTML=`<b>${d.name}</b> <small>${time}</small><br>${d.message}`;

    box.appendChild(div);
    box.scrollTop=box.scrollHeight;
});

// load yt api
const tag=document.createElement("script");
tag.src="https://www.youtube.com/iframe_api";
document.body.appendChild(tag);
