/*
  BIRDS EYE — v7.1 [RESONANT]
  Guinea Pig Trench LLC | DaShawn Lee McLaughlin El Bey
  Logic: Real-Time Resonance + 2.2Q Sovereign Update
*/

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, cx, cy, t = 0, owlAngle = 0;

// v7.1: UPDATED RESEARCH DESC (APRIL 8, 2026)
const NODES = [
  { id:'LEGAL',  color:'#c8a84b', angle:-Math.PI/2,                    desc:'PCRA · 12/10/26 · STRUCTURAL_ERROR' },
  { id:'MATH',   color:'#4bc8a8', angle:-Math.PI/2+Math.PI*2/5,        desc:'2.2Q RECORD · 100M BREACH · v106' },
  { id:'CODE',   color:'#4b8ac8', angle:-Math.PI/2+Math.PI*4/5,        desc:'v7.1 ASYNC · KAG FLEET · v108' },
  { id:'ART',    color:'#8ac84b', angle:-Math.PI/2+Math.PI*6/5,        desc:'FILIGREE_SET (14/14) · SVG_HD' },
  { id:'MUSIC',  color:'#c84b8a', angle:-Math.PI/2+Math.PI*8/5,        desc:'19 TRACKS · KAG REFINERY · STEMS' },
];

const R = () => Math.min(W,H) * 0.3;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  cx = W/2; cy = H/2;
}

// ── v7.1 SYNESTHETIC RESONANCE ──
let torsionVal = 0.05;
let bassIntensity = 0;

function terrain() {
  const r = R();
  for (let i=1;i<=12;i++) { # Increased Resolution
    ctx.beginPath();
    ctx.arc(cx,cy,r*0.12*i,0,Math.PI*2);
    ctx.strokeStyle=`rgba(255,255,255,${0.01 + (torsionVal * 0.001)})`;
    ctx.lineWidth=i%4===0?1.2:0.4;
    ctx.stroke();
  }
}

function pulse() {
  const r=R();
  for(let p=0;p<4;p++){
    const prog=((t*(0.4 + bassIntensity*0.1)+p*0.25)%1);
    ctx.beginPath();
    ctx.arc(cx,cy,prog*r*1.2,0,Math.PI*2);
    ctx.strokeStyle=`rgba(255,255,255,${(1-prog)*0.08})`;
    ctx.lineWidth=1 + bassIntensity*2;
    ctx.stroke();
  }
}

function nodes_draw(nodes) {
  nodes.forEach((n,i)=>{
    const p=(Math.sin(t*1.5+i*0.8)+1)/2;
    const r=20+p*6;
    
    // v7.1: NODE RESIDUE REACTION
    const glow = ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,r*4);
    glow.addColorStop(0, n.color + '40');
    glow.addColorStop(1, n.color + '00');
    ctx.beginPath(); ctx.arc(n.x,n.y,r*4,0,Math.PI*2);
    ctx.fillStyle=glow; ctx.fill();
    
    ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2);
    ctx.strokeStyle=n.color;
    ctx.lineWidth=2;
    ctx.stroke();
    
    // T-Emblem Motif in each node
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(n.x-4, n.y-4); ctx.lineTo(n.x+4, n.y-4); ctx.lineTo(n.x, n.y+4);
    ctx.fill();
  });
}

function frame() {
  t += 0.005;
  
  // v7.1: TORSION MODULATOR
  // Simulate live feedback from the v103/v106 local sweeps
  torsionVal = 0.5 + 0.5 * Math.sin(t * 0.7);
  if(Math.random() > 0.99) torsionVal *= 150.0; // Random Singularity Strike
  
  owlAngle += 0.0008 + (torsionVal * 0.00001);
  
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#050508';
  ctx.fillRect(0,0,W,H);
  
  const r=R();
  const ns=NODES.map(n=>({...n,x:cx+Math.cos(n.angle+owlAngle)*r,y:cy+Math.sin(n.angle+owlAngle)*r}));
  
  terrain();
  pulse();
  nodes_draw(ns);
  
  // HUD Update
  document.getElementById('clockval').textContent = 
    `RESONANCE: ${torsionVal.toFixed(2)} | SCALE: QUADRILLION | NODE: ${Math.floor(t % 72)}`;
    
  requestAnimationFrame(frame);
}

window.addEventListener('resize',resize);
resize();
frame();
