const cv=document.getElementById('sc');
const G=cv.getContext('2d');
const W=520,H=520,R=240,CX=260,CY=260;

// quaternion math
const qMul=(a,b)=>[
  a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
  a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
  a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
  a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]
];
const qNrm=q=>{const m=Math.hypot(q[0],q[1],q[2],q[3]);return[q[0]/m,q[1]/m,q[2]/m,q[3]/m];};
const qAx=(ax,ay,az,a)=>{const s=Math.sin(a/2),c=Math.cos(a/2);return[c,ax*s,ay*s,az*s];};
const qRV=(v,q)=>{
  const[w,qx,qy,qz]=q,[vx,vy,vz]=v;
  const cx=qy*vz-qz*vy,cy=qz*vx-qx*vz,cz=qx*vy-qy*vx;
  return[vx+2*(w*cx+qy*cz-qz*cy),vy+2*(w*cy+qz*cx-qx*cz),vz+2*(w*cz+qx*cy-qy*cx)];
};

// equal-angle fisheye: full sphere → circle at zoom=1
function prj(nx,ny,nz,zm){
  const a=Math.acos(Math.max(-1,Math.min(1,nz)));
  const rr=a/Math.PI*R*zm;
  const p=Math.hypot(nx,ny);
  if(p<1e-5)return[CX,CY];
  const sc=rr/p;
  return[CX+nx*sc,CY+ny*sc];
}
function ic(sx,sy){return(sx-CX)**2+(sy-CY)**2<R*R*1.6;}

// state
let Q=qNrm(qAx(0.4,0.7,0.1,0.6));
let ZM=1.0,AUTO=true,DRG=false,DB=0,LX=0,LY=0;

// deterministic rng
function lcg(s){return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967295;};}
const rA=lcg(31415),rB=lcg(27182),rC=lcg(14142),rD=lcg(57721);

// background stars
const NS=2400;
const SDX=new Float32Array(NS),SDY=new Float32Array(NS),SDZ=new Float32Array(NS);
const SBR=new Float32Array(NS),SSZ=new Float32Array(NS);
const SCR=new Uint8Array(NS),SCG=new Uint8Array(NS),SCB=new Uint8Array(NS);
for(let i=0;i<NS;i++){
  const t=rA()*Math.PI*2,p=Math.acos(2*rA()-1);
  SDX[i]=Math.sin(p)*Math.cos(t);SDY[i]=Math.sin(p)*Math.sin(t);SDZ[i]=Math.cos(p);
  SBR[i]=Math.pow(rA(),1.9);SSZ[i]=0.4+rA()*1.6;
  const c=rA();
  if(c<0.07){SCR[i]=155;SCG[i]=175;SCB[i]=255;}
  else if(c<0.18){SCR[i]=255;SCG[i]=215;SCB[i]=165;}
  else if(c<0.26){SCR[i]=255;SCG[i]=145;SCB[i]=125;}
  else{SCR[i]=248;SCG[i]=248;SCB[i]=255;}
}

// milky way band
const NMW=640;
const MWDX=new Float32Array(NMW),MWDY=new Float32Array(NMW),MWDZ=new Float32Array(NMW);
const MWBR=new Float32Array(NMW),MWSZ=new Float32Array(NMW);
const mn=[0.5,0.7,0.5],mnl=Math.hypot(...mn);mn[0]/=mnl;mn[1]/=mnl;mn[2]/=mnl;
const mu=[-mn[1],mn[0],0],mul=Math.hypot(...mu);mu[0]/=mul;mu[1]/=mul;
const mv=[mn[1]*mu[2]-mn[2]*mu[1],mn[2]*mu[0]-mn[0]*mu[2],mn[0]*mu[1]-mn[1]*mu[0]];
for(let i=0;i<NMW;i++){
  const a=rB()*Math.PI*2,sp=(rB()-0.5)*0.26;
  const ca=Math.cos(a),sa=Math.sin(a);
  let x=ca*mu[0]+sa*mv[0]+sp*mn[0];
  let y=ca*mu[1]+sa*mv[1]+sp*mn[1];
  let z=ca*mu[2]+sa*mv[2]+sp*mn[2];
  const l=Math.hypot(x,y,z);
  MWDX[i]=x/l;MWDY[i]=y/l;MWDZ[i]=z/l;
  MWBR[i]=0.06+rB()*0.22;MWSZ[i]=0.4+rB()*0.9;
}

// nebulae
const NCOLS=[[80,120,255],[255,80,110],[100,220,178],[200,90,255],[255,150,60],[120,255,150],[55,178,255],[255,200,100],[180,80,255],[100,255,200],[255,110,80],[80,200,255],[200,255,120],[255,160,80]];
const NEBS=NCOLS.map(col=>{
  const t=rC()*Math.PI*2,p=Math.acos(2*rC()-1);
  return{dx:Math.sin(p)*Math.cos(t),dy:Math.sin(p)*Math.sin(t),dz:Math.cos(p),col,sz:22+rC()*80,al:0.025+rC()*0.065};
});

// distant galaxies
const GALS=Array.from({length:9},()=>{
  const t=rD()*Math.PI*2,p=Math.acos(2*rD()-1);
  return{dx:Math.sin(p)*Math.cos(t),dy:Math.sin(p)*Math.sin(t),dz:Math.cos(p),sz:5+rD()*13,al:0.1+rD()*0.26};
});

// planet from our sessions
const PDR=(v=>{const l=Math.hypot(...v);return v.map(x=>x/l);})([0.55,-0.15,0.82]);

// controls
cv.addEventListener('mousedown',e=>{DRG=true;DB=e.button;LX=e.clientX;LY=e.clientY;AUTO=false;document.getElementById('smode').textContent='○ exploring';e.preventDefault();});
window.addEventListener('mouseup',()=>{DRG=false;});
window.addEventListener('mousemove',e=>{
  if(!DRG)return;
  const dx=(e.clientX-LX)/R,dy=(e.clientY-LY)/R;
  LX=e.clientX;LY=e.clientY;
  if(DB===2){Q=qNrm(qMul(qAx(0,0,1,dx*2.2),Q));}
  else{Q=qNrm(qMul(qAx(0,1,0,-dx*2),qMul(qAx(1,0,0,dy*2),Q)));}
});
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{
  ZM=Math.max(0.35,Math.min(5,ZM*(e.deltaY>0?0.92:1.087)));
  document.getElementById('szm').textContent=ZM.toFixed(2);
  e.preventDefault();
},{passive:false});

// keyboard 6dof
window.addEventListener('keydown',e=>{
  const sp=0.045;
  if(e.key==='ArrowLeft')Q=qNrm(qMul(qAx(0,1,0,sp),Q));
  if(e.key==='ArrowRight')Q=qNrm(qMul(qAx(0,1,0,-sp),Q));
  if(e.key==='ArrowUp')Q=qNrm(qMul(qAx(1,0,0,-sp),Q));
  if(e.key==='ArrowDown')Q=qNrm(qMul(qAx(1,0,0,sp),Q));
  if(e.key==='q'||e.key==='Q')Q=qNrm(qMul(qAx(0,0,1,-sp),Q));
  if(e.key==='e'||e.key==='E')Q=qNrm(qMul(qAx(0,0,1,sp),Q));
  if(e.key==='+'||e.key==='=')ZM=Math.min(5,ZM*1.1);
  if(e.key==='-')ZM=Math.max(0.35,ZM/1.1);
  AUTO=false;document.getElementById('smode').textContent='○ exploring';
  document.getElementById('szm').textContent=ZM.toFixed(2);
});

// touch
let TP={};
cv.addEventListener('touchstart',e=>{e.preventDefault();AUTO=false;document.getElementById('smode').textContent='○ exploring';for(let t of e.changedTouches)TP[t.identifier]={x:t.clientX,y:t.clientY};},{passive:false});
cv.addEventListener('touchend',e=>{for(let t of e.changedTouches)delete TP[t.identifier];},{passive:false});
cv.addEventListener('touchmove',e=>{
  e.preventDefault();
  const tl=[...e.changedTouches];
  const ids=Object.keys(TP).length;
  if(ids<=1){
    const t=tl[0];const pv=TP[t.identifier];
    if(pv){const dx=(t.clientX-pv.x)/R,dy=(t.clientY-pv.y)/R;Q=qNrm(qMul(qAx(0,1,0,-dx*2),qMul(qAx(1,0,0,dy*2),Q)));}
    TP[t.identifier]={x:t.clientX,y:t.clientY};
  }else if(tl.length>=2){
    const t1=tl[0],t2=tl[1];
    const p1=TP[t1.identifier],p2=TP[t2.identifier];
    if(p1&&p2){
      const pa=Math.atan2(p1.y-p2.y,p1.x-p2.x),na=Math.atan2(t1.clientY-t2.clientY,t1.clientX-t2.clientX);
      Q=qNrm(qMul(qAx(0,0,1,na-pa),Q));
      const pd=Math.hypot(p1.x-p2.x,p1.y-p2.y),nd=Math.hypot(t1.clientX-t2.clientX,t1.clientY-t2.clientY);
      if(pd>5)ZM=Math.max(0.35,Math.min(5,ZM*nd/pd));
    }
    TP[t1.identifier]={x:t1.clientX,y:t1.clientY};
    TP[t2.identifier]={x:t2.clientX,y:t2.clientY};
  }
},{passive:false});

function render(){
  G.fillStyle='#000308';
  G.beginPath();G.arc(CX,CY,R,0,Math.PI*2);G.fill();
  G.save();G.beginPath();G.arc(CX,CY,R,0,Math.PI*2);G.clip();

  // nebulae
  for(const n of NEBS){
    const[rx,ry,rz]=qRV([n.dx,n.dy,n.dz],Q);
    const[sx,sy]=prj(rx,ry,rz,ZM);
    if(!ic(sx,sy))continue;
    const fd=Math.max(0,(rz+1)*0.5);
    const[nr,ng,nb]=n.col;
    const sr=n.sz*(0.5+0.5*fd);
    const gg=G.createRadialGradient(sx,sy,0,sx,sy,sr);
    gg.addColorStop(0,`rgba(${nr},${ng},${nb},${n.al*fd*3})`);
    gg.addColorStop(0.55,`rgba(${nr},${ng},${nb},${n.al*fd})`);
    gg.addColorStop(1,'rgba(0,0,0,0)');
    G.fillStyle=gg;G.beginPath();G.arc(sx,sy,sr,0,Math.PI*2);G.fill();
  }

  // distant galaxies
  for(const g of GALS){
    const[rx,ry,rz]=qRV([g.dx,g.dy,g.dz],Q);
    const[sx,sy]=prj(rx,ry,rz,ZM);
    if(!ic(sx,sy))continue;
    G.save();G.translate(sx,sy);G.scale(1,0.36);
    G.fillStyle=`rgba(220,215,240,${g.al})`;
    G.beginPath();G.arc(0,0,g.sz,0,Math.PI*2);G.fill();
    G.restore();
  }

  // milky way
  for(let i=0;i<NMW;i++){
    const[rx,ry,rz]=qRV([MWDX[i],MWDY[i],MWDZ[i]],Q);
    const[sx,sy]=prj(rx,ry,rz,ZM);
    if(!ic(sx,sy))continue;
    G.fillStyle=`rgba(215,205,188,${MWBR[i]*0.65})`;
    G.beginPath();G.arc(sx,sy,MWSZ[i],0,Math.PI*2);G.fill();
  }

  // background stars
  for(let i=0;i<NS;i++){
    const[rx,ry,rz]=qRV([SDX[i],SDY[i],SDZ[i]],Q);
    const[sx,sy]=prj(rx,ry,rz,ZM);
    if(!ic(sx,sy))continue;
    const dr=Math.hypot(sx-CX,sy-CY)/R;
    const ef=dr>0.78?Math.pow(Math.max(0,1-(dr-0.78)/0.22),1.4):1;
    G.fillStyle=`rgba(${SCR[i]},${SCG[i]},${SCB[i]},${SBR[i]*ef})`;
    G.beginPath();G.arc(sx,sy,SSZ[i],0,Math.PI*2);G.fill();
  }

  // planet
  const[prx,pry,prz]=qRV(PDR,Q);
  const[ppx,ppy]=prj(prx,pry,prz,ZM);
  if(ic(ppx,ppy)){
    const pR=13;
    const pg=G.createRadialGradient(ppx,ppy,0,ppx,ppy,pR*3.2);
    pg.addColorStop(0,'rgba(80,160,220,0.2)');pg.addColorStop(1,'rgba(0,0,0,0)');
    G.fillStyle=pg;G.beginPath();G.arc(ppx,ppy,pR*3.2,0,Math.PI*2);G.fill();
    const pb=G.createRadialGradient(ppx-pR*0.35,ppy-pR*0.35,1,ppx,ppy,pR);
    pb.addColorStop(0,'#4d8a5d');pb.addColorStop(0.55,'#1a5590');pb.addColorStop(1,'#071525');
    G.fillStyle=pb;G.beginPath();G.arc(ppx,ppy,pR,0,Math.PI*2);G.fill();
    G.beginPath();G.arc(ppx,ppy,pR+2.5,0,Math.PI*2);
    G.strokeStyle='rgba(80,160,220,0.42)';G.lineWidth=2;G.stroke();
  }

  G.restore();

  // sphere glass effects
  const r1=G.createRadialGradient(CX,CY,R-14,CX,CY,R+2);
  r1.addColorStop(0,'rgba(0,0,0,0)');r1.addColorStop(0.65,'rgba(0,0,0,0.28)');r1.addColorStop(1,'rgba(0,0,0,0.93)');
  G.beginPath();G.arc(CX,CY,R+2,0,Math.PI*2);G.fillStyle=r1;G.fill();

  const r2=G.createRadialGradient(CX-88,CY-88,4,CX-52,CY-52,R*0.74);
  r2.addColorStop(0,'rgba(255,255,255,0.12)');r2.addColorStop(0.35,'rgba(255,255,255,0.025)');r2.addColorStop(1,'rgba(255,255,255,0)');
  G.beginPath();G.arc(CX,CY,R,0,Math.PI*2);G.fillStyle=r2;G.fill();

  const r3=G.createRadialGradient(CX,CY,R-1,CX,CY,R+16);
  r3.addColorStop(0,'rgba(68,110,200,0.08)');r3.addColorStop(0.5,'rgba(68,110,200,0.03)');r3.addColorStop(1,'rgba(0,0,0,0)');
  G.beginPath();G.arc(CX,CY,R+16,0,Math.PI*2);G.fillStyle=r3;G.fill();

  G.beginPath();G.arc(CX,CY,R,0,Math.PI*2);
  G.strokeStyle='rgba(100,145,225,0.18)';G.lineWidth=1.5;G.stroke();
}

let FR=0;
function loop(){
  FR++;
  if(AUTO){Q=qNrm(qMul(qAx(0,1,0,0.0022),qMul(qAx(0,0,1,0.00045),Q)));}
  render();
  requestAnimationFrame(loop);
}
loop();