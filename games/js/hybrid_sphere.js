const cv=document.getElementById('bsc');
const G=cv.getContext('2d');
const W=520,H=520,SR=242,CX=260,CY=260;
const WORLD_R=1.0,SEA_Y=-0.12;
const GRID=64;
const density=new Float32Array(GRID*GRID);
const inDensity=new Float32Array(GRID*GRID);
const outDensity=new Float32Array(GRID*GRID);

const qM=(a,b)=>[a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
const qN=q=>{const m=Math.hypot(q[0],q[1],q[2],q[3]);return[q[0]/m,q[1]/m,q[2]/m,q[3]/m];};
const qA=(ax,ay,az,a)=>{const s=Math.sin(a/2),c=Math.cos(a/2);return[c,ax*s,ay*s,az*s];};
const qV=(v,q)=>{const[w,qx,qy,qz]=q,[vx,vy,vz]=v;const cx=qy*vz-qz*vy,cy=qz*vx-qx*vz,cz=qx*vy-qy*vx;return[vx+2*(w*cx+qy*cz-qz*cy),vy+2*(w*cy+qz*cx-qx*cz),vz+2*(w*cz+qx*cy-qy*cx)];};

// Catmull-Rom spline: returns array of [x,y,z] points through ctrl points
function catmullRom(pts,steps){
  const out=[];
  if(pts.length<2) return pts.slice();
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[Math.max(0,i-1)];
    const p1=pts[i];
    const p2=pts[i+1];
    const p3=pts[Math.min(pts.length-1,i+2)];
    for(let s=0;s<=steps;s++){
      const t=s/steps;
      const t2=t*t,t3=t2*t;
      const x=0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3);
      const y=0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3);
      const z=0.5*((2*p1[2])+(-p0[2]+p2[2])*t+(2*p0[2]-5*p1[2]+4*p2[2]-p3[2])*t2+(-p0[2]+3*p1[2]-3*p2[2]+p3[2])*t3);
      out.push([x,y,z]);
    }
  }
  return out;
}

// stamp point into density grid
function stampDensity(sx,sy,amount,dir){
  const gx=Math.floor((sx-CX+SR)/(SR*2)*GRID);
  const gy=Math.floor((sy-CY+SR)/(SR*2)*GRID);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=gx+dx,ny=gy+dy;
    if(nx<0||nx>=GRID||ny<0||ny>=GRID)continue;
    const falloff=1-Math.abs(dx)*0.4-Math.abs(dy)*0.4;
    const i=ny*GRID+nx;
    density[i]=Math.min(1,density[i]+amount*falloff);
    if(dir==='in') inDensity[i]=Math.min(1,inDensity[i]+amount*falloff*1.2);
    else outDensity[i]=Math.min(1,outDensity[i]+amount*falloff*1.2);
  }
}

let Q=qN(qA(0.3,0.7,0.2,0.5));
let ZM=1.0,DRG=false,DB=0,LX=0,LY=0,FR=0;
let tips=[],contracts=[],midContracts=[];
let cntIn=0,cntOut=0,cntBi=0;

function prj(nx,ny,nz){
  const a=Math.acos(Math.max(-1,Math.min(1,nz)));
  const rr=a/Math.PI*SR*ZM;
  const p=Math.hypot(nx,ny);
  if(p<1e-6)return[CX,CY,nz];
  return[CX+nx/p*rr,CY+ny/p*rr,nz];
}
function inCircle(sx,sy){return(sx-CX)**2+(sy-CY)**2<SR*SR;}

function spawnIn(){
  const t=Math.random()*Math.PI*2,p=Math.acos(2*Math.random()-1);
  const r=WORLD_R*(0.78+Math.random()*0.2);
  const ox=Math.sin(p)*Math.cos(t)*r,oy=Math.sin(p)*Math.sin(t)*r,oz=Math.cos(p)*r;
  const l=Math.hypot(ox,oy,oz);
  tips.push({x:ox,y:oy,z:oz,dx:-ox/l+(Math.random()-0.5)*0.38,dy:-oy/l+(Math.random()-0.5)*0.38,dz:-oz/l+(Math.random()-0.5)*0.38,dir:'in',melanin:0,trail3:[],alive:true,age:0});
}
function spawnOut(ox,oy,oz){
  ox=ox||((Math.random()-0.5)*0.1);oy=oy||((Math.random()-0.5)*0.1);oz=oz||((Math.random()-0.5)*0.1);
  const l=Math.hypot(ox,oy,oz)||0.01;
  tips.push({x:ox,y:oy,z:oz,dx:ox/l+(Math.random()-0.5)*0.45,dy:oy/l+(Math.random()-0.5)*0.45,dz:oz/l+(Math.random()-0.5)*0.45,dir:'out',melanin:0,trail3:[],alive:true,age:0});
}

function seed(){
  for(let i=0;i<26;i++) spawnIn();
  for(let i=0;i<18;i++){
    const t=Math.random()*Math.PI*2,p=Math.acos(2*Math.random()-1);
    const r=0.02+Math.random()*0.08;
    spawnOut(Math.sin(p)*Math.cos(t)*r,Math.sin(p)*Math.sin(t)*r,Math.cos(p)*r);
  }
}

function updateTips(){
  for(const t of tips){
    if(!t.alive)continue;
    t.age++;
    const dist=Math.hypot(t.x,t.y,t.z);
    let pull,dirX,dirY,dirZ;
    if(t.dir==='in'){
      pull=0.30+0.22/Math.max(0.08,dist);
      dirX=dist>0.001?-t.x/dist:Math.random()-0.5;
      dirY=dist>0.001?-t.y/dist:Math.random()-0.5;
      dirZ=dist>0.001?-t.z/dist:Math.random()-0.5;
    } else {
      pull=0.26+0.18*dist;
      dirX=dist>0.001?t.x/dist:Math.random()-0.5;
      dirY=dist>0.001?t.y/dist:Math.random()-0.5;
      dirZ=dist>0.001?t.z/dist:Math.random()-0.5;
    }
    const n1=(Math.random()-0.5)*0.2,n2=(Math.random()-0.5)*0.2,n3=(Math.random()-0.5)*0.2;
    const cx=dirX*pull+n1,cy=dirY*pull+n2,cz=dirZ*pull+n3;
    const spd=0.012+0.006*(t.dir==='in'?1-dist:dist);
    const nx2=t.dx+cx*spd*2.1,ny2=t.dy+cy*spd*2.1,nz2=t.dz+cz*spd*2.1;
    const nl=Math.hypot(nx2,ny2,nz2)||1;
    t.dx=nx2/nl;t.dy=ny2/nl;t.dz=nz2/nl;
    const wdamp=Math.abs(t.y+t.dy*spd-SEA_Y)<0.08?0.52:1.0;
    t.trail3.push([t.x,t.y,t.z]);
    if(t.trail3.length>100)t.trail3.shift();
    t.x+=t.dx*spd*wdamp;t.y+=t.dy*spd;t.z+=t.dz*spd*wdamp;
    const nd=Math.hypot(t.x,t.y,t.z);
    t.melanin=t.dir==='in'?Math.min(1,1-nd):Math.min(1,nd/WORLD_R);
    if(t.dir==='in'&&nd<0.07){
      cntIn++;
      contracts.push({spline:catmullRom(t.trail3,4),dir:'in',melanin:t.melanin});
      t.alive=false;
      if(Math.random()<0.55){
        const a=Math.random()*Math.PI*2,pp=Math.acos(2*Math.random()-1);
        const r2=0.03+Math.random()*0.07;
        spawnOut(Math.sin(pp)*Math.cos(a)*r2,Math.sin(pp)*Math.sin(a)*r2,Math.cos(pp)*r2);
      }
      continue;
    }
    if(t.dir==='out'&&nd>=WORLD_R*0.94){
      cntOut++;
      contracts.push({spline:catmullRom(t.trail3,4),dir:'out',melanin:t.melanin});
      t.alive=false;
      if(Math.random()<0.45) spawnIn();
      continue;
    }
    if(t.dir==='in'){
      for(const t2 of tips){
        if(!t2.alive||t2.dir!=='out')continue;
        const dd=Math.hypot(t.x-t2.x,t.y-t2.y,t.z-t2.z);
        if(dd<0.09){
          cntBi++;
          midContracts.push({x:(t.x+t2.x)/2,y:(t.y+t2.y)/2,z:(t.z+t2.z)/2,age:0});
          contracts.push({spline:catmullRom(t.trail3,4),dir:'in',melanin:t.melanin});
          contracts.push({spline:catmullRom(t2.trail3,4),dir:'out',melanin:t2.melanin});
          t.alive=false;t2.alive=false;
          break;
        }
      }
    }
    const bc=0.002+(t.dir==='out'?dist*0.004:0);
    if(Math.random()<bc&&tips.length<360){
      if(t.dir==='in') spawnIn();
      else spawnOut(t.x+(Math.random()-0.5)*0.05,t.y+(Math.random()-0.5)*0.05,t.z+(Math.random()-0.5)*0.05);
    }
  }
  tips=tips.filter(t=>t.alive);
  for(const m of midContracts) m.age++;
  if(tips.filter(t=>t.dir==='in').length<8) for(let i=0;i<7;i++) spawnIn();
  if(tips.filter(t=>t.dir==='out').length<6) for(let i=0;i<5;i++) spawnOut();
}

function colIn(m,al){const r=Math.round(205-m*180),g=Math.round(105-m*95),b=Math.round(22-m*20);return`rgba(${r},${g},${b},${al})`;}
function colOut(m,al){const r=Math.round(0+m*22),g=Math.round(228-m*150),b=Math.round(188-m*135);return`rgba(${r},${g},${b},${al})`;}

function drawSpline(pts,colorFn,baseAlpha,baseWidth,Q2){
  if(pts.length<2)return;
  // smooth spline through projected 2D points
  const projected=[];
  for(const p of pts){
    const rv=qV(p,Q2);
    const[sx,sy,sz]=prj(rv[0],rv[1],rv[2]);
    projected.push([sx,sy,sz]);
  }
  // draw with varying melanin along length
  for(let i=1;i<projected.length;i++){
    const[x0,y0]=projected[i-1],[x1,y1]=projected[i];
    if(!inCircle(x0,y0)&&!inCircle(x1,y1))continue;
    const prog=i/projected.length;
    const m=prog;
    G.beginPath();G.moveTo(x0,y0);G.lineTo(x1,y1);
    G.strokeStyle=colorFn(m,baseAlpha+prog*0.25);
    G.lineWidth=baseWidth+prog*0.35;
    G.stroke();
  }
}

// boolean density overlay — drawn ONCE per frame from accumulated grid
function renderDensity(){
  const cellW=(SR*2)/GRID,cellH=(SR*2)/GRID;
  const ox=CX-SR,oy=CY-SR;
  for(let gy=0;gy<GRID;gy++){
    for(let gx=0;gx<GRID;gx++){
      const i=gy*GRID+gx;
      const d=density[i];
      if(d<0.015)continue;
      const sx=ox+gx*cellW+cellW/2,sy=oy+gy*cellH+cellH/2;
      if(!inCircle(sx,sy))continue;
      const inVal=inDensity[i],outVal=outDensity[i];
      // boolean union: blend inward (amber) and outward (teal) by relative density
      const total=inVal+outVal+0.001;
      const ri=Math.round(180*(inVal/total)+0*(outVal/total));
      const gi=Math.round(80*(inVal/total)+180*(outVal/total));
      const bi=Math.round(20*(inVal/total)+140*(outVal/total));
      // boolean intersection zone: both > threshold → gold
      const isIntersect=inVal>0.15&&outVal>0.15;
      const r2=isIntersect?180:ri,g2=isIntersect?170:gi,b2=isIntersect?40:bi;
      G.fillStyle=`rgba(${r2},${g2},${b2},${Math.min(0.35,d*0.42)})`;
      G.beginPath();G.arc(sx,sy,cellW*0.72,0,Math.PI*2);G.fill();
    }
  }
}

let corePulse=0;
function render(){
  G.clearRect(0,0,W,H);
  G.beginPath();G.arc(CX,CY,SR,0,Math.PI*2);G.fillStyle='#020402';G.fill();
  G.save();G.beginPath();G.arc(CX,CY,SR,0,Math.PI*2);G.clip();

  let ss=98765;const rng=()=>{ss=(ss*1664525+1013904223)>>>0;return ss/4294967295;};
  for(let i=0;i<80;i++){
    const t=rng()*Math.PI*2,p=Math.acos(2*rng()-1),r=0.15+rng()*0.8;
    const v=qV([Math.sin(p)*Math.cos(t)*r,Math.sin(p)*Math.sin(t)*r,Math.cos(p)*r],Q);
    const[sx,sy]=prj(v[0],v[1],v[2]);
    if(!inCircle(sx,sy))continue;
    G.fillStyle=`rgba(30,50,25,${0.022*(1-Math.hypot(sx-CX,sy-CY)/SR)})`;
    G.beginPath();G.arc(sx,sy,rng()*1.0+0.3,0,Math.PI*2);G.fill();
  }

  // boolean density field (accumulated volume)
  renderDensity();

  // water plane
  G.beginPath();let first=true;
  for(let a=0;a<=Math.PI*2+0.01;a+=0.11){
    const WR=Math.sqrt(Math.max(0,1-SEA_Y*SEA_Y))*0.98;
    const rv=qV([Math.cos(a)*WR,SEA_Y,Math.sin(a)*WR],Q);
    const[sx,sy]=prj(rv[0],rv[1],rv[2]);
    if(first){G.moveTo(sx,sy);first=false;}else G.lineTo(sx,sy);
  }
  G.closePath();
  G.fillStyle='rgba(12,42,52,0.18)';G.fill();
  G.strokeStyle='rgba(20,100,75,0.2)';G.lineWidth=0.7;G.stroke();

  // stamp and draw permanent contracts as splines
  for(const c of contracts){
    if(c.spline.length<2)continue;
    const col=c.dir==='in'?colIn:colOut;
    drawSpline(c.spline,col,0.18,0.5,Q);
    // stamp density from this contract's midpoints
    if(FR%8===0){
      const step=Math.max(1,Math.floor(c.spline.length/12));
      for(let i=0;i<c.spline.length;i+=step){
        const rv=qV(c.spline[i],Q);
        const[sx,sy]=prj(rv[0],rv[1],rv[2]);
        if(inCircle(sx,sy)) stampDensity(sx,sy,0.006,c.dir);
      }
    }
  }

  // live tips — spline through recent trail
  for(const t of tips){
    if(t.trail3.length<4)continue;
    const recent=t.trail3.slice(-40);
    const spline=catmullRom(recent,3);
    const col=t.dir==='in'?colIn:colOut;
    drawSpline(spline,col,0.08,0.4,Q);
    // stamp tip position into density
    if(FR%4===0){
      const rv=qV([t.x,t.y,t.z],Q);
      const[sx,sy]=prj(rv[0],rv[1],rv[2]);
      if(inCircle(sx,sy)) stampDensity(sx,sy,0.01,t.dir);
    }
    // tip dot
    const rp=qV([t.x,t.y,t.z],Q);
    const[tdx,tdy]=prj(rp[0],rp[1],rp[2]);
    if(inCircle(tdx,tdy)){
      const gc=t.dir==='in'?'rgba(255,160,40,':'rgba(0,255,185,';
      const tg=G.createRadialGradient(tdx,tdy,0,tdx,tdy,2.8);
      tg.addColorStop(0,gc+'0.9)');tg.addColorStop(1,gc+'0)');
      G.beginPath();G.arc(tdx,tdy,2.8,0,Math.PI*2);G.fillStyle=tg;G.fill();
      G.beginPath();G.arc(tdx,tdy,1.1,0,Math.PI*2);
      G.fillStyle=t.dir==='in'?'rgba(255,230,180,0.9)':'rgba(180,255,230,0.9)';G.fill();
    }
  }

  // bilateral junction flares
  for(const m of midContracts){
    const rv=qV([m.x,m.y,m.z],Q);
    const[sx,sy]=prj(rv[0],rv[1],rv[2]);
    if(!inCircle(sx,sy))continue;
    const fade=Math.max(0,1-m.age/140);
    if(fade<0.01)continue;
    const jg=G.createRadialGradient(sx,sy,0,sx,sy,10);
    jg.addColorStop(0,`rgba(220,220,70,${fade*0.9})`);
    jg.addColorStop(0.45,`rgba(150,200,70,${fade*0.3})`);
    jg.addColorStop(1,'rgba(0,0,0,0)');
    G.beginPath();G.arc(sx,sy,10,0,Math.PI*2);G.fillStyle=jg;G.fill();
    if(FR%6===0) stampDensity(sx,sy,0.025,'in'),stampDensity(sx,sy,0.025,'out');
  }

  // core
  corePulse+=0.04;
  const cp=qV([0,0,0],Q);
  const[cpx,cpy]=prj(cp[0],cp[1],cp[2]);
  const glow=20+Math.sin(corePulse)*5;
  const cg1=G.createRadialGradient(cpx,cpy,1,cpx,cpy,glow);
  cg1.addColorStop(0,'rgba(255,160,40,0.85)');
  cg1.addColorStop(0.35,'rgba(200,80,10,0.38)');
  cg1.addColorStop(0.7,'rgba(120,30,5,0.1)');
  cg1.addColorStop(1,'rgba(0,0,0,0)');
  G.beginPath();G.arc(cpx,cpy,glow,0,Math.PI*2);G.fillStyle=cg1;G.fill();
  const cg2=G.createRadialGradient(cpx,cpy,0,cpx,cpy,glow*0.5);
  cg2.addColorStop(0,'rgba(0,240,175,0.6)');
  cg2.addColorStop(0.5,'rgba(0,155,120,0.18)');
  cg2.addColorStop(1,'rgba(0,0,0,0)');
  G.beginPath();G.arc(cpx,cpy,glow*0.5,0,Math.PI*2);G.fillStyle=cg2;G.fill();
  G.beginPath();G.arc(cpx,cpy,2.5,0,Math.PI*2);G.fillStyle='rgba(240,240,200,0.95)';G.fill();

  // expanding/contracting rings
  for(let ri=0;ri<5;ri++){
    const isOut=ri%2===0;
    const phase=(FR*0.006+ri*0.2)%1;
    const rRad=isOut?phase*0.65:(1-phase)*0.65;
    G.beginPath();let firstR=true;
    for(let a=0;a<=Math.PI*2+0.05;a+=0.11){
      const rv=qV([Math.cos(a)*rRad*0.6,Math.sin(a)*rRad*0.38,Math.sin(a+ri)*rRad*0.48],Q);
      const[sx,sy]=prj(rv[0],rv[1],rv[2]);
      if(firstR){G.moveTo(sx,sy);firstR=false;}else G.lineTo(sx,sy);
    }
    G.strokeStyle=isOut?`rgba(0,195,135,${0.07*(1-phase)})`:`rgba(255,125,18,${0.065*phase})`;
    G.lineWidth=0.55;G.stroke();
  }

  G.restore();
  // glass
  const r1=G.createRadialGradient(CX,CY,SR-12,CX,CY,SR+2);
  r1.addColorStop(0,'rgba(0,0,0,0)');r1.addColorStop(0.55,'rgba(0,0,0,0.22)');r1.addColorStop(1,'rgba(0,0,0,0.92)');
  G.beginPath();G.arc(CX,CY,SR+2,0,Math.PI*2);G.fillStyle=r1;G.fill();
  const r2=G.createRadialGradient(CX-80,CY-80,3,CX-48,CY-48,SR*0.68);
  r2.addColorStop(0,'rgba(210,195,155,0.08)');r2.addColorStop(0.4,'rgba(190,175,135,0.02)');r2.addColorStop(1,'rgba(0,0,0,0)');
  G.beginPath();G.arc(CX,CY,SR,0,Math.PI*2);G.fillStyle=r2;G.fill();
  G.beginPath();G.arc(CX,CY,SR,0,Math.PI*2);
  G.strokeStyle='rgba(110,135,75,0.18)';G.lineWidth=1.5;G.stroke();
  const r3=G.createRadialGradient(CX,CY,SR,CX,CY,SR+14);
  r3.addColorStop(0,'rgba(35,55,18,0.07)');r3.addColorStop(1,'rgba(0,0,0,0)');
  G.beginPath();G.arc(CX,CY,SR+14,0,Math.PI*2);G.fillStyle=r3;G.fill();

  // hud
  const filled=density.filter(v=>v>0.05).length;
  const pct=Math.round(filled/(GRID*GRID)*100);
  document.getElementById('bin').textContent=cntIn;
  document.getElementById('bout').textContent=cntOut;
  document.getElementById('bbi').textContent=cntBi;
  document.getElementById('bvol').textContent=pct;
}

cv.addEventListener('mousedown',e=>{DRG=true;DB=e.button;LX=e.clientX;LY=e.clientY;e.preventDefault();});
window.addEventListener('mouseup',()=>{DRG=false;});
window.addEventListener('mousemove',e=>{
  if(!DRG)return;
  const dx=(e.clientX-LX)/SR,dy=(e.clientY-LY)/SR;
  LX=e.clientX;LY=e.clientY;
  if(DB===2)Q=qN(qM(qA(0,0,1,dx*2.4),Q));
  else Q=qN(qM(qA(0,1,0,-dx*2.2),qM(qA(1,0,0,dy*2.2),Q)));
});
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{ZM=Math.max(0.3,Math.min(5,ZM*(e.deltaY>0?0.91:1.1)));e.preventDefault();},{passive:false});
window.addEventListener('keydown',e=>{
  const s=0.05;
  if(e.key==='ArrowLeft')Q=qN(qM(qA(0,1,0,s),Q));
  if(e.key==='ArrowRight')Q=qN(qM(qA(0,1,0,-s),Q));
  if(e.key==='ArrowUp')Q=qN(qM(qA(1,0,0,-s),Q));
  if(e.key==='ArrowDown')Q=qN(qM(qA(1,0,0,s),Q));
  if(e.key==='q'||e.key==='Q')Q=qN(qM(qA(0,0,1,-s),Q));
  if(e.key==='e'||e.key==='E')Q=qN(qM(qA(0,0,1,s),Q));
  if(e.key==='+'||e.key==='=')ZM=Math.min(5,ZM*1.12);
  if(e.key==='-')ZM=Math.max(0.3,ZM/1.12);
});
let TP4={};
cv.addEventListener('touchstart',e=>{e.preventDefault();for(const t of e.changedTouches)TP4[t.identifier]={x:t.clientX,y:t.clientY};},{passive:false});
cv.addEventListener('touchend',e=>{for(const t of e.changedTouches)delete TP4[t.identifier];},{passive:false});
cv.addEventListener('touchmove',e=>{
  e.preventDefault();
  const tl=[...e.changedTouches];
  if(Object.keys(TP4).length<=1&&tl.length>=1){
    const t=tl[0];const pv=TP4[t.identifier];
    if(pv){const dx=(t.clientX-pv.x)/SR,dy=(t.clientY-pv.y)/SR;Q=qN(qM(qA(0,1,0,-dx*2.2),qM(qA(1,0,0,dy*2.2),Q)));}
    TP4[t.identifier]={x:t.clientX,y:t.clientY};
  } else if(tl.length>=2){
    const t1=tl[0],t2=tl[1],p1=TP4[t1.identifier],p2=TP4[t2.identifier];
    if(p1&&p2){
      const pa=Math.atan2(p1.y-p2.y,p1.x-p2.x),na=Math.atan2(t1.clientY-t2.clientY,t1.clientX-t2.clientX);
      Q=qN(qM(qA(0,0,1,na-pa),Q));
      const pd=Math.hypot(p1.x-p2.x,p1.y-p2.y),nd=Math.hypot(t1.clientX-t2.clientX,t1.clientY-t2.clientY);
      if(pd>5)ZM=Math.max(0.3,Math.min(5,ZM*nd/pd));
    }
    TP4[t1.identifier]={x:t1.clientX,y:t1.clientY};TP4[t2.identifier]={x:t2.clientX,y:t2.clientY};
  }
},{passive:false});

function loop(){
  FR++;
  Q=qN(qM(qA(0,1,0,0.0016),Q));
  updateTips();
  render();
  requestAnimationFrame(loop);
}
seed();loop();