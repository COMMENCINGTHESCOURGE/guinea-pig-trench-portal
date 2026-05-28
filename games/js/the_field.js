'use strict';

// ── sieve + SPF ─────────────────────────────────────────────────────────────
const MX = 250001;
const spf = new Int32Array(MX);
for(let i=0;i<MX;i++) spf[i]=i;
for(let i=2;i*i<MX;i++) if(spf[i]===i) for(let j=i*i;j<MX;j+=i) if(spf[j]===j) spf[j]=i;
const isPrime = n => n>=2 && n<MX && spf[n]===n;
const omega = n => { const seen=new Set(); while(n>1){seen.add(spf[n]);n=Math.floor(n/spf[n]);}return seen.size; };

function factorize(n){
  const f={};
  while(n>1){const p=spf[n];f[p]=(f[p]||0)+1;n=Math.floor(n/p);}
  return f;
}
function gcd(a,b){return b?gcd(b,a%b):a;}
function ef4n(n){
  let num=4,den=n,r=[];
  for(let s=0;s<3&&num>0;s++){
    const a=Math.ceil(den/num);r.push(a);
    const nn=num*a-den,nd=den*a,g=gcd(Math.abs(nn),nd);
    num=nn/g;den=nd/g;
  }
  return r;
}

// ── spiral ──────────────────────────────────────────────────────────────────
const SE = Math.ceil(Math.sqrt(MX))+4; // full spiral radius, not half
const GW = 2*SE+1;
const grid = new Int32Array(GW*GW);
const pos  = new Array(MX);

let currentMode = 'ULAM';
let showMod24 = false; // highlight n ≡ 1 (mod 24) — sieve survivor residue class

function buildGeometry() {
  grid.fill(0);

  if (currentMode === 'ULAM') {
    let r=0,c=0,n=1;
    pos[1]=[0,0]; grid[SE*GW+SE]=1; n=2;
    let dr=0,dc=1,sl=1,sc=0,tc=0;
    while(n<MX){
      r+=dr;c+=dc;
      if(r>=-SE&&r<=SE&&c>=-SE&&c<=SE){
        pos[n]=[r,c]; grid[(r+SE)*GW+(c+SE)]=n;
      }
      n++; sc++;
      if(sc===sl){sc=0;[dr,dc]=[-dc,dr];tc++;if(tc%2===0)sl++;}
    }
  } else {
    // SACKS SPIRAL
    pos[1]=[0,0]; grid[SE*GW+SE]=1;
    for(let n=2; n<MX; n++) {
      const r_polar = Math.sqrt(n);
      const theta = 2 * Math.PI * r_polar;
      const r_scaled = r_polar * 0.55;
      const c = Math.round(Math.cos(theta) * r_scaled);
      const r = Math.round(-Math.sin(theta) * r_scaled);
      pos[n] = [r, c];
      if(r>=-SE && r<=SE && c>=-SE && c<=SE){
        grid[(r+SE)*GW+(c+SE)] = n;
      }
    }
  }
}

buildGeometry();

function gridLookup(r,c){
  if(r<-SE||r>SE||c<-SE||c>SE)return 0;
  return grid[(r+SE)*GW+(c+SE)];
}

// ── prime count below limit ─────────────────────────────────────────────────
const primePi = new Int32Array(MX);
for(let i=2;i<MX;i++) primePi[i]=primePi[i-1]+(isPrime(i)?1:0);

// ── colors ──────────────────────────────────────────────────────────────────
const PH = new Map([
  [2,215],[3,165],[5,105],[7,38],[11,285],[13,335],
  [17,58],[19,195],[23,18],[29,255],[31,310],[37,148],
  [41,3],[43,78],[47,242],[53,180],[59,312],[61,125],
  [67,262],[71,22],[73,172],[79,92],[83,212],[89,355],
  [97,143],[101,7],[103,68],[107,248],[109,302],[113,188]
]);
function ph(p){ return PH.has(p)?PH.get(p):(p*137.508)%360; }

const CC = new Array(MX);
(()=>{
  CC[1]=[0,0,10];
  for(let n=2;n<MX;n++){
    if(isPrime(n)){CC[n]=[ph(n),72,56];continue;}
    const f=factorize(n),primes=Object.keys(f).map(Number);
    let ss=0,cs=0,te=0;
    for(const p of primes){const e=f[p],hr=ph(p)*Math.PI/180;ss+=Math.sin(hr)*e;cs+=Math.cos(hr)*e;te+=e;}
    const h=((Math.atan2(ss/te,cs/te)*180/Math.PI)+360)%360;
    const nf=primes.length;
    CC[n]=[h, 18+Math.min(nf*9,32), 11+Math.min(nf*3,13)];
  }
})();

// ── canvas ──────────────────────────────────────────────────────────────────
const cv=document.getElementById('c');
const ctx=cv.getContext('2d');
let W,H,dpr;
let cpx=8;
let camR=0,camC=0;
let af=0;

function resize(){
  const p=cv.parentElement;
  W=p.clientWidth;H=p.clientHeight;
  dpr=Math.min(devicePixelRatio,2);
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}

function s2c(r,c){return[(c-camC)*cpx+W/2,(r-camR)*cpx+H/2];}
function c2s(mx,my){return[Math.round((my-H/2)/cpx+camR),Math.round((mx-W/2)/cpx+camC)];}

function draw(){
  af++;
  ctx.fillStyle='#05050d';
  ctx.fillRect(0,0,W,H);

  const vr=Math.ceil(H/cpx/2)+2, vc=Math.ceil(W/cpx/2)+2;
  const r0=Math.floor(camR-vr),r1=Math.ceil(camR+vr);
  const c0=Math.floor(camC-vc),c1=Math.ceil(camC+vc);

  const showText = cpx>=28;
  const showDot  = cpx>=10;
  const useRound = cpx>=8;

  if(showText){
    ctx.font=`${Math.floor(cpx*.3)}px Courier New`;
    ctx.textAlign='center';ctx.textBaseline='middle';
  }

  for(let r=r0;r<=r1;r++){
    for(let c=c0;c<=c1;c++){
      const n=gridLookup(r,c);
      if(!n||n>=MX) continue;
      const[x,y]=s2c(r,c);
      if(x<-cpx||x>W+cpx||y<-cpx||y>H+cpx) continue;

      const[h,s,l]=CC[n];
      const isP=isPrime(n);
      const isMod24 = showMod24 && (n % 24 === 1);
      let lv=l;
      if(isP&&cpx>=6) lv+=Math.sin(af*.028+n*.6)*3.5;
      if(n===hovN) lv=Math.min(lv+22,85);

      // Fungi diffusion coloring: mod-24 ≡ 1 numbers glow teal (sieve survivors)
      // They form visible channels through the spiral — mycelium paths
      if(isMod24) {
        // Teal glow for sieve survivor class — the harder residues
        const pulse = Math.sin(af*.015+n*.003)*0.08;
        ctx.fillStyle=`rgba(0,210,255,${0.25+pulse})`;
      } else if(showMod24 && !isP) {
        // Dim everything else when mod24 overlay is active
        ctx.fillStyle=`hsl(${h.toFixed(0)},${Math.max(s-15,0)}%,${Math.max(lv-5,3).toFixed(1)}%)`;
      } else {
        ctx.fillStyle=`hsl(${h.toFixed(0)},${s}%,${lv.toFixed(1)}%)`;
      }
      const pad=cpx>4?1:0,sz=cpx-pad*2;
      const px=x-cpx/2+pad,py=y-cpx/2+pad;
      if(useRound){
        ctx.beginPath();rr(px,py,sz,sz,2);ctx.fill();
      } else {
        ctx.fillRect(px,py,sz,sz);
      }

      if(isP&&showDot){
        ctx.fillStyle='rgba(255,238,136,0.9)';
        ctx.beginPath();ctx.arc(x+cpx/2-3.5,y-cpx/2+3.5,1.5,0,Math.PI*2);ctx.fill();
      }

      if(showText){
        ctx.fillStyle=isP?'rgba(255,235,140,0.85)':'rgba(80,80,160,0.6)';
        ctx.fillText(n,x,y);
      }
    }
  }

  // origin cross
  const[x0,y0]=s2c(0,0);
  ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=0.5;
  ctx.beginPath();ctx.moveTo(x0-8,y0);ctx.lineTo(x0+8,y0);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x0,y0-8);ctx.lineTo(x0,y0+8);ctx.stroke();

  // hud
  const cn=gridLookup(Math.round(camR),Math.round(camC));
  document.getElementById('h-z').textContent=cpx.toFixed(1);
  document.getElementById('h-c').textContent=cn||'—';
  const vis=Math.min(Math.floor(W/cpx)*Math.floor(H/cpx),MX-1);
  document.getElementById('h-p').textContent=primePi[Math.min(vis,MX-1)];
}

function rr(x,y,w,h,r){
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

// ── audio — SoundClick beats as samples ─────────────────────────────────────
let AC=null;
const soundclickBeats = [
  'soundclick/skippyohms_awwwnshocks.mp3',
  'soundclick/skippyohms_thedream.mp3',
  'soundclick/skippyohms_theworld.mp3',
  'soundclick/skippyohms_waves.mp3',
  'soundclick/skippyohms_thatstuff.mp3',
  'soundclick/skippyohms_woah.mp3',
  'soundclick/skippyohms_ohy.mp3',
  'soundclick/skippyohms_thislife.mp3',
  'soundclick/skippyohms_today.mp3',
  'soundclick/skippyohms_quckfast.mp3',
  'soundclick/skippyohms_thelastcall.mp3',
  'soundclick/skippyohms_theknobbroke.mp3',
];
const beatBuffers = [];
let beatsLoaded = false;

// Preload beat snippets as AudioBuffers
function initAudio() {
  if(AC) return;
  AC = new AudioContext();
  // Load first 3 beats immediately, rest lazily
  soundclickBeats.forEach((url, i) => {
    const fullUrl = '../music/' + url;
    fetch(fullUrl).then(r => r.arrayBuffer()).then(buf => {
      return AC.decodeAudioData(buf);
    }).then(decoded => {
      beatBuffers[i] = decoded;
      if(i === 0) beatsLoaded = true;
    }).catch(() => {});
  });
}

function playSound(n) {
  if(!AC) initAudio();
  if(AC.state==='suspended') AC.resume();

  if(beatsLoaded && beatBuffers.length > 0) {
    // Map number to a beat snippet — use mod to cycle through available beats
    const beatIdx = n % Math.max(1, beatBuffers.filter(Boolean).length);
    const buf = beatBuffers.filter(Boolean)[beatIdx];
    if(!buf) return;

    const source = AC.createBufferSource();
    const gain = AC.createGain();

    // Play a short slice from the beat — position based on number
    const startTime = (n * 0.0137) % Math.max(0.1, buf.duration - 2);
    const duration = 1.5 + (n % 5) * 0.3; // 1.5 to 3 seconds

    source.buffer = buf;
    // Pitch shift based on prime factors
    const f = factorize(n);
    const nFactors = Object.keys(f).length;
    source.playbackRate.value = 0.8 + nFactors * 0.1; // more factors = higher pitch

    gain.gain.setValueAtTime(0, AC.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, AC.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, AC.currentTime + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, AC.currentTime + duration);

    source.connect(gain);
    gain.connect(AC.destination);
    source.start(AC.currentTime, startTime, duration);
  } else {
    // Fallback: generated chord (original behavior)
    const f=factorize(n),primes=Object.keys(f).map(Number);
    const now=AC.currentTime;
    primes.forEach(p=>{
      const freq=55*Math.pow(2,((p%24+10))/12);
      const osc=AC.createOscillator(),g=AC.createGain();
      osc.type='sine';osc.frequency.value=freq;
      g.gain.setValueAtTime(0,now);
      g.gain.linearRampToValueAtTime(.1/primes.length,now+.02);
      g.gain.linearRampToValueAtTime(0,now+1.5);
      osc.connect(g);g.connect(AC.destination);
      osc.start(now);osc.stop(now+1.5);
    });
  }
}

// Init audio on first click
document.addEventListener('click', () => { if(!AC) initAudio(); }, {once:true});

// ── tooltip ──────────────────────────────────────────────────────────────────
let hovN=null;
const tip=document.getElementById('tip');

function showTip(n,mx,my){
  if(!n||n>=MX){tip.classList.remove('on');hovN=null;return;}
  hovN=n;
  document.getElementById('h-n').textContent=n;
  document.getElementById('t-n').textContent=`${n}${isPrime(n)?' ★':''}`;
  const f=factorize(n);
  const parts=Object.entries(f).map(([p,e])=>e>1?`${p}^${e}`:p);
  document.getElementById('t-f').textContent=n>1?parts.join(' × '):'1';
  const eg=ef4n(n);
  document.getElementById('t-e').textContent=`4/${n} = `+eg.map(a=>`1/${a}`).join(' + ');
  const w=omega(n);
  const types=[];
  if(isPrime(n)) types.push('prime');
  else if(w===1) types.push(`prime power`);
  else types.push(`${w} distinct prime factors`);
  if(n>1){const s=Math.round(Math.sqrt(n));if(s*s===n)types.push('perfect square');}
  if(n%24===1) types.push('n≡1 (mod 24) — sieve survivor class');
  document.getElementById('t-t').textContent=types.join(' · ');
  const tx=Math.min(mx+14,W-240),ty=Math.min(my+14,H-110);
  tip.style.left=tx+'px';tip.style.top=ty+'px';
  tip.classList.add('on');
}

// ── smooth interpolation ─────────────────────────────────────────────────────
let targetR=0,targetC=0,targetZoom=8;
let velR=0,velC=0;

function smoothStep(){
  camR+=(targetR-camR)*.12+velR;
  camC+=(targetC-camC)*.12+velC;
  cpx+=(targetZoom-cpx)*.12;
  velR*=.92; velC*=.92;
}

// ── interaction — drag with momentum ─────────────────────────────────────────
let dragging=false,dX=0,dY=0,dR=0,dC=0;
let lastMX=0,lastMY=0,prevMX=0,prevMY=0,prevMT=0;

cv.addEventListener('mousedown',e=>{
  dragging=true;dX=e.clientX;dY=e.clientY;dR=targetR;dC=targetC;
  prevMX=e.clientX;prevMY=e.clientY;prevMT=performance.now();
  velR=0;velC=0;
});
window.addEventListener('mouseup',e=>{
  if(!dragging)return;
  const wasDrag=Math.abs(e.clientX-dX)>4||Math.abs(e.clientY-dY)>4;
  dragging=false;
  if(!wasDrag){
    const[sr2,sc2]=c2s(e.clientX,e.clientY);
    const n=gridLookup(sr2,sc2);
    if(n&&n<MX) playSound(n);
  } else {
    const dt=Math.max(1,performance.now()-prevMT);
    velR=-(e.clientY-prevMY)/cpx/dt*16;
    velC=-(e.clientX-prevMX)/cpx/dt*16;
    const mx=20/cpx;
    velR=Math.max(-mx,Math.min(mx,velR));
    velC=Math.max(-mx,Math.min(mx,velC));
  }
});
window.addEventListener('mousemove',e=>{
  lastMX=e.clientX;lastMY=e.clientY;
  if(dragging){
    targetR=dR-(e.clientY-dY)/cpx;
    targetC=dC-(e.clientX-dX)/cpx;
    prevMX=e.clientX;prevMY=e.clientY;prevMT=performance.now();
  } else {
    const[sr2,sc2]=c2s(e.clientX,e.clientY);
    const n=gridLookup(sr2,sc2);
    if(n!==hovN){hovN=n;showTip(n,e.clientX,e.clientY);}
    else if(n) showTip(n,e.clientX,e.clientY);
  }
});
cv.addEventListener('mouseleave',()=>{tip.classList.remove('on');hovN=null;});
cv.addEventListener('wheel',e=>{
  e.preventDefault();
  const f=e.deltaY<0?1.18:.85;
  targetZoom=Math.max(1.5,Math.min(80,targetZoom*f));
  const[mr,mc]=c2s(e.clientX,e.clientY);
  targetR+=(mr-targetR)*(1-1/f)*.3;
  targetC+=(mc-targetC)*(1-1/f)*.3;
},{passive:false});

// touch — drag + pinch
let ts0=null,pinchD0=0,pinchZ0=0;
cv.addEventListener('touchstart',e=>{
  if(e.touches.length===1){ts0={x:e.touches[0].clientX,y:e.touches[0].clientY,r:targetR,c:targetC,t:performance.now()};velR=0;velC=0;}
  if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;pinchD0=Math.sqrt(dx*dx+dy*dy);pinchZ0=targetZoom;}
  e.preventDefault();
},{passive:false});
cv.addEventListener('touchmove',e=>{
  if(e.touches.length===1&&ts0){targetC=ts0.c-(e.touches[0].clientX-ts0.x)/cpx;targetR=ts0.r-(e.touches[0].clientY-ts0.y)/cpx;}
  if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;targetZoom=Math.max(1.5,Math.min(80,pinchZ0*(Math.sqrt(dx*dx+dy*dy)/pinchD0)));}
  e.preventDefault();
},{passive:false});
cv.addEventListener('touchend',e=>{
  if(ts0&&e.touches.length===0){const dt=Math.max(1,performance.now()-ts0.t);velR=(targetR-ts0.r)/dt*80;velC=(targetC-ts0.c)/dt*80;const mx=15/cpx;velR=Math.max(-mx,Math.min(mx,velR));velC=Math.max(-mx,Math.min(mx,velC));}
  ts0=null;e.preventDefault();
},{passive:false});

window.addEventListener('keydown',e=>{
  const s=Math.max(1,3/cpx*10);
  if(e.key==='ArrowRight'){targetC+=s;velC=0;}
  else if(e.key==='ArrowLeft'){targetC-=s;velC=0;}
  else if(e.key==='ArrowDown'){targetR+=s;velR=0;}
  else if(e.key==='ArrowUp'){targetR-=s;velR=0;}
  else if(e.key==='+'||e.key==='=')targetZoom=Math.min(80,targetZoom*1.2);
  else if(e.key==='-')targetZoom=Math.max(1.5,targetZoom*.85);
  else if(e.key==='Home'||e.key==='0'){targetR=0;targetC=0;targetZoom=8;velR=0;velC=0;}
  else return;
  e.preventDefault();
});

// ── mode toggle ─────────────────────────────────────────────────────────────
document.getElementById('btn-mode').addEventListener('click', (e) => {
  currentMode = currentMode === 'ULAM' ? 'SACKS' : 'ULAM';
  e.target.textContent = `MODE: ${currentMode}`;
  document.getElementById('logo-text').innerHTML = `THE <em>FIELD</em> // ${currentMode} SPIRAL`;
  buildGeometry();
  draw();
});

document.getElementById('btn-mod24').addEventListener('click', (e) => {
  showMod24 = !showMod24;
  e.target.textContent = `MOD24: ${showMod24 ? 'ON' : 'OFF'}`;
  e.target.style.color = showMod24 ? '#00d2ff' : '';
  draw();
});

// Guide text — fades after 8 seconds
const guide = document.createElement('div');
guide.style.cssText = `
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  text-align:center;font-size:12px;color:rgba(0,210,255,0.5);
  letter-spacing:.12em;line-height:2.2;pointer-events:none;
  transition:opacity 3s;max-width:400px;z-index:20;
`;
guide.innerHTML = `
  Every integer mapped to a spiral.<br>
  Primes glow amber on the diagonals.<br>
  Click MOD24 to see why the Erd&#337;s-Straus<br>
  sieve survivors cluster where they do.<br>
  <span style="color:rgba(255,170,68,0.4);font-size:10px">250,000 numbers · hover · click · scroll</span>
`;
document.querySelector('main').appendChild(guide);
setTimeout(() => guide.style.opacity = '0', 8000);
setTimeout(() => guide.remove(), 12000);

// ── animation loop ──────────────────────────────────────────────────────────
let lastT=0;
function loop(t){
  smoothStep();
  if(t-lastT>33){draw();lastT=t;} // ~30fps
  requestAnimationFrame(loop);
}

// ── game shell integration ──────────────────────────────────────────────────
window.addEventListener('message', e => {
  if (e.data && e.data.type === 'pause') { /* interactive tool, no-op */ }
  if (e.data && e.data.type === 'resume') { /* interactive tool, no-op */ }
});

// ── init ─────────────────────────────────────────────────────────────────────
new ResizeObserver(resize).observe(cv.parentElement);
cv.style.width='100%';cv.style.height='100%';
resize();
requestAnimationFrame(loop);