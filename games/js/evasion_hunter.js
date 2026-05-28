const canvas=document.getElementById("c"),ctx=canvas.getContext("2d");let W,H;function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight}resize();addEventListener("resize",resize);
const FRICTION=.955,BASE_THRUST=.55,BASE_MISSILE_SPD=4.2,BASE_TURN_RATE=.14,BASE_FIRE_DELAY=900,BASE_HOMING=.075,AI_MAX_SPD=5.8,ORBIT_DIST=240,ATTACK_DIST=440,HIT_RADIUS=22,SHIP_HIT_RADIUS=30,EDGE_PAD=50,THREAT_LEVELS=["α","β","γ","δ","Ω"],THREAT_LABELS=["ALPHA","BETA","GAMMA","DELTA","OMEGA"];
let mouse={x:W/2,y:H/2,vx:0,vy:0},best=parseFloat(localStorage.getItem("evasion_best")||"0"),gameState="INTRO",startTime=0,elapsed=0,flashAlpha=0,bonusFlash=0,particles=[],missiles=[],ship=null,shipKills=0,respawnAt=0;const RESPAWN_DELAY=2200,KILL_BONUS=5;
document.getElementById("bestDisplay").textContent=best.toFixed(1)+"s";if(best>0)document.getElementById("ov-best").textContent="RECORD: "+best.toFixed(1)+"s";
function difficultyAt(t){const tier=Math.min(4,Math.floor(t/15)),ramp=Math.min(1,(t-tier*15)/15);return{tier,ramp,thrust:BASE_THRUST+t*.006,missileSPD:BASE_MISSILE_SPD+t*.018,turnRate:BASE_TURN_RATE+t*.0008,fireDelay:Math.max(300,BASE_FIRE_DELAY-t*12),homing:Math.min(.18,BASE_HOMING+t*.0006),maxMissiles:1+Math.floor(t/20),maxSpd:AI_MAX_SPD+t*.02}}
class Particle{constructor(x,y,vx,vy,color,life=1,size=2){this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.color=color;this.life=life;this.maxLife=life;this.size=size}update(dt){this.x+=this.vx*dt*60;this.y+=this.vy*dt*60;this.vx*=.96;this.vy*=.96;this.life-=dt*1.4;return this.life>0}draw(){const a=this.life/this.maxLife;ctx.globalAlpha=a*.85;ctx.fillStyle=this.color;ctx.beginPath();ctx.arc(this.x,this.y,this.size*(.4+.6*a),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1}}
function burst(x,y,color,count=20,spd=3){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=spd*(.3+Math.random()*.7);particles.push(new Particle(x,y,Math.cos(a)*s,Math.sin(a)*s,color,.7+Math.random()*.5,1.5+Math.random()*2))}}
function trailPuff(x,y,color){const a=Math.random()*Math.PI*2;particles.push(new Particle(x,y,Math.cos(a)*.4,Math.sin(a)*.4,color,.35,1.5))}
class Missile{constructor(x,y,angle,spd,homing){this.x=x;this.y=y;this.spawnX=x;this.spawnY=y;this.vx=Math.cos(angle)*spd;this.vy=Math.sin(angle)*spd;this.spd=spd;this.homing=homing;this.armed=false;this.armDist=130;this.bounces=0;this.maxBounces=3;this.alive=true;this.age=0;this.trail=[]}update(dt,mx,my,mvx,mvy){this.age+=dt;if(!this.armed){const ex=this.x-this.spawnX,ey=this.y-this.spawnY;if(ex*ex+ey*ey>this.armDist*this.armDist)this.armed=true}if(this.armed){const dx=mx-this.x,dy=my-this.y,dist=Math.sqrt(dx*dx+dy*dy)||1,lf=Math.min(.9,dist/800)*.85,tx=mx+mvx*lf*(dist/this.spd),ty=my+mvy*lf*(dist/this.spd),tdx=tx-this.x,tdy=ty-this.y,tlen=Math.sqrt(tdx*tdx+tdy*tdy)||1;this.vx+=(tdx/tlen*this.spd-this.vx)*this.homing;this.vy+=(tdy/tlen*this.spd-this.vy)*this.homing}const cs=Math.sqrt(this.vx*this.vx+this.vy*this.vy)||1;this.vx=this.vx/cs*this.spd;this.vy=this.vy/cs*this.spd;this.trail.push({x:this.x,y:this.y});if(this.trail.length>18)this.trail.shift();this.x+=this.vx*dt*60;this.y+=this.vy*dt*60;if(this.x<EDGE_PAD){this.vx=Math.abs(this.vx);this.x=EDGE_PAD;this.bounces++}if(this.x>W-EDGE_PAD){this.vx=-Math.abs(this.vx);this.x=W-EDGE_PAD;this.bounces++}if(this.y<EDGE_PAD){this.vy=Math.abs(this.vy);this.y=EDGE_PAD;this.bounces++}if(this.y>H-EDGE_PAD){this.vy=-Math.abs(this.vy);this.y=H-EDGE_PAD;this.bounces++}if(this.bounces>=this.maxBounces){burst(this.x,this.y,"#ff4422",12,2.5);this.alive=false}}checkHit(mx,my){const dx=this.x-mx,dy=this.y-my;return dx*dx+dy*dy<HIT_RADIUS*HIT_RADIUS}draw(){for(let i=0;i<this.trail.length;i++){const t=i/this.trail.length;ctx.globalAlpha=t*.38;const hue=this.armed?10+t*20:190+t*30;ctx.fillStyle=`hsl(${hue},100%,65%)`;ctx.beginPath();ctx.arc(this.trail[i].x,this.trail[i].y,1.2+t*1.8,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;const grd=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,10);grd.addColorStop(0,"rgba(255,80,40,0.5)");grd.addColorStop(1,"rgba(255,40,0,0)");ctx.fillStyle=grd;ctx.beginPath();ctx.arc(this.x,this.y,10,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ff3322";ctx.beginPath();ctx.arc(this.x,this.y,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(255,120,60,0.7)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(this.x,this.y,8,0,Math.PI*2);ctx.stroke()}}
class Ship{constructor(){const side=Math.floor(Math.random()*4);if(side===0){this.x=W*.25+Math.random()*W*.5;this.y=-60}else if(side===1){this.x=W+60;this.y=H*.25+Math.random()*H*.5}else if(side===2){this.x=W*.25+Math.random()*W*.5;this.y=H+60}else{this.x=-60;this.y=H*.25+Math.random()*H*.5}this.vx=0;this.vy=0;this.angle=0;this.lastShot=0;this.enginePhase=0;this.warningFlash=0}update(dt,now,diff){const mx=mouse.x,my=mouse.y,dx=mx-this.x,dy=my-this.y,dist=Math.sqrt(dx*dx+dy*dy)||1,lead=Math.min(.8,dist/600)*.65,lx=mx+mouse.vx*lead*(dist/(diff.missileSPD||5)),ly=my+mouse.vy*lead*(dist/(diff.missileSPD||5)),ta=Math.atan2(ly-this.y,lx-this.x);let da=(ta-this.angle+Math.PI*3)%(Math.PI*2)-Math.PI;this.angle+=da*diff.turnRate;const fwd={x:Math.cos(this.angle),y:Math.sin(this.angle)},rgt={x:-fwd.y,y:fwd.x};let ex=0,ey=0;if(this.x<EDGE_PAD*2)ex+=2;if(this.x>W-EDGE_PAD*2)ex-=2;if(this.y<EDGE_PAD*2)ey+=2;if(this.y>H-EDGE_PAD*2)ey-=2;const elen=Math.sqrt(ex*ex+ey*ey)||1;if(elen>.1){this.vx+=ex/elen*1.8*dt*60;this.vy+=ey/elen*1.8*dt*60}const thrust=diff.thrust*dt*60;if(dist>ATTACK_DIST){this.vx+=fwd.x*thrust*1.25;this.vy+=fwd.y*thrust*1.25}else if(dist>ORBIT_DIST){this.vx+=fwd.x*thrust+rgt.x*thrust;this.vy+=fwd.y*thrust+rgt.y*thrust}else{this.vx+=rgt.x*thrust*1.5-fwd.x*thrust*.5;this.vy+=rgt.y*thrust*1.5-fwd.y*thrust*.5}const spd=Math.sqrt(this.vx*this.vx+this.vy*this.vy)||1;if(spd>diff.maxSpd){this.vx=this.vx/spd*diff.maxSpd;this.vy=this.vy/spd*diff.maxSpd}this.vx*=FRICTION;this.vy*=FRICTION;this.x+=this.vx*dt*60;this.y+=this.vy*dt*60;this.x=Math.max(EDGE_PAD,Math.min(W-EDGE_PAD,this.x));this.y=Math.max(EDGE_PAD,Math.min(H-EDGE_PAD,this.y));this.enginePhase+=dt;if(this.enginePhase>.025){trailPuff(this.x-fwd.x*18,this.y-fwd.y*18,"rgba(0,210,255,0.55)");this.enginePhase=0}if(Math.abs(da)<.22&&dist<ATTACK_DIST&&now-this.lastShot>diff.fireDelay&&missiles.length<diff.maxMissiles+2){const nx=this.x+fwd.x*28,ny=this.y+fwd.y*28;missiles.push(new Missile(nx,ny,this.angle,diff.missileSPD,diff.homing));this.lastShot=now;this.warningFlash=.8;this.vx=-fwd.x*3.5;this.vy=-fwd.y*3.5;burst(nx,ny,"#ff6622",10,2.5)}if(this.warningFlash>0)this.warningFlash-=dt*2}draw(t){const fwd={x:Math.cos(this.angle),y:Math.sin(this.angle)},rgt={x:-fwd.y,y:fwd.x},nose={x:this.x+fwd.x*26,y:this.y+fwd.y*26},wL={x:this.x-fwd.x*12-rgt.x*22,y:this.y-fwd.y*12-rgt.y*22},wR={x:this.x-fwd.x*12+rgt.x*22,y:this.y-fwd.y*12+rgt.y*22},tail={x:this.x-fwd.x*16,y:this.y-fwd.y*16};const grd=ctx.createRadialGradient(tail.x,tail.y,0,tail.x,tail.y,22);grd.addColorStop(0,"rgba(0,220,255,0.28)");grd.addColorStop(1,"rgba(0,100,255,0)");ctx.fillStyle=grd;ctx.beginPath();ctx.arc(tail.x,tail.y,22,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(nose.x,nose.y);ctx.lineTo(wL.x,wL.y);ctx.lineTo(tail.x,tail.y);ctx.lineTo(wR.x,wR.y);ctx.closePath();ctx.fillStyle="rgba(2,18,38,0.9)";ctx.fill();const ea=this.warningFlash>0?this.warningFlash:.65;ctx.strokeStyle=`rgba(0,${180+Math.round(75*Math.sin(t*8))},255,${ea})`;ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle="rgba(0,230,255,0.55)";ctx.beginPath();ctx.arc(tail.x,tail.y,4,0,Math.PI*2);ctx.fill();if(this.warningFlash>0){ctx.strokeStyle=`rgba(255,80,0,${this.warningFlash*.7})`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(this.x,this.y,35*this.warningFlash,0,Math.PI*2);ctx.stroke()}}}
function drawCursor(x,y,alive){const col=alive?"#00ff9d":"rgba(255,34,68,0.5)",sz=alive?11:16;ctx.save();ctx.translate(x,y);ctx.strokeStyle=col;ctx.lineWidth=1;ctx.globalAlpha=alive?.4:.2;ctx.beginPath();ctx.arc(0,0,sz,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=alive?.7:.3;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(-3,0);ctx.moveTo(3,0);ctx.lineTo(7,0);ctx.moveTo(0,-7);ctx.lineTo(0,-3);ctx.moveTo(0,3);ctx.lineTo(0,7);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,2,0,Math.PI*2);ctx.fill();ctx.restore()}
function drawGrid(){ctx.save();ctx.strokeStyle="rgba(0,255,157,0.04)";ctx.lineWidth=1;for(let x=0;x<W;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.restore()}
function updateHUD(){document.getElementById("scoreDisplay").textContent=elapsed.toFixed(1);const diff=difficultyAt(elapsed);document.getElementById("threatVal").textContent=THREAT_LEVELS[diff.tier];document.getElementById("threat-fill").style.width=(elapsed%15)/15*100+"%";document.getElementById("hud-status").textContent=`THREAT ${THREAT_LABELS[diff.tier]} — ${missiles.length} MISSILE${missiles.length!==1?"S":""} — ${shipKills} KILL${shipKills!==1?"S":""} — ${ship?"SHIP ACTIVE":"SHIP RESPAWNING"}`}
function killShip(mx,my){if(!ship)return;burst(ship.x,ship.y,"#00ccff",45,5);burst(ship.x,ship.y,"#ffffff",18,3);burst(ship.x,ship.y,"#00ff9d",22,4);burst(mx,my,"#ffaa22",12,2.5);ship=null;shipKills++;bonusFlash=1;startTime-=KILL_BONUS*1000;respawnAt=performance.now()+RESPAWN_DELAY}
function killPlayer(){if(gameState!=="PLAYING")return;gameState="DEAD";flashAlpha=1;burst(mouse.x,mouse.y,"#ff2244",40,5);burst(mouse.x,mouse.y,"#ffffff",14,2.5);burst(mouse.x,mouse.y,"#ffaa22",20,3.5);if(elapsed>best){best=elapsed;localStorage.setItem("evasion_best",best.toFixed(2));document.getElementById("bestDisplay").textContent=best.toFixed(1)+"s"}const ov=document.getElementById("overlay");document.getElementById("ov-eyeline").textContent="SIGNAL LOST";document.getElementById("ov-eyeline").style.color="var(--danger)";document.getElementById("ov-eyeline").style.textShadow="0 0 60px var(--danger),0 0 140px rgba(255,34,68,.3)";document.getElementById("ov-sub").textContent="EVASION PROTOCOL TERMINATED";document.getElementById("ov-score").textContent=`SURVIVED: ${elapsed.toFixed(2)}s`;document.getElementById("ov-score").style.color="var(--phosphor)";document.getElementById("ov-score").style.fontSize="20px";document.getElementById("ov-best").textContent=`RECORD: ${best.toFixed(1)}s`;document.getElementById("ov-hint").textContent="CLICK OR MOVE TO RETRY";ov.classList.remove("hidden");ov.classList.add("visible")}
function startGame(){gameState="PLAYING";startTime=performance.now();elapsed=0;particles=[];missiles=[];ship=new Ship();shipKills=0;bonusFlash=0;respawnAt=0;document.getElementById("overlay").classList.add("hidden");document.getElementById("overlay").classList.remove("visible");document.getElementById("ov-eyeline").style.color="var(--phosphor)";document.getElementById("ov-eyeline").style.textShadow="0 0 60px var(--phosphor),0 0 140px rgba(0,255,157,.3)"}
addEventListener("mousemove",e=>{mouse.vx=e.clientX-mouse.x;mouse.vy=e.clientY-mouse.y;mouse.x=e.clientX;mouse.y=e.clientY;if((gameState==="INTRO"||gameState==="DEAD")&&Math.sqrt(mouse.vx*mouse.vx+mouse.vy*mouse.vy)>3)startGame()});addEventListener("click",()=>{if(gameState==="INTRO"||gameState==="DEAD")startGame()});
let lastT=0;function loop(t){const dt=Math.min((t-lastT)/1000,.05);lastT=t;ctx.fillStyle=`rgba(0,12,26,${gameState==="DEAD"?.18:.22})`;ctx.fillRect(0,0,W,H);drawGrid();if(gameState==="PLAYING"){elapsed=(t-startTime)/1000;const diff=difficultyAt(elapsed);if(!ship&&t>respawnAt)ship=new Ship();if(ship){ship.update(dt,t,diff);ship.draw(elapsed)}for(const m of missiles){m.update(dt,mouse.x,mouse.y,mouse.vx,mouse.vy);m.draw();if(m.checkHit(mouse.x,mouse.y)){killPlayer();break}if(ship){const sdx=m.x-ship.x,sdy=m.y-ship.y;if(sdx*sdx+sdy*sdy<SHIP_HIT_RADIUS*SHIP_HIT_RADIUS){m.alive=false;killShip(m.x,m.y);break}}}missiles=missiles.filter(m=>m.alive);updateHUD()}if(bonusFlash>0){bonusFlash=Math.max(0,bonusFlash-dt*3.5);ctx.fillStyle=`rgba(0,255,157,${bonusFlash*.18})`;ctx.fillRect(0,0,W,H);if(bonusFlash>.2){ctx.save();ctx.font=`bold ${Math.round(24+bonusFlash*18)}px Orbitron,monospace`;ctx.fillStyle=`rgba(0,255,157,${bonusFlash*.9})`;ctx.textAlign="center";ctx.fillText(`+${KILL_BONUS}s`,mouse.x,mouse.y-40);ctx.fillText("SHIP DOWN",W/2,H/2);ctx.restore()}}if(gameState==="DEAD"){for(const m of missiles)m.draw();flashAlpha=Math.max(0,flashAlpha-dt*3.5);if(flashAlpha>0){ctx.fillStyle=`rgba(255,34,68,${flashAlpha*.25})`;ctx.fillRect(0,0,W,H)}}for(const p of particles){p.update(dt);p.draw()}particles=particles.filter(p=>p.life>0);drawCursor(mouse.x,mouse.y,gameState==="PLAYING");requestAnimationFrame(loop)}requestAnimationFrame(loop);
window.addEventListener("message",e=>{if(e.data?.type==="pause")gameState="DEAD";if(e.data?.type==="resume"&&gameState==="DEAD")startGame()});

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
  var hbPeriod = 0.6624826162853209;
  setInterval(function() {
    hb.style.opacity = '0.06';
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.012630401584627665;mix-blend-mode:overlay';
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