const cv=document.getElementById('hsc');
const G=cv.getContext('2d');
const W=520,H=520,SR=242,CX=260,CY=260;
const WORLD_R=1.0;
const SEA_Y=-0.12;

// quaternion
const qM=(a,b)=>[a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
const qN=q=>{const m=Math.hypot(q[0],q[1],q[2],q[3]);return[q[0]/m,q[1]/m,q[2]/m,q[3]/m];};
const qA=(ax,ay,az,a)=>{const s=Math.sin(a/2),c=Math.cos(a/2);return[c,ax*s,ay*s,az*s];};
const qV=(v,q)=>{const[w,qx,qy,qz]=q,[vx,vy,vz]=v;const cx=qy*vz-qz*vy,cy=qz*vx-qx*vz,cz=qx*vy-qy*vx;return[vx+2*(w*cx+qy*cz-qz*cy),vy+2*(w*cy+qz*cx-qx*cz),vz+2*(w*cz+qx*cy-qy*cx)];};

let Q=qN(qA(0.3,0.7,0.2,0.5));
let ZM=1.0,DRG=false,DB=0,LX=0,LY=0,FR=0;

function prj(nx,ny,nz){
  const a=Math.acos(Math.max(-1,Math.min(1,nz)));
  const rr=a/Math.PI*SR*ZM;
  const p=Math.hypot(nx,ny);
  if(p<1e-6)return[CX,CY,nz];
  return[CX+nx/p*rr,CY+ny/p*rr,nz];
}
function inCircle(sx,sy){return(sx-CX)**2+(sy-CY)**2<SR*SR;}

// 3D tips — grow from random points on sphere wall inward toward core
// radiotropism: steer toward (0,0,0)
let tips=[],contracts=[],nodes=[];
let contractCount=0;

function spawnTip(ox,oy,oz){
  const l=Math.hypot(ox,oy,oz);
  const nx=ox/l,ny=oy/l,nz=oz/l;
  tips.push({x:ox,y:oy,z:oz,dx:-nx+(Math.random()-0.5)*0.4,dy:-ny+(Math.random()-0.5)*0.4,dz:-nz+(Math.random()-0.5)*0.4,energy:1,melanin:0,trail3:[],alive:true,age:0,stopped:false});
}

function seedTips(){
  const N=48;
  for(let i=0;i<N;i++){
    const t=Math.random()*Math.PI*2,p=Math.acos(2*Math.random()-1);
    const r=WORLD_R*(0.75+Math.random()*0.25);
    spawnTip(Math.sin(p)*Math.cos(t)*r,Math.sin(p)*Math.sin(t)*r,Math.cos(p)*r);
  }
}

function updateTips(){
  for(const t of tips){
    if(!t.alive)continue;
    t.age++;
    // radiotropism: pull toward core
    const dist=Math.hypot(t.x,t.y,t.z);
    if(dist<0.001){t.alive=false;contractCount++;continue;}
    const rad_pull=0.35+0.25/Math.max(0.1,dist);
    const noise=(Math.random()-0.5)*0.18;
    const noise2=(Math.random()-0.5)*0.18;
    const noise3=(Math.random()-0.5)*0.18;
    const cx=-t.x/dist*rad_pull+noise;
    const cy=-t.y/dist*rad_pull+noise2;
    const cz=-t.z/dist*rad_pull+noise3;
    const spd=0.014+0.008*(1-dist);
    const nx=t.dx+cx*spd*2.2;
    const ny=t.dy+cy*spd*2.2;
    const nz=t.dz+cz*spd*2.2;
    const nl=Math.hypot(nx,ny,nz);
    t.dx=nx/nl;t.dy=ny/nl;t.dz=nz/nl;
    const newX=t.x+t.dx*spd;
    const newY=t.y+t.dy*spd;
    const newZ=t.z+t.dz*spd;
    // water slow at sea level
    const waterDamp=(Math.abs(newY-SEA_Y)<0.08)?0.55:1.0;
    t.trail3.push([t.x,t.y,t.z]);
    if(t.trail3.length>90)t.trail3.shift();
    t.x=newX*waterDamp+(1-waterDamp)*t.x;
    t.y=newY;
    t.z=newZ*waterDamp+(1-waterDamp)*t.z;
    // melanin: increases near core
    const newDist=Math.hypot(t.x,t.y,t.z);
    t.melanin=Math.min(1,t.melanin+0.008*(1-newDist));
    t.energy=newDist;
    // stop near core
    if(newDist<0.06){
      contractCount++;
      contracts.push({trail3:t.trail3.slice(),melanin:t.melanin});
      t.alive=false;
      if(Math.random()<0.35){
        // spawn two outward tips from near core
        const a=Math.random()*Math.PI*2,pp=Math.acos(2*Math.random()-1);
        spawnTip(Math.sin(pp)*Math.cos(a)*0.12,Math.sin(pp)*Math.sin(a)*0.12,Math.cos(pp)*0.12);
      }
    }
    // branch occasionally
    if(Math.random()<0.003&&tips.length<300){
      spawnTip(t.x+(Math.random()-0.5)*0.05,t.y+(Math.random()-0.5)*0.05,t.z+(Math.random()-0.5)*0.05);
    }
  }
  tips=tips.filter(t=>t.alive);
  if(tips.length<18)seedTips();
}

function melaninColor(m,alpha){
  // low melanin (near surface) = amber; high melanin (near core) = near black
  const r=Math.round(180-m*165);
  const g=Math.round(90-m*85);
  const b=Math.round(20-m*18);
  return`rgba(${r},${g},${b},${alpha})`;
}

// build sorted render list
function buildRenderList(){
  const items=[];
  // water plane — rendered as ellipse at SEA_Y
  const wy=SEA_Y;
  const wp=qV([0,wy,0],Q);
  items.push({type:'water',wy,rz:wp[2]});

  // permanent contracts
  for(const c of contracts){
    for(let i=1;i<c.trail3.length;i++){
      const[x0,y0,z0]=c.trail3[i-1];
      const[x1,y1,z1]=c.trail3[i];
      const rm=qV([(x0+x1)/2,(y0+y1)/2,(z0+z1)/2],Q);
      items.push({type:'seg',p0:qV([x0,y0,z0],Q),p1:qV([x1,y1,z1],Q),melanin:c.melanin,alpha:0.28,rz:rm[2],width:0.55});
    }
  }

  // live tips
  for(const t of tips){
    if(t.trail3.length<2)continue;
    for(let i=Math.max(0,t.trail3.length-40);i<t.trail3.length-1;i++){
      const[x0,y0,z0]=t.trail3[i];
      const[x1,y1,z1]=t.trail3[i+1];
      const prog=i/t.trail3.length;
      const rm=qV([(x0+x1)/2,(y0+y1)/2,(z0+z1)/2],Q);
      items.push({type:'seg',p0:qV([x0,y0,z0],Q),p1:qV([x1,y1,z1],Q),melanin:t.melanin*(prog*0.4+0.6),alpha:0.12+prog*0.35,rz:rm[2],width:0.5+t.melanin*0.4});
    }
    // tip dot
    const rp=qV([t.x,t.y,t.z],Q);
    items.push({type:'dot',p:rp,melanin:t.melanin,rz:rp[2]});
  }

  items.sort((a,b)=>a.rz-b.rz);
  return items;
}

let corePulse=0;

function render(){
  G.clearRect(0,0,W,H);
  // sphere bg — deep dark interior
  G.beginPath();G.arc(CX,CY,SR,0,Math.PI*2);G.fillStyle='#060302';G.fill();
  G.save();G.beginPath();G.arc(CX,CY,SR,0,Math.PI*2);G.clip();

  // interior stars / dust
  const lcg=s=>{s=(s*1664525+1013904223)>>>0;return s/4294967295;};
  let ss=98765;const rng=()=>{ss=(ss*1664525+1013904223)>>>0;return ss/4294967295;};
  G.fillStyle='rgba(60,40,20,0.03)';
  for(let i=0;i<120;i++){
    const t=rng()*Math.PI*2,p=Math.acos(2*rng()-1);
    const r=(0.2+rng()*0.78);
    const v=qV([Math.sin(p)*Math.cos(t)*r,Math.sin(p)*Math.sin(t)*r,Math.cos(p)*r],Q);
    const[sx,sy]=prj(v[0],v[1],v[2]);
    if(!inCircle(sx,sy))continue;
    const dr=Math.hypot(sx-CX,sy-CY)/SR;
    G.fillStyle=`rgba(80,50,20,${0.03*(1-dr)})`;
    G.beginPath();G.arc(sx,sy,rng()*1.2+0.3,0,Math.PI*2);G.fill();
  }

  const items=buildRenderList();
  for(const item of items){
    if(item.type==='water'){
      // project water circle — draw as an ellipse
      // sample the horizon ring of the water plane
      G.beginPath();
      let first=true;
      for(let a=0;a<=Math.PI*2+0.01;a+=0.12){
        const WR=Math.sqrt(Math.max(0,WORLD_R*WORLD_R-SEA_Y*SEA_Y))*0.98;
        const wx=Math.cos(a)*WR,wz=Math.sin(a)*WR;
        const rv=qV([wx,SEA_Y,wz],Q);
        const[sx,sy,sz]=prj(rv[0],rv[1],rv[2]);
        if(first){G.moveTo(sx,sy);first=false;}else{G.lineTo(sx,sy);}
      }
      G.closePath();
      G.fillStyle='rgba(20,55,90,0.22)';G.fill();
      G.strokeStyle='rgba(40,100,160,0.25)';G.lineWidth=0.7;G.stroke();
      // water surface shimmer lines
      for(let i=0;i<8;i++){
        const wx1=(-0.9+i*0.25)*WORLD_R*0.95;
        const wz1=(Math.random()-0.5)*0.6;
        const v1=qV([wx1,SEA_Y+0.003,wz1],Q);
        const v2=qV([wx1+0.18,SEA_Y+0.003,wz1],Q);
        const[s1x,s1y]=prj(v1[0],v1[1],v1[2]);
        const[s2x,s2y]=prj(v2[0],v2[1],v2[2]);
        if(!inCircle(s1x,s1y))continue;
        G.beginPath();G.moveTo(s1x,s1y);G.lineTo(s2x,s2y);
        G.strokeStyle='rgba(80,160,220,0.12)';G.lineWidth=0.5;G.stroke();
      }
    } else if(item.type==='seg'){
      const[s0x,s0y]=prj(item.p0[0],item.p0[1],item.p0[2]);
      const[s1x,s1y]=prj(item.p1[0],item.p1[1],item.p1[2]);
      if(!inCircle(s0x,s0y)&&!inCircle(s1x,s1y))continue;
      G.beginPath();G.moveTo(s0x,s0y);G.lineTo(s1x,s1y);
      G.strokeStyle=melaninColor(item.melanin,item.alpha);
      G.lineWidth=item.width;G.stroke();
    } else if(item.type==='dot'){
      const[sx,sy]=prj(item.p[0],item.p[1],item.p[2]);
      if(!inCircle(sx,sy))continue;
      G.beginPath();G.arc(sx,sy,1.4,0,Math.PI*2);
      G.fillStyle=melaninColor(item.melanin,0.8);G.fill();
    }
  }

  // core glow
  corePulse+=0.04;
  const cp=qV([0,0,0],Q);
  const[cpx,cpy]=prj(cp[0],cp[1],cp[2]);
  const glow=18+Math.sin(corePulse)*5;
  const cg=G.createRadialGradient(cpx,cpy,1,cpx,cpy,glow);
  cg.addColorStop(0,'rgba(255,180,60,0.9)');
  cg.addColorStop(0.3,'rgba(255,80,15,0.5)');
  cg.addColorStop(0.7,'rgba(180,30,5,0.18)');
  cg.addColorStop(1,'rgba(0,0,0,0)');
  G.beginPath();G.arc(cpx,cpy,glow,0,Math.PI*2);G.fillStyle=cg;G.fill();
  G.beginPath();G.arc(cpx,cpy,2.5,0,Math.PI*2);
  G.fillStyle='rgba(255,240,200,0.95)';G.fill();

  // radiation rings
  for(let ri=1;ri<=3;ri++){
    const phase=(FR*0.008+ri*0.33)%1;
    const rRad=phase*0.55;
    G.beginPath();
    let firstR=true;
    for(let a=0;a<=Math.PI*2+0.05;a+=0.1){
      const rv=qV([Math.cos(a)*rRad*0.6,Math.sin(a)*rRad*0.4,Math.sin(a+ri)*rRad*0.5],Q);
      const[sx,sy]=prj(rv[0],rv[1],rv[2]);
      if(firstR){G.moveTo(sx,sy);firstR=false;}else{G.lineTo(sx,sy);}
    }
    G.strokeStyle=`rgba(255,120,20,${0.12*(1-phase)})`;G.lineWidth=0.6;G.stroke();
  }

  G.restore();

  // glass shell
  const r1=G.createRadialGradient(CX,CY,SR-12,CX,CY,SR+2);
  r1.addColorStop(0,'rgba(0,0,0,0)');
  r1.addColorStop(0.55,'rgba(0,0,0,0.22)');
  r1.addColorStop(1,'rgba(0,0,0,0.92)');
  G.beginPath();G.arc(CX,CY,SR+2,0,Math.PI*2);G.fillStyle=r1;G.fill();

  const r2=G.createRadialGradient(CX-80,CY-80,3,CX-48,CY-48,SR*0.68);
  r2.addColorStop(0,'rgba(255,220,180,0.1)');
  r2.addColorStop(0.4,'rgba(255,200,150,0.02)');
  r2.addColorStop(1,'rgba(0,0,0,0)');
  G.beginPath();G.arc(CX,CY,SR,0,Math.PI*2);G.fillStyle=r2;G.fill();

  G.beginPath();G.arc(CX,CY,SR,0,Math.PI*2);
  G.strokeStyle='rgba(180,120,50,0.15)';G.lineWidth=1.5;G.stroke();
  const r3=G.createRadialGradient(CX,CY,SR,CX,CY,SR+14);
  r3.addColorStop(0,'rgba(80,40,10,0.08)');r3.addColorStop(1,'rgba(0,0,0,0)');
  G.beginPath();G.arc(CX,CY,SR+14,0,Math.PI*2);G.fillStyle=r3;G.fill();
}

// controls
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
let TP2={};
cv.addEventListener('touchstart',e=>{e.preventDefault();for(const t of e.changedTouches)TP2[t.identifier]={x:t.clientX,y:t.clientY};},{passive:false});
cv.addEventListener('touchend',e=>{for(const t of e.changedTouches)delete TP2[t.identifier];},{passive:false});
cv.addEventListener('touchmove',e=>{
  e.preventDefault();
  const tl=[...e.changedTouches];
  if(Object.keys(TP2).length<=1&&tl.length>=1){
    const t=tl[0];const pv=TP2[t.identifier];
    if(pv){const dx=(t.clientX-pv.x)/SR,dy=(t.clientY-pv.y)/SR;Q=qN(qM(qA(0,1,0,-dx*2.2),qM(qA(1,0,0,dy*2.2),Q)));}
    TP2[t.identifier]={x:t.clientX,y:t.clientY};
  }else if(tl.length>=2){
    const t1=tl[0],t2=tl[1],p1=TP2[t1.identifier],p2=TP2[t2.identifier];
    if(p1&&p2){
      const pa=Math.atan2(p1.y-p2.y,p1.x-p2.x),na=Math.atan2(t1.clientY-t2.clientY,t1.clientX-t2.clientX);
      Q=qN(qM(qA(0,0,1,na-pa),Q));
      const pd=Math.hypot(p1.x-p2.x,p1.y-p2.y),nd=Math.hypot(t1.clientX-t2.clientX,t1.clientY-t2.clientY);
      if(pd>5)ZM=Math.max(0.3,Math.min(5,ZM*nd/pd));
    }
    TP2[t1.identifier]={x:t1.clientX,y:t1.clientY};TP2[t2.identifier]={x:t2.clientX,y:t2.clientY};
  }
},{passive:false});

function loop(){
  FR++;
  Q=qN(qM(qA(0,1,0,0.0018),Q));
  updateTips();
  render();
  document.getElementById('hhtips').textContent=tips.length;
  document.getElementById('hhcon').textContent=contractCount;
  const pulse=FR%60<30?'active':'resting';
  document.getElementById('hrad').textContent=pulse;
  requestAnimationFrame(loop);
}

seedTips();
loop();