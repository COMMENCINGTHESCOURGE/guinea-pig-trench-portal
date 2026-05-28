// ------------------- Sprite Loading -------------------
const krakenImg = new Image();
krakenImg.src = '../assets/sprites/kraken_game_render.png';
let krakenLoaded = false;
krakenImg.onload = () => { krakenLoaded = true; };
krakenImg.onerror = () => { krakenLoaded = false; document.body.style.cursor = 'auto'; canvas.style.cursor = 'auto'; };

const mechaImg = new Image();
mechaImg.src = '../assets/sprites/mecha_entity_alpha_v2_pixel.png';
let mechaLoaded = false;
mechaImg.onload = () => { mechaLoaded = true; };
mechaImg.onerror = () => { mechaLoaded = false; };

let mouseX = 0, mouseY = 0;
window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

// ------------------- Setup -------------------
const canvas = document.getElementById('sim');
const ctx = canvas.getContext('2d');
let w,h;
function resize(){ w=canvas.width=window.innerWidth; h=canvas.height=window.innerHeight; }
window.addEventListener('resize', resize); resize();

// ------------------- Constants -------------------
const GRAVITY = 0.45;
const REST_DENSITY = 8;
const SMOOTH_RADIUS = 40;
const PRESSURE_MULT = 160;
const VISCOSITY = 0.12;
const DAMPING = 0.95;
const GRID_SNAP = 20;
const MAX_PARTICLES = 1000; // Can scale higher with caching

const TYPES = {
  WATER:{color:{r:0,g:180,b:255},fluid:true,mass:1,name:"HYDRATION"},
  SAND:{color:{r:255,g:220,b:50},fluid:false,mass:2.5,name:"SEDIMENT"},
  ICE:{color:{r:150,g:255,b:255},fluid:false,mass:0.8,name:"CRYSTAL"},
  VINE:{color:{r:0,g:255,b:100},fluid:false,mass:0,name:"BOTANICAL"} // static
};

const MOODS = {
  CALM:["シ","ツ","∽","∞","∼","░"],
  AGITATED:["҂","Ѫ","⚡","╬","☠","☣"],
  SURPRISE:["°","o","O","!","¡","?"],
  FALLING:["▼","↓","|","l","┃","║"]
};

// ------------------- Helpers -------------------
function rgb(c){ return `rgb(${c.r},${c.g},${c.b})`; }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
function lerp(a,b,t){ return a+(b-a)*t; }
function mixRGB(c1,c2,t){ return {r:Math.round(lerp(c1.r,c2.r,t)), g:Math.round(lerp(c1.g,c2.g,t)), b:Math.round(lerp(c1.b,c2.b,t))}; }

// ------------------- Particle Class -------------------
class Particle{
  constructor(typeName,x,y){ this.init(typeName,x,y); }
  init(typeName,x,y){
    this.typeName=typeName; this.type=TYPES[typeName];
    this.x=x; this.y=y; this.vx=0; this.vy=0;
    this.density=0; this.pressure=0; this.temperature=(typeName==="ICE")?-2:0.5;
    this.life=1.0; this.active=true;
  }
  morph(newType){ this.init(newType,this.x,this.y); if(newType==="VINE"){ this.vx=0; this.vy=0; } }
  update(){
    if(!this.active||this.typeName==="VINE") return;

    // Thermal logic
    if(this.typeName==="ICE"&&this.temperature<0) this.temperature+=0.002;
    if(this.temperature>=0&&this.typeName==="ICE") this.morph("WATER");

    // Sand -> Vine logic
    if(this.typeName==="SAND"&&this.life>2.2&&this.y>h-50){ if(Math.random()<0.005) this.morph("VINE"); }

    // Physics
    if(!this.type.fluid){ 
      this.vy += GRAVITY*this.type.mass;
      this.x += this.vx; this.y += this.vy;
      this.vx*=0.9; this.vy*=0.9;
    } else {
      this.vy += GRAVITY*this.type.mass;
      this.x += this.vx; this.y += this.vy;
      this.vx*=DAMPING; this.vy*=DAMPING;
    }

    // Ground pooling & lateral flow
    if(this.y>=h-10){ this.y=h-10; this.vy=0; if(this.type.fluid){ this.vx+=(Math.random()-0.5)*0.4; this.vx*=0.98; } }
    if(this.x<10||this.x>w-10){ this.vx*=-0.5; this.x=(this.x<10)?10:w-10; }
  }

  draw(){
    if(!this.active) return;
    const sX=Math.floor(this.x/GRID_SNAP)*GRID_SNAP;
    const sY=Math.floor(this.y/GRID_SNAP)*GRID_SNAP;
    const speed=Math.hypot(this.vx,this.vy);

    // Layered water coloring
    let col = this.type.color;
    if(this.typeName==="WATER"){
      const deep={r:10,g:60,b:140}, mid=this.type.color, foam={r:230,g:245,b:255};
      const depthT = clamp((h-this.y)/h,0,1);
      const e = clamp(speed/4,0,1);
      col = mixRGB(mixRGB(deep,mid,depthT),foam,e);
      ctx.shadowBlur=(e>0.35)?10:0; ctx.shadowColor=rgb(col);
    } else { ctx.shadowBlur=0; }

    let glyphs=(this.typeName==="VINE")?["ѱ","ʬ","Y"]:(speed>2.5?MOODS.AGITATED:(this.vy>1.2?MOODS.FALLING:MOODS.CALM));
    ctx.fillStyle=(this.typeName==="SAND"&&this.life>1.8)?"#654321":rgb(col);
    ctx.font='bold 20px monospace';
    ctx.fillText(glyphs[(Math.random()*glyphs.length)|0],sX,sY);
  }
}

// ------------------- Circular Buffer -------------------
let particles=Array.from({length:MAX_PARTICLES},()=>new Particle("WATER",-100,-100));
particles.forEach(p=>p.active=false);
let head=0;
function spawn(type,x,y){ particles[head].init(type,x,y); particles[head].active=true; head=(head+1)%MAX_PARTICLES; }

// ------------------- Physics -------------------
function resolvePhysics(){
  const grid={};
  const active=particles.filter(p=>p.active);

  // Assign to spatial grid
  active.forEach(p=>{
    const key=`${Math.floor(p.x/SMOOTH_RADIUS)},${Math.floor(p.y/SMOOTH_RADIUS)}`;
    if(!grid[key]) grid[key]=[]; grid[key].push(p);
  });

  // Density & pressure
  active.forEach(p=>{
    p.density=0; const gx=Math.floor(p.x/SMOOTH_RADIUS), gy=Math.floor(p.y/SMOOTH_RADIUS);
    for(let i=-1;i<=1;i++){ for(let j=-1;j<=1;j++){
      const neighbors=grid[`${gx+i},${gy+j}`]; if(!neighbors) continue;
      neighbors.forEach(n=>{
        const dx=n.x-p.x, dy=n.y-p.y, dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<SMOOTH_RADIUS){ 
          const q=1-dist/SMOOTH_RADIUS; p.density+=q*q;
          // Reactions
          if(p.typeName==="ICE"&&n.typeName==="WATER") p.temperature+=0.03;
          if(p.typeName==="SAND"&&n.typeName==="WATER"&&p.life<3){ p.life+=0.01; n.active=(n.life-=0.02)>0; }
        }
      });
    }}
    p.pressure=PRESSURE_MULT*(p.density-REST_DENSITY);
  });

  // Force application + collisions
  active.forEach(p=>{
    if(p.typeName==="VINE") return;
    const gx=Math.floor(p.x/SMOOTH_RADIUS), gy=Math.floor(p.y/SMOOTH_RADIUS);
    for(let i=-1;i<=1;i++){ for(let j=-1;j<=1;j++){
      const neighbors=grid[`${gx+i},${gy+j}`]; if(!neighbors) continue;
      neighbors.forEach(n=>{
        if(p===n) return;
        const dx=n.x-p.x, dy=n.y-p.y, dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<SMOOTH_RADIUS&&dist>0){
          const q=1-dist/SMOOTH_RADIUS;
          // Pressure + repulsion
          const force=q*(p.pressure+n.pressure)*0.0015;
          p.vx-=(dx/dist)*force; p.vy-=(dy/dist)*force;
          // Viscosity
          if(p.type.fluid){ p.vx+=(n.vx-p.vx)*VISCOSITY; p.vy+=(n.vy-p.vy)*VISCOSITY; }
          // Hard particle collision
          const minDist=6; if(dist<minDist){
            const overlap=(minDist-dist)*0.5, nx=dx/dist, ny=dy/dist;
            p.x-=nx*overlap; p.y-=ny*overlap; n.x+=nx*overlap; n.y+=ny*overlap;
            const bounce=0.2; p.vx-=nx*bounce; p.vy-=ny*bounce;
          }
          // Lateral spread when compressed
          if(p.density>REST_DENSITY&&p.type.fluid){ p.vx+=(Math.random()-0.5)*0.1; }
        }
      });
    }}
    p.update();
  });
}

// ------------------- Loop -------------------
function loop(){
  ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(0,0,w,h);
  resolvePhysics();
  particles.forEach(p=>p.draw());

  // Draw mecha portrait in top-right corner
  if(mechaLoaded){
    ctx.shadowBlur=0;
    ctx.drawImage(mechaImg, w - 34, 10, 24, 24);
  }

  // Draw kraken tentacle cursor at mouse position
  if(krakenLoaded){
    ctx.shadowBlur=0;
    ctx.drawImage(krakenImg, mouseX - 16, mouseY - 16, 32, 32);
  }

  requestAnimationFrame(loop);
}
loop();

// ------------------- Interaction -------------------
let brushIdx=0;
const BRUSH_NAMES=["WATER","SAND","ICE"];
canvas.addEventListener('mousemove',e=>{ if(e.buttons===1) spawn(BRUSH_NAMES[brushIdx],e.clientX,e.clientY); });
canvas.addEventListener('touchstart',e=>{ e.preventDefault(); for(const t of e.touches) spawn(BRUSH_NAMES[brushIdx],t.clientX,t.clientY); },{passive:false});
canvas.addEventListener('touchmove',e=>{ e.preventDefault(); for(const t of e.touches) spawn(BRUSH_NAMES[brushIdx],t.clientX,t.clientY); },{passive:false});
canvas.addEventListener('wheel',e=>{ e.preventDefault(); brushIdx=(brushIdx+(e.deltaY>0?1:-1)+BRUSH_NAMES.length)%BRUSH_NAMES.length; document.getElementById('brushName').innerText=BRUSH_NAMES[brushIdx]; },{passive:false});

// -- THE THRESHOLD CROSS-POLLINATION (pass 1) --
(function() {
  // Vignette
  var vig = document.createElement('div');
  vig.id = 'threshold-vignette';
  document.body.appendChild(vig);

  // World name
  var wn = document.createElement('div');
  wn.id = 'threshold-world-name';
  wn.textContent = 'VAULT COMPOUND 7';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.6642871590442062;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.017959911856732853;mix-blend-mode:overlay';
  document.body.appendChild(grainCanvas);
  function updateGrain() {
    grainCanvas.width = window.innerWidth;
    grainCanvas.height = window.innerHeight;
    var ctx = grainCanvas.getContext('2d');
    var imageData = ctx.createImageData(grainCanvas.width, grainCanvas.height);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 16) {
      var v = Math.random() * 255;
      data[i] = data[i+1] = data[i+2] = v;
      data[i+3] = 40;
    }
    ctx.putImageData(imageData, 0, 0);
  }
  setInterval(updateGrain, 100);
  updateGrain();
})();

// CHAIN FIX: AUDIO
var _ac;function _tone(f,d,t,v){if(!_ac)_ac=new(AudioContext||webkitAudioContext)();var o=_ac.createOscillator(),g=_ac.createGain();o.type=t||"sine";o.frequency.value=f;o.detune.value=(Math.random()-.5)*8;g.gain.setValueAtTime(v||.08,_ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,_ac.currentTime+(d||.2));o.connect(g);g.connect(_ac.destination);o.start();o.stop(_ac.currentTime+(d||.2))}
function sndClick(){_tone(800,.06,"sine",.06)}
function sndSuccess(){_tone(523,.1);setTimeout(function(){_tone(659,.1)},70);setTimeout(function(){_tone(784,.15,"triangle",.08)},140)}
function sndFail(){_tone(200,.15,"sawtooth",.05)}
document.addEventListener("click",function(){if(!_ac)_ac=new(AudioContext||webkitAudioContext)()},{once:true});

// CHAIN FIX: SCREENSHOT
document.addEventListener("keydown",function(e){if((e.key==="s"||e.key==="S")&&!e.ctrlKey&&!e.metaKey&&!document.pointerLockElement){var c=document.querySelector("canvas");if(!c)return;var url=c.toDataURL("image/png");var a=document.createElement("a");a.href=url;a.download="gpt_"+Date.now()+".png";a.click();if(typeof _tone==="function")_tone(1200,.08,"sine",.05)}});

// CHAIN FIX: MUSIC LINK
setInterval(function(){try{if(parent.AUDIO_BASS!==undefined){window.AUDIO_BASS=parent.AUDIO_BASS;window.AUDIO_MID=parent.AUDIO_MID;window.AUDIO_HIGH=parent.AUDIO_HIGH;window.AUDIO_ENERGY=parent.AUDIO_ENERGY}}catch(e){}},33);

// CHAIN FIX: AUDIO-REACTIVE VISUALS
// The bee delivered the pollen. Now the flower breathes.
(function(){
  var vig = document.getElementById('threshold-vignette');
  var lastBass = 0;
  
  function pulse(){
    requestAnimationFrame(pulse);
    var bass = window.AUDIO_BASS || (parent && parent.AUDIO_BASS) || 0;
    var energy = window.AUDIO_ENERGY || (parent && parent.AUDIO_ENERGY) || 0;
    
    // Smooth the values (no sudden jumps)
    lastBass += (bass - lastBass) * 0.15;
    
    // Vignette breathes with bass (subtle — max 15% intensity change)
    if(vig){
      var intensity = 0.35 + (lastBass / 255) * 0.15;
      vig.style.background = 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,' + intensity.toFixed(3) + '))';
    }
    
    // If there is a canvas, subtly shift its brightness
    // This is the audio-to-visual bridge — the terrain pulses, the walls breathe
    var c = document.querySelector('canvas');
    if(c && energy > 0.01){
      c.style.filter = 'brightness(' + (1 + energy * 0.08).toFixed(3) + ')';
    } else if(c) {
      c.style.filter = '';
    }
  }
  
  // Only start if music link is active
  var checkInterval = setInterval(function(){
    if(window.AUDIO_BASS !== undefined || (parent && parent.AUDIO_BASS !== undefined)){
      clearInterval(checkInterval);
      pulse();
    }
  }, 500);
})();