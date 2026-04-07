const socket=io();

let name="";
let player;
let syncing=false;

function join(){
    name=document.getElementById("name").value;
    if(!name) return;
    socket.emit("join",name);
    document.getElementById("join").style.display="none";
}

function onYouTubeIframeAPIReady(){
    player=new YT.Player("player",{
        events:{
            onStateChange:e=>{
                if(syncing) return;

                if(e.data===1)
                    socket.emit("play",player.getCurrentTime());

                if(e.data===2)
                    socket.emit("pause",player.getCurrentTime());

                if(e.data===0)
                    socket.emit("ended");
            }
        }
    });
}

// sync
socket.on("initRoom",d=>{
    if(!d.videoId) return;
    load(d.videoId,d.time,d.isPlaying);
});

socket.on("changeVideo",id=>{
    load(id,0,true);
});

function load(id,t,play){
    syncing=true;
    player.loadVideoById({videoId:id,startSeconds:t});
    setTimeout(()=>{
        play?player.playVideo():player.pauseVideo();
        syncing=false;
    },800);
}

// search
function search(){
    socket.emit("searchSong",document.getElementById("search").value);
}

socket.on("searchResults",list=>{
    const r=document.getElementById("results");
    r.innerHTML="";
    list.forEach(v=>{
        const d=document.createElement("div");
        d.className="result";
        d.innerHTML=`<img src="${v.thumbnail}"><div>${v.title}</div>`;
        d.onclick=()=>socket.emit("addToQueue",v);
        r.appendChild(d);
    });
});

// queue
socket.on("updateQueue",list=>{
    const q=document.getElementById("queue");
    q.innerHTML="";
    list.forEach(v=>{
        const d=document.createElement("div");
        d.className="queue-item";
        d.innerHTML=`<img src="${v.thumbnail}"><div>${v.title}</div>`;
        q.appendChild(d);
    });
});

function skip(){
    socket.emit("skip");
}

// chat
function send(){
    let t=document.getElementById("msg").value;
    if(!t) return;

    t=t.replace(/:D/g,"😄");

    socket.emit("chatMessage",{name,message:t});
    document.getElementById("msg").value="";
}

socket.on("chatMessage",d=>{
    const box=document.getElementById("chat");
    const div=document.createElement("div");
    div.className="msg";
    if(d.name===name) div.classList.add("me");

    const time=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});

    div.innerHTML=`<b>${d.name}</b> <small>${time}</small><br>${d.message}`;

    box.appendChild(div);
    box.scrollTop=box.scrollHeight;
});

const tag=document.createElement("script");
tag.src="https://www.youtube.com/iframe_api";
document.body.appendChild(tag);
