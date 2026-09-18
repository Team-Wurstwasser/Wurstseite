const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let centerX, centerY;
function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    centerX = canvas.width/2;
    centerY = canvas.height/2;
}
window.addEventListener("resize", resize);
resize();

const WORLD_RADIUS = 2100;
const INITIAL_OBJECTS = 42;

const gameState = {
    LEBEN: 42,
    LIEBE: 42,
    MAX: 99,
    counter: 0,
    running: false,
    backgroundBlack: false
};

function clampStatus(){
    gameState.LEBEN = Math.max(0, Math.min(gameState.MAX, gameState.LEBEN));
    gameState.LIEBE = Math.max(0, Math.min(gameState.MAX, gameState.LIEBE));
}

const imageSources = {
    mnf:"/img/games/matheliebsch/Mitternachtsformel.png",
    elefant:"/img/games/matheliebsch/Elefant.png",
    cookie:"/img/games/matheliebsch/Cookie.png",
    schnecke:"/img/games/matheliebsch/Schnecke.png",
    huhn:"/img/games/matheliebsch/Huhn.png",
    traube:"/img/games/matheliebsch/Traube.png",
    kuh:"/img/games/matheliebsch/Kuh.png"
};

const images = Object.fromEntries(
    Object.entries(imageSources).map(([k,s])=>{
        const img=new Image();
        img.src=s;
        return [k,img];
    })
);

const player = {size:142,facing:-1,speed:4.2};
const world = {offsetX:0, offsetY:0, gridSize:42};

let isMoving=false, movementDirectionX=0, movementDirectionY=0;
let counterInterval;

const objects=[];

const itemConfig = {
    cookie:{w:42,h:42,effect:()=>{
        gameState.LEBEN -= 5;
        player.speed *= 0.42;
        clampStatus();
    }},
    schnecke:{w:42,h:42,effect:()=>{
        gameState.LEBEN += 1.42;
        movementDirectionX*=-1;
        movementDirectionY*=-1;
        player.speed *= 1.42;
        clampStatus();
    }},
    huhn:{w:42,h:42,effect:()=>{
        gameState.LEBEN+=5;
        clampStatus();
    }},
    kuh:{w:42,h:42,effect:()=>{
        gameState.LEBEN+=10;
        clampStatus();
    }},
    traube:{w:42,h:42,effect:()=>{
        player.speed*=1.1;
        gameState.LEBEN+=3;
        clampStatus();
    }},
    mnf:{w:168,h:84,effect:()=>{
        gameState.LIEBE+=42;
        clampStatus();
        spawnMNF();
    }}
};

const normalItems=["cookie","schnecke","huhn","traube","kuh"];

const gridCanvas=document.createElement("canvas");
const gridCtx=gridCanvas.getContext("2d");
gridCanvas.width=WORLD_RADIUS*2+200;
gridCanvas.height=WORLD_RADIUS*2+200;

function buildGrid(){
    const s=world.gridSize;
    const cx=gridCanvas.width/2;
    const cy=gridCanvas.height/2;
    gridCtx.clearRect(0,0,gridCanvas.width,gridCanvas.height);
    for(let x=-WORLD_RADIUS;x<=WORLD_RADIUS;x+=s){
        for(let y=-WORLD_RADIUS;y<=WORLD_RADIUS;y+=s){
            const d=Math.hypot(x,y);
            if(d+s*Math.SQRT2/2<=WORLD_RADIUS){
                if((Math.abs(x*73856093 ^ y*19349663)%42)===0){
                    gridCtx.fillStyle="#808080";
                    gridCtx.fillRect(cx+x,cy+y,s,s);
                }
            }
        }
    }
}
buildGrid();

function randomPointInCircle(radius){
    const angle=Math.random()*Math.PI*2;
    const r=Math.sqrt(Math.random())*radius;
    return {x:Math.cos(angle)*r,y:Math.sin(angle)*r};
}

function createRandomObject(){
    const type=normalItems[Math.floor(Math.random()*normalItems.length)];
    const pos=randomPointInCircle(WORLD_RADIUS);
    const {w,h}=itemConfig[type];
    objects.push({x:pos.x,y:pos.y,type,image:images[type],w,h});
}

function spawnObjects(){
    for(let i=0;i<INITIAL_OBJECTS;i++) createRandomObject();
}

function spawnMNF(){
    for(let i=objects.length-1;i>=0;i--) if(objects[i].type==="mnf") objects.splice(i,1);
    const pos=randomPointInCircle(WORLD_RADIUS);
    const {w,h}=itemConfig.mnf;
    objects.push({x:pos.x,y:pos.y,type:"mnf",image:images.mnf,w,h});
}

function setDirectionFromInput(x,y){
    const dx=x-centerX, dy=y-centerY;
    const angle=Math.atan2(dy,dx);
    movementDirectionX=Math.cos(angle);
    movementDirectionY=Math.sin(angle);
    player.facing=movementDirectionX<0?1:-1;
    isMoving=true;
}

canvas.addEventListener("click",e=>{
    if(!gameState.running) startCounter();
    setDirectionFromInput(e.pageX,e.pageY);
});

canvas.addEventListener("touchstart",e=>{
    if(!gameState.running) startCounter();
    e.preventDefault();
    const t=e.touches[0];
    setDirectionFromInput(t.pageX,t.pageY);
},false);

canvas.addEventListener("touchmove",e=>e.preventDefault());
canvas.addEventListener("contextmenu", e => e.preventDefault());

function update(delta){
    if(isMoving){
        const speedFactor=player.speed*(delta/16.666);
        world.offsetX-=movementDirectionX*speedFactor;
        world.offsetY-=movementDirectionY*speedFactor;
        const dist=Math.hypot(world.offsetX,world.offsetY);
        if(dist>WORLD_RADIUS){
            const angle=Math.atan2(world.offsetY,world.offsetX);
            world.offsetX=Math.cos(angle)*WORLD_RADIUS;
            world.offsetY=Math.sin(angle)*WORLD_RADIUS;
        }
    }
    checkCollisions();
}

function checkCollisions(){
    const pr=player.size/2;
    for(let i=objects.length-1;i>=0;i--){
        const o=objects[i];
        const r=Math.max(o.w,o.h)/2;
        const dx=o.x+world.offsetX;
        const dy=o.y+world.offsetY;
        if(dx*dx+dy*dy<(r+pr)**2){
            objects.splice(i,1);
            itemConfig[o.type].effect();
            if(o.type!=="mnf") createRandomObject();
        }
    }
}

function drawGrid(){
    ctx.drawImage(
        gridCanvas,
        centerX-gridCanvas.width/2+world.offsetX,
        centerY-gridCanvas.height/2+world.offsetY
    );
}

function drawBoundary(){
    ctx.beginPath();
    ctx.arc(centerX+world.offsetX,centerY+world.offsetY,WORLD_RADIUS,0,Math.PI*2);
    ctx.strokeStyle="#808080";
    ctx.lineWidth=42;
    ctx.stroke();
}

function drawObjects(){
    for(const o of objects){
        if(!o.image.complete) continue;
        const screenX=centerX+o.x+world.offsetX;
        const screenY=centerY+o.y+world.offsetY;
        if(screenX+o.w<0||screenX-o.w>canvas.width||screenY+o.h<0||screenY-o.h>canvas.height) continue;
        ctx.drawImage(o.image,screenX-o.w/2,screenY-o.h/2,o.w,o.h);
    }
}

function drawPlayer(){
    if(!images.elefant.complete) return;
    ctx.save();
    ctx.translate(centerX,centerY);
    ctx.scale(player.facing,1);
    ctx.drawImage(images.elefant,-player.size/2,-player.size/2,player.size,player.size);
    ctx.restore();
}

function drawPlayerLives(){
    ctx.save();
    ctx.font = "1rem 'Latin Modern Mono', monospace";
    ctx.fillStyle = "#000";

	ctx.fillText(gameState.LIEBE.toFixed(0), centerX-9+19*player.facing, centerY-28);
	ctx.fillText(gameState.LEBEN.toFixed(0), centerX-8-5*player.facing, centerY+42);
    	
    ctx.restore();
}

function startCounter(){
    if(gameState.running) return;
    gameState.running=true;
    counterInterval=setInterval(()=>{
        gameState.counter++;
        if(gameState.LEBEN>0&&gameState.LIEBE>0){
            gameState.LEBEN-=1;
            gameState.LIEBE-=0.2;
            clampStatus();
        }else{
            gameState.LEBEN=0;
            gameState.LIEBE=0;
            player.size=100;
            clearInterval(counterInterval);
            alert("Zeit überlebt: "+gameState.counter+" Sekunden");
            window.location.href="games/matheliebsch.html";
        }
    },1000);

    setInterval(() => { 
        gameState.backgroundBlack = !gameState.backgroundBlack; 
    }, 42000);
}

function render(){
    ctx.fillStyle=gameState.backgroundBlack?"#000":"#fff";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    drawGrid();
    drawObjects();
    drawBoundary();
    drawPlayer();
    drawPlayerLives();
}

let last=0;
function loop(timestamp){
    const delta=timestamp-last;
    last=timestamp;
    update(delta);
    render();
    requestAnimationFrame(loop);
}

spawnObjects();
spawnMNF();
requestAnimationFrame(loop);
