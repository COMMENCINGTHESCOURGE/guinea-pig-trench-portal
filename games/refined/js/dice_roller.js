
var d1=document.getElementById('die1'),d2=document.getElementById('die2');
var x1=-20,y1=-20,x2=-30,y2=15;
var rolls=[],btn=document.getElementById('rollBtn');

function rollDice(){
  // Die 1 — random spins
  var s1=2+Math.floor(Math.random()*3);
  var xr1=Math.floor(Math.random()*4)*90;
  var yr1=Math.floor(Math.random()*4)*90;
  x1+=(s1*360)+xr1; y1+=(s1*360)+yr1;
  d1.style.transform='translateZ(calc(-1*var(--dice)/2)) rotateX('+x1+'deg) rotateY('+y1+'deg)';

  // Die 2 — different spin speed for variety
  var s2=2+Math.floor(Math.random()*3);
  var xr2=Math.floor(Math.random()*4)*90;
  var yr2=Math.floor(Math.random()*4)*90;
  x2+=(s2*360)+xr2; y2+=(s2*360)+yr2;
  d2.style.transform='translateZ(calc(-1*var(--dice)/2)) rotateX('+x2+'deg) rotateY('+y2+'deg)';

  // Results
  var r1=Math.floor(Math.random()*6)+1;
  var r2=Math.floor(Math.random()*6)+1;

  setTimeout(function(){
    document.getElementById('die1-val').textContent=r1;
    document.getElementById('die2-val').textContent=r2;
    var sum=r1+r2;
    document.getElementById('result').textContent=r1+' + '+r2;

    // Special calls
    var call='= '+sum;
    if(r1===r2) call='DOUBLES! '+sum;
    if(sum===7) call='LUCKY 7!';
    if(sum===11) call='YO-ELEVEN!';
    if(sum===2) call='SNAKE EYES!';
    if(sum===12) call='BOXCARS!';
    if(r1===r2&&r1===6) call='MIDNIGHT!';

    document.getElementById('total').textContent=call;
    rolls.push(sum);
    if(rolls.length>12)rolls.shift();
    document.getElementById('history').textContent='HISTORY: '+rolls.join(' \u00b7 ');
  },1500);
}

btn.addEventListener('click',rollDice);
btn.addEventListener('touchstart',function(e){e.preventDefault();rollDice()},{passive:false});

// Also roll by clicking anywhere in the tray
document.getElementById('tray').addEventListener('click',function(e){
  if(e.target.id!=='rollBtn')rollDice();
});



// -- THE THRESHOLD CROSS-POLLINATION (pass 1) --
(function() {
  // Vignette
  var vig = document.createElement('div');
  vig.id = 'threshold-vignette';
  document.body.appendChild(vig);

  // World name
  var wn = document.createElement('div');
  wn.id = 'threshold-world-name';
  wn.textContent = 'THE THRESHOLD';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.6715313762107589;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.01281768221215879;mix-blend-mode:overlay';
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




// -- THRESHOLD AUDIO ENGINE --
var _thAudioCtx;
function thTone(freq, dur, type, vol) {
  if (!_thAudioCtx) _thAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var o = _thAudioCtx.createOscillator();
  var g = _thAudioCtx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq || 440;
  o.detune.value = (Math.random() - 0.5) * 10; // happy little mistake
  g.gain.setValueAtTime((vol || 0.1), _thAudioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, _thAudioCtx.currentTime + (dur || 0.2));
  o.connect(g); g.connect(_thAudioCtx.destination);
  o.start(); o.stop(_thAudioCtx.currentTime + (dur || 0.2));
}
function thClick() { thTone(800, 0.06, 'sine', 0.08); }
function thSuccess() { thTone(523, 0.1, 'sine', 0.12); setTimeout(function(){thTone(659, 0.1, 'sine', 0.12)}, 70); setTimeout(function(){thTone(784, 0.15, 'triangle', 0.1)}, 140); }
function thFail() { thTone(200, 0.15, 'sawtooth', 0.06); }
function thPickup() { thTone(880, 0.08, 'sine', 0.1); setTimeout(function(){thTone(1100, 0.12, 'sine', 0.08)}, 50); }
document.addEventListener('click', function() { if (!_thAudioCtx) _thAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); }, {once: true});





// -- THRESHOLD PARTICLE SYSTEM --
var _thParticles = [];
function thSpawnParticles(x, y, count, color) {
  for (var i = 0; i < (count || 8); i++) {
    _thParticles.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 1,
      color: color || '#00ffd2',
      size: 2 + Math.random() * 3
    });
  }
}
function thUpdateParticles(ctx) {
  for (var i = _thParticles.length - 1; i >= 0; i--) {
    var p = _thParticles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.05; // gravity
    p.vx *= 0.98;
    p.life -= 0.025;
    if (p.life <= 0) { _thParticles.splice(i, 1); continue; }
    if (ctx) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}




// CHAIN FIX: SCREENSHOT
document.addEventListener("keydown",function(e){if((e.key==="s"||e.key==="S")&&!e.ctrlKey&&!e.metaKey&&!document.pointerLockElement){var c=document.querySelector("canvas");if(!c)return;var url=c.toDataURL("image/png");var a=document.createElement("a");a.href=url;a.download="gpt_"+Date.now()+".png";a.click();if(typeof _tone==="function")_tone(1200,.08,"sine",.05)}});



// CHAIN FIX: MUSIC LINK
setInterval(function(){try{if(parent.AUDIO_BASS!==undefined){window.AUDIO_BASS=parent.AUDIO_BASS;window.AUDIO_MID=parent.AUDIO_MID;window.AUDIO_HIGH=parent.AUDIO_HIGH;window.AUDIO_ENERGY=parent.AUDIO_ENERGY}}catch(e){}},33);
