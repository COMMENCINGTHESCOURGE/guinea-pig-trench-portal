const cv=document.getElementById('xc');
const G=cv.getContext('2d');
const W=520,H=520,R=240,CX=260,CY=260;

const qMul=(a,b)=>[a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
const qNrm=q=>{const m=Math.hypot(q[0],q[1],q[2],q[3]);return[q[0]/m,q[1]/m,q[2]/m,q[3]/m];};
const qAx=(ax,ay,az,a)=>{const s=Math.sin(a/2),c=Math.cos(a/2);return[c,ax*s,ay*s,az*s];};
const qRV=(v,q)=>{const[w,qx,qy,qz]=q,[vx,vy,vz]=v;const cx=qy*vz-qz*vy,cy=qz*vx-qx*vz,cz=qx*vy-qy*vx;return[vx+2*(w*cx+qy*cz-qz*cy),vy+2*(w*cy+qz*cx-qx*cz),vz+2*(w*cz+qx*cy-qy*cx)];};
const vMag=v=>Math.hypot(v[0],v[1],v[2]);
const vNrm=v=>{const m=vMag(v)||1;return[v[0]/m,v[1]/m,v[2]/m];};
const vAdd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const vSub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const vLerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
function lcg(s){return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967295;};}
const rA=lcg(31415),rB=lcg(27182),rC=lcg(14142),rD=lcg(57721);
const vRnd=()=>vNrm([rA()-0.5,rA()-0.5,rA()-0.5]);
function prj(nx,ny,nz,zm){const a=Math.acos(Math.max(-1,Math.min(1,nz)));const rr=a/Math.PI*R*zm;const p=Math.hypot(nx,ny);if(p<1e-5)return[CX,CY];return[CX+nx/p*rr,CY+ny/p*rr];}
function ic(sx,sy){return(sx-CX)**2+(sy-CY)**2<R*R*1.6;}

let Q=qNrm(qAx(0.4,0.7,0.1,0.6));
let ZM=1.0,AUTO=true,DRG=false,DB=0,LX=0,LY=0,FR=0;
let flowTime=0,flowSpeed=0.04,bands=18,spectralMode=false;

// === STRUCTURAL COLOR ENGINE ===
// In equal-angle fisheye, dr×π IS the 3D angle from forward direction
// cos(dr×π) = exact vDot equivalent from the torus shader
function structuralPhase(sx,sy){
  const dr=Math.hypot(sx-CX,sy-CY)/R;
  const angle=Math.min(dr,1)*Math.PI;
  const vdot=Math.cos(angle); // exact fisheye vDot
  return((vdot*bands+flowTime)%1+1)%1;
}

function structuralRGB(phase){
  if(!spectralMode){
    if(phase<0.333)return[0,1,1];
    if(phase<0.666)return[1,0,1];
    return[1,1,0];
  }
  // smooth spectral
  const h=phase*6;
  const x=1-Math.abs(h%2-1);
  if(h<1)return[1,x,0];if(h<2)return[x,1,0];if(h<3)return[0,1,x];
  if(h<4)return[0,x,1];if(h<5)return[x,0,1];return[1,0,x];
}

// melanin modulates brightness — biological history dims the iridescence near core
function trailColor(sx,sy,melanin,alpha){
  const phase=structuralPhase(sx,sy);
  const[r,g,b]=structuralRGB(phase);
  const bright=0.28+melanin*0.72; // core=dim, surface=bright
  const rim=1-Math.min(Math.hypot(sx-CX,sy-CY)/R,1);
  const ri=Math.round(r*bright*255),gi=Math.round(g*bright*255),bi=Math.round(b*bright*255);
  return`rgba(${ri},${gi},${bi},${alpha})`;
}

function toggleMode(){
  spectralMode=!spectralMode;
  document.getElementById('xclr').textContent=spectralMode?'● spectral':'● CMY';
  document.getElementById('xclr').style.color=spectralMode?'#f80':'#0ff';
}

// biology
const F_R_OUTER=0.95,F_R_INNER=0.09,F_SPEED=0.006,F_STEER=0.065,F_NOISE=0.32,SEA_Y=0.0;
const GDIM=52;
const densIn=new Float32Array(GDIM*GDIM),densOut=new Float32Array(GDIM*GDIM);
function stampDens(sx,sy,dir){
  const gx=Math.floor((sx-CX+R)/(R*2)*GDIM),gy=Math.floor((sy-CY+R)/(R*2)*GDIM);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=gx+dx,ny=gy+dy;if(nx<0||nx>=GDIM||ny<0||ny>=GDIM)continue;
    const f=1-Math.abs(dx)*0.35-Math.abs(dy)*0.35,i=ny*GDIM+nx;
    if(dir==='in')densIn[i]=Math.min(1,densIn[i]+0.011*f);else densOut[i]=Math.min(1,densOut[i]+0.011*f);
  }
}
function catmullSample(pts,steps){
  const out=[];if(pts.length<2)return pts.slice();
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
    for(let s=0;s<=steps;s++){
      const t=s/steps,t2=t*t,t3=t2*t;
      out.push([0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),0.5*((2*p1[2])+(-p0[2]+p2[2])*t+(2*p0[2]-5*p1[2]+4*p2[2]-p3[2])*t2+(-p0[2]+3*p1[2]-3*p2[2]+p3[2])*t3)]);
    }
  }
  return out;
}
let inwardTips=[],outwardTips=[],contracts=[],permanentSplines=[];
let contractCount=0;
function spawnIn(){const pos=vNrm([rA()-0.5,rA()-0.5,rA()-0.5]);inwardTips.push({p:[pos[0]*F_R_OUTER,pos[1]*F_R_OUTER,pos[2]*F_R_OUTER],v:vNrm([-pos[0],-pos[1],-pos[2]]),trail:[[pos[0]*F_R_OUTER,pos[1]*F_R_OUTER,pos[2]*F_R_OUTER]],active:true});}
function spawnOut(ox,oy,oz){const pos=ox!==undefined?vNrm([ox,oy,oz]):vNrm([rA()-0.5,rA()-0.5,rA()-0.5]);const r=ox!==undefined?0.06:F_R_INNER;outwardTips.push({p:[pos[0]*r,pos[1]*r,pos[2]*r],v:pos,trail:[[pos[0]*r,pos[1]*r,pos[2]*r]],active:true});}
function updateFungi(){
  if(rA()<0.14)spawnIn();if(rA()<0.14)spawnOut();
  for(const tip of inwardTips){
    if(!tip.active)continue;
    const mag=vMag(tip.p);let targetDir;
    if(mag<0.45){const scale=7.0,b=0.19;const tx=Math.sin(tip.p[1]*scale)-b*(tip.p[0]*scale);const ty=Math.sin(tip.p[2]*scale)-b*(tip.p[1]*scale);const tz=Math.sin(tip.p[0]*scale)-b*(tip.p[2]*scale);const aD=vNrm([tx,ty,tz]);const sD=vNrm([-tip.p[0],-tip.p[1],-tip.p[2]]);const blend=Math.max(0,Math.min(1,(0.45-mag)/0.35));targetDir=vNrm(vLerp(sD,aD,blend));}else{targetDir=vNrm([-tip.p[0],-tip.p[1],-tip.p[2]]);}
    let d=vLerp(tip.v,targetDir,F_STEER);d=vNrm(vAdd(d,[vRnd()[0]*F_NOISE,vRnd()[1]*F_NOISE,vRnd()[2]*F_NOISE]));
    let nx=tip.p[0]+d[0]*F_SPEED,ny=tip.p[1]+d[1]*F_SPEED,nz=tip.p[2]+d[2]*F_SPEED;
    const sld=Math.abs(ny-SEA_Y);if(sld<0.08){const dmp=0.45+sld/0.08*0.5;nx=tip.p[0]+d[0]*F_SPEED*dmp;nz=tip.p[2]+d[2]*F_SPEED*dmp;ny=tip.p[1]+d[1]*F_SPEED*0.15;}
    tip.p=[nx,ny,nz];tip.v=d;tip.trail.push([nx,ny,nz]);if(tip.trail.length>80)tip.trail.shift();
    if(vMag(tip.p)<F_R_INNER){permanentSplines.push({pts:catmullSample(tip.trail,3),dir:'in'});tip.active=false;if(rA()<0.5)spawnOut(tip.p[0],tip.p[1],tip.p[2]);}
  }
  for(const tip of outwardTips){
    if(!tip.active)continue;const targetDir=vNrm(tip.p);
    let d=vLerp(tip.v,targetDir,F_STEER);d=vNrm(vAdd(d,[vRnd()[0]*F_NOISE,vRnd()[1]*F_NOISE,vRnd()[2]*F_NOISE]));
    let nx=tip.p[0]+d[0]*F_SPEED,ny=tip.p[1]+d[1]*F_SPEED,nz=tip.p[2]+d[2]*F_SPEED;
    const sld=Math.abs(ny-SEA_Y);if(sld<0.08){const dmp=0.45+sld/0.08*0.5;nx=tip.p[0]+d[0]*F_SPEED*dmp;nz=tip.p[2]+d[2]*F_SPEED*dmp;ny=tip.p[1]+d[1]*F_SPEED*0.15;}
    tip.p=[nx,ny,nz];tip.v=d;tip.trail.push([nx,ny,nz]);if(tip.trail.length>80)tip.trail.shift();
    if(vMag(tip.p)>F_R_OUTER){permanentSplines.push({pts:catmullSample(tip.trail,3),dir:'out'});tip.active=false;if(rA()<0.45)spawnIn();}
  }
  for(let i=0;i<inwardTips.length;i++){
    if(!inwardTips[i].active)continue;
    for(let j=0;j<outwardTips.length;j++){
      if(!outwardTips[j].active)continue;
      if(vMag(vSub(inwardTips[i].p,outwardTips[j].p))<0.05){
        const mp=vLerp(inwardTips[i].p,outwardTips[j].p,0.5);
        contracts.push({p:mp,age:0});
        permanentSplines.push({pts:catmullSample(inwardTips[i].trail,3),dir:'in'});
        permanentSplines.push({pts:catmullSample(outwardTips[j].trail,3),dir:'out'});
        inwardTips[i].active=false;outwardTips[j].active=false;
        contractCount++;document.getElementById('xcon').textContent=contractCount;break;
      }
    }
  }
  for(const c of contracts)c.age++;
  inwardTips=inwardTips.filter(t=>t.active);outwardTips=outwardTips.filter(t=>t.active);
  if(permanentSplines.length>300)permanentSplines.splice(0,10);
}

// star field
const NS=2400;
const SDX=new Float32Array(NS),SDY=new Float32Array(NS),SDZ=new Float32Array(NS),SBR=new Float32Array(NS),SSZ=new Float32Array(NS);
const SCR=new Uint8Array(NS),SCG=new Uint8Array(NS),SCB=new Uint8Array(NS);
for(let i=0;i<NS;i++){const t=rA()*Math.PI*2,p=Math.acos(2*rA()-1);SDX[i]=Math.sin(p)*Math.cos(t);SDY[i]=Math.sin(p)*Math.sin(t);SDZ[i]=Math.cos(p);SBR[i]=Math.pow(rA(),1.9);SSZ[i]=0.4+rA()*1.6;const c=rA();if(c<0.07){SCR[i]=155;SCG[i]=175;SCB[i]=255;}else if(c<0.18){SCR[i]=255;SCG[i]=215;SCB[i]=165;}else if(c<0.26){SCR[i]=255;SCG[i]=145;SCB[i]=125;}else{SCR[i]=248;SCG[i]=248;SCB[i]=255;}}
const NMW=640;const MWDX=new Float32Array(NMW),MWDY=new Float32Array(NMW),MWDZ=new Float32Array(NMW),MWBR=new Float32Array(NMW),MWSZ=new Float32Array(NMW);
const mn=[0.5,0.7,0.5],mnl=Math.hypot(...mn);mn[0]/=mnl;mn[1]/=mnl;mn[2]/=mnl;const mu=[-mn[1],mn[0],0],mul2=Math.hypot(...mu);mu[0]/=mul2;mu[1]/=mul2;const mv=[mn[1]*mu[2]-mn[2]*mu[1],mn[2]*mu[0]-mn[0]*mu[2],mn[0]*mu[1]-mn[1]*mu[0]];
for(let i=0;i<NMW;i++){const a=rB()*Math.PI*2,sp=(rB()-0.5)*0.26;const ca=Math.cos(a),sa=Math.sin(a);let x=ca*mu[0]+sa*mv[0]+sp*mn[0],y=ca*mu[1]+sa*mv[1]+sp*mn[1],z=ca*mu[2]+sa*mv[2]+sp*mn[2];const l=Math.hypot(x,y,z);MWDX[i]=x/l;MWDY[i]=y/l;MWDZ[i]=z/l;MWBR[i]=0.06+rB()*0.22;MWSZ[i]=0.4+rB()*0.9;}
const NCOLS=[[80,120,255],[255,80,110],[100,220,178],[200,90,255],[255,150,60],[120,255,150],[55,178,255],[255,200,100],[180,80,255],[100,255,200],[255,110,80],[80,200,255],[200,255,120],[255,160,80]];
const NEBS=NCOLS.map(col=>{const t=rC()*Math.PI*2,p=Math.acos(2*rC()-1);return{dx:Math.sin(p)*Math.cos(t),dy:Math.sin(p)*Math.sin(t),dz:Math.cos(p),col,sz:22+rC()*80,al:0.025+rC()*0.065};});
const GALS=Array.from({length:9},()=>{const t=rD()*Math.PI*2,p=Math.acos(2*rD()-1);return{dx:Math.sin(p)*Math.cos(t),dy:Math.sin(p)*Math.sin(t),dz:Math.cos(p),sz:5+rD()*13,al:0.1+rD()*0.26};});
const PDR=(v=>{const l=Math.hypot(...v);return v.map(x=>x/l);})([0.55,-0.15,0.82]);

function drawSplineStructural(pts,dir){
  if(pts.length<2)return;
  G.lineCap='round';
  for(let i=1;i<pts.length;i++){
    const[r1x,r1y,r1z]=qRV(pts[i-1],Q),[r2x,r2y,r2z]=qRV(pts[i],Q);
    const[s1x,s1y]=prj(r1x,r1y,r1z,ZM),[s2x,s2y]=prj(r2x,r2y,r2z,ZM);
    if(!ic(s1x,s1y)&&!ic(s2x,s2y))continue;
    const prog=i/pts.length;
    // melanin: inward tips darken toward core (low prog = near origin for 'in')
    const melanin=dir==='in'?prog:(1-prog);
    const midx=(s1x+s2x)/2,midy=(s1y+s2y)/2;
    const alpha=0.12+prog*0.32;
    G.beginPath();G.moveTo(s1x,s1y);G.lineTo(s2x,s2y);
    G.strokeStyle=trailColor(midx,midy,melanin,alpha);
    G.lineWidth=(0.5+prog*0.45)*ZM;G.stroke();
    if(FR%6===0&&ic(midx,midy))stampDens(midx,midy,prog<0.5?'in':'out');
  }
}

function renderDensityStructural(){
  const cw=(R*2)/GDIM,ch=(R*2)/GDIM,ox=CX-R,oy=CY-R;
  for(let gy=0;gy<GDIM;gy++)for(let gx=0;gx<GDIM;gx++){
    const i=gy*GDIM+gx,dI=densIn[i],dO=densOut[i],d=Math.max(dI,dO);
    if(d<0.02)continue;
    const sx=ox+gx*cw+cw/2,sy=oy+gy*ch+ch/2;
    if(!ic(sx,sy))continue;
    const isX=dI>0.12&&dO>0.12;
    const phase=structuralPhase(sx,sy);
    const[r,g,b]=structuralRGB(phase);
    const brightness=isX?0.7:0.35; // intersections brighter
    G.fillStyle=`rgba(${Math.round(r*255*brightness)},${Math.round(g*255*brightness)},${Math.round(b*255*brightness)},${Math.min(0.3,d*0.35)})`;
    G.beginPath();G.arc(sx,sy,cw*0.7,0,Math.PI*2);G.fill();
  }
}

function drawIridescentShell(){
  // soap bubble glass — structural color rings at the rim
  for(let ring=0;ring<6;ring++){
    const rOff=ring/6;
    const shellR=R-ring*2.5;
    G.beginPath();G.arc(CX,CY,shellR,0,Math.PI*2);
    const phase=structuralPhase(CX+shellR*0.7,CY);
    const[r2,g2,b2]=structuralRGB((phase+rOff)%1);
    G.strokeStyle=`rgba(${Math.round(r2*255)},${Math.round(g2*255)},${Math.round(b2*255)},${0.04+rOff*0.02})`;
    G.lineWidth=2.5;G.stroke();
  }
}

function drawSeaLevel(){
  const SEA_R=Math.sqrt(Math.max(0,F_R_OUTER*F_R_OUTER-SEA_Y*SEA_Y))*0.98;
  G.beginPath();let first=true;
  for(let a=0;a<=Math.PI*2+0.01;a+=0.1){const[rx,ry,rz]=qRV([Math.cos(a)*SEA_R,SEA_Y,Math.sin(a)*SEA_R],Q);const[sx,sy]=prj(rx,ry,rz,ZM);if(first){G.moveTo(sx,sy);first=false;}else G.lineTo(sx,sy);}
  G.closePath();G.fillStyle='rgba(15,40,70,0.12)';G.fill();G.strokeStyle='rgba(40,100,180,0.18)';G.lineWidth=0.7;G.stroke();
}

function render(){
  const time=performance.now()/1000,bps=140/60,beatTime=time*bps;
  const transient=Math.exp(-(beatTime%1)*6),swell=Math.sin(((beatTime/4)%1)*Math.PI);
  G.fillStyle='#000308';G.beginPath();G.arc(CX,CY,R,0,Math.PI*2);G.fill();
  G.save();G.beginPath();G.arc(CX,CY,R,0,Math.PI*2);G.clip();
  for(const n of NEBS){const[rx,ry,rz]=qRV([n.dx,n.dy,n.dz],Q);const[sx,sy]=prj(rx,ry,rz,ZM);if(!ic(sx,sy))continue;const fd=Math.max(0,(rz+1)*0.5);const[nr,ng,nb]=n.col,sr=n.sz*(0.5+0.5*fd);const gg=G.createRadialGradient(sx,sy,0,sx,sy,sr);gg.addColorStop(0,`rgba(${nr},${ng},${nb},${n.al*fd*3})`);gg.addColorStop(0.55,`rgba(${nr},${ng},${nb},${n.al*fd})`);gg.addColorStop(1,'rgba(0,0,0,0)');G.fillStyle=gg;G.beginPath();G.arc(sx,sy,sr,0,Math.PI*2);G.fill();}
  for(const g of GALS){const[rx,ry,rz]=qRV([g.dx,g.dy,g.dz],Q);const[sx,sy]=prj(rx,ry,rz,ZM);if(!ic(sx,sy))continue;G.save();G.translate(sx,sy);G.scale(1,0.36);G.fillStyle=`rgba(220,215,240,${g.al})`;G.beginPath();G.arc(0,0,g.sz,0,Math.PI*2);G.fill();G.restore();}
  for(let i=0;i<NMW;i++){const[rx,ry,rz]=qRV([MWDX[i],MWDY[i],MWDZ[i]],Q);const[sx,sy]=prj(rx,ry,rz,ZM);if(!ic(sx,sy))continue;G.fillStyle=`rgba(215,205,188,${MWBR[i]*0.65})`;G.beginPath();G.arc(sx,sy,MWSZ[i],0,Math.PI*2);G.fill();}
  for(let i=0;i<NS;i++){const[rx,ry,rz]=qRV([SDX[i],SDY[i],SDZ[i]],Q);const[sx,sy]=prj(rx,ry,rz,ZM);if(!ic(sx,sy))continue;const dr=Math.hypot(sx-CX,sy-CY)/R;const ef=dr>0.78?Math.pow(Math.max(0,1-(dr-0.78)/0.22),1.4):1;G.fillStyle=`rgba(${SCR[i]},${SCG[i]},${SCB[i]},${SBR[i]*ef})`;G.beginPath();G.arc(sx,sy,SSZ[i],0,Math.PI*2);G.fill();}
  const[prx,pry,prz]=qRV(PDR,Q);const[ppx,ppy]=prj(prx,pry,prz,ZM);
  if(ic(ppx,ppy)){const pR=13;const pg=G.createRadialGradient(ppx,ppy,0,ppx,ppy,pR*3.2);pg.addColorStop(0,'rgba(80,160,220,0.2)');pg.addColorStop(1,'rgba(0,0,0,0)');G.fillStyle=pg;G.beginPath();G.arc(ppx,ppy,pR*3.2,0,Math.PI*2);G.fill();const pb=G.createRadialGradient(ppx-pR*0.35,ppy-pR*0.35,1,ppx,ppy,pR);pb.addColorStop(0,'#4d8a5d');pb.addColorStop(0.55,'#1a5590');pb.addColorStop(1,'#071525');G.fillStyle=pb;G.beginPath();G.arc(ppx,ppy,pR,0,Math.PI*2);G.fill();G.beginPath();G.arc(ppx,ppy,pR+2.5,0,Math.PI*2);G.strokeStyle='rgba(80,160,220,0.42)';G.lineWidth=2;G.stroke();}
  renderDensityStructural();
  drawSeaLevel();
  // permanent splines — structural color
  for(const s of permanentSplines)drawSplineStructural(s.pts,s.dir);
  // live tips
  for(const tip of inwardTips){
    if(tip.trail.length<3)continue;
    const spl=catmullSample(tip.trail.slice(-30),3);
    for(let i=1;i<spl.length;i++){
      const[r1x,r1y,r1z]=qRV(spl[i-1],Q),[r2x,r2y,r2z]=qRV(spl[i],Q);
      const[s1x,s1y]=prj(r1x,r1y,r1z,ZM),[s2x,s2y]=prj(r2x,r2y,r2z,ZM);
      if(!ic(s1x,s1y)&&!ic(s2x,s2y))continue;
      const prog=i/spl.length,melanin=prog;
      const midx=(s1x+s2x)/2,midy=(s1y+s2y)/2;
      G.beginPath();G.moveTo(s1x,s1y);G.lineTo(s2x,s2y);
      G.strokeStyle=trailColor(midx,midy,melanin,0.08+prog*0.5);
      G.lineWidth=1.1*ZM;G.stroke();
    }
    const[trx,try2,trz]=qRV(tip.p,Q);const[tsx,tsy]=prj(trx,try2,trz,ZM);
    if(ic(tsx,tsy)){const phase=structuralPhase(tsx,tsy);const[r,g,b]=structuralRGB(phase);G.beginPath();G.arc(tsx,tsy,2*ZM,0,Math.PI*2);G.fillStyle=`rgba(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)},0.9)`;G.fill();}
  }
  for(const tip of outwardTips){
    if(tip.trail.length<3)continue;
    const spl=catmullSample(tip.trail.slice(-30),3);
    for(let i=1;i<spl.length;i++){
      const[r1x,r1y,r1z]=qRV(spl[i-1],Q),[r2x,r2y,r2z]=qRV(spl[i],Q);
      const[s1x,s1y]=prj(r1x,r1y,r1z,ZM),[s2x,s2y]=prj(r2x,r2y,r2z,ZM);
      if(!ic(s1x,s1y)&&!ic(s2x,s2y))continue;
      const prog=i/spl.length,melanin=1-prog;
      const midx=(s1x+s2x)/2,midy=(s1y+s2y)/2;
      G.beginPath();G.moveTo(s1x,s1y);G.lineTo(s2x,s2y);
      G.strokeStyle=trailColor(midx,midy,melanin,0.08+prog*0.5);
      G.lineWidth=1.1*ZM;G.stroke();
    }
    const[trx,try3,trz]=qRV(tip.p,Q);const[tsx,tsy]=prj(trx,try3,trz,ZM);
    if(ic(tsx,tsy)){const phase=structuralPhase(tsx,tsy);const[r,g,b]=structuralRGB(phase);G.beginPath();G.arc(tsx,tsy,2*ZM,0,Math.PI*2);G.fillStyle=`rgba(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)},0.85)`;G.fill();}
  }
  // contracts — structural color pulse
  for(const c of contracts){
    const fade=Math.max(0.3,1-c.age/300);
    const[rx,ry,rz]=qRV(c.p,Q);const[sx,sy]=prj(rx,ry,rz,ZM);if(!ic(sx,sy))continue;
    const phase=structuralPhase(sx,sy);const[r,g,b]=structuralRGB(phase);
    const pulse=2.5+(transient*1.5);
    G.beginPath();G.arc(sx,sy,pulse*ZM,0,Math.PI*2);
    G.fillStyle=`rgba(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)},${0.9*fade})`;G.fill();
  }
  // dual-tone core — structural phase on outer ring
  const[cpx,cpy]=prj(0,0,0,ZM);
  const corePhase=structuralPhase(cpx,cpy);const[cr,cg2,cb]=structuralRGB(corePhase);
  const glow=15+(transient*7)+(swell*4);
  const cg1=G.createRadialGradient(cpx,cpy,1,cpx,cpy,glow);
  cg1.addColorStop(0,`rgba(${Math.round(cr*255)},${Math.round(cg2*255)},${Math.round(cb*255)},0.75)`);
  cg1.addColorStop(0.35,'rgba(200,80,10,0.35)');cg1.addColorStop(0.7,'rgba(120,30,5,0.07)');cg1.addColorStop(1,'rgba(0,0,0,0)');
  G.beginPath();G.arc(cpx,cpy,glow,0,Math.PI*2);G.fillStyle=cg1;G.fill();
  const cg3=G.createRadialGradient(cpx,cpy,0,cpx,cpy,glow*0.5);
  cg3.addColorStop(0,'rgba(0,240,175,0.55)');cg3.addColorStop(0.5,'rgba(0,155,120,0.16)');cg3.addColorStop(1,'rgba(0,0,0,0)');
  G.beginPath();G.arc(cpx,cpy,glow*0.5,0,Math.PI*2);G.fillStyle=cg3;G.fill();
  G.beginPath();G.arc(cpx,cpy,2.3,0,Math.PI*2);G.fillStyle='rgba(240,240,200,0.95)';G.fill();
  G.restore();
  // iridescent glass shell — structural color rings
  drawIridescentShell();
  const r1=G.createRadialGradient(CX,CY,R-14,CX,CY,R+2);r1.addColorStop(0,'rgba(0,0,0,0)');r1.addColorStop(0.65,'rgba(0,0,0,0.28)');r1.addColorStop(1,'rgba(0,0,0,0.93)');G.beginPath();G.arc(CX,CY,R+2,0,Math.PI*2);G.fillStyle=r1;G.fill();
  const r2=G.createRadialGradient(CX-88,CY-88,4,CX-52,CY-52,R*0.74);r2.addColorStop(0,'rgba(255,255,255,0.1)');r2.addColorStop(0.35,'rgba(255,255,255,0.02)');r2.addColorStop(1,'rgba(255,255,255,0)');G.beginPath();G.arc(CX,CY,R,0,Math.PI*2);G.fillStyle=r2;G.fill();
  const r3=G.createRadialGradient(CX,CY,R-1,CX,CY,R+16);r3.addColorStop(0,'rgba(68,110,200,0.07)');r3.addColorStop(0.5,'rgba(68,110,200,0.02)');r3.addColorStop(1,'rgba(0,0,0,0)');G.beginPath();G.arc(CX,CY,R+16,0,Math.PI*2);G.fillStyle=r3;G.fill();
  G.beginPath();G.arc(CX,CY,R,0,Math.PI*2);G.strokeStyle='rgba(100,145,225,0.15)';G.lineWidth=1.5;G.stroke();
}
document.getElementById('xbnd').addEventListener('input',e=>{bands=parseFloat(e.target.value);});
document.getElementById('xspd').addEventListener('input',e=>{flowSpeed=parseFloat(e.target.value);});
cv.addEventListener('click',()=>{bands=4+Math.random()*46;document.getElementById('xbnd').value=Math.round(bands);});
cv.addEventListener('mousedown',e=>{DRG=true;DB=e.button;LX=e.clientX;LY=e.clientY;AUTO=false;document.getElementById('xmode').textContent='○ exploring';e.preventDefault();});
window.addEventListener('mouseup',()=>{DRG=false;});
window.addEventListener('mousemove',e=>{if(!DRG)return;const dx=(e.clientX-LX)/R,dy=(e.clientY-LY)/R;LX=e.clientX;LY=e.clientY;if(DB===2)Q=qNrm(qMul(qAx(0,0,1,dx*2.2),Q));else Q=qNrm(qMul(qAx(0,1,0,-dx*2),qMul(qAx(1,0,0,dy*2),Q)));});
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{ZM=Math.max(0.35,Math.min(5,ZM*(e.deltaY>0?0.92:1.087)));document.getElementById('xzm').textContent=ZM.toFixed(2);e.preventDefault();},{passive:false});
window.addEventListener('keydown',e=>{const sp=0.045;if(e.key==='ArrowLeft')Q=qNrm(qMul(qAx(0,1,0,sp),Q));if(e.key==='ArrowRight')Q=qNrm(qMul(qAx(0,1,0,-sp),Q));if(e.key==='ArrowUp')Q=qNrm(qMul(qAx(1,0,0,-sp),Q));if(e.key==='ArrowDown')Q=qNrm(qMul(qAx(1,0,0,sp),Q));if(e.key==='q'||e.key==='Q')Q=qNrm(qMul(qAx(0,0,1,-sp),Q));if(e.key==='e'||e.key==='E')Q=qNrm(qMul(qAx(0,0,1,sp),Q));if(e.key==='+'||e.key==='=')ZM=Math.min(5,ZM*1.1);if(e.key==='-')ZM=Math.max(0.35,ZM/1.1);AUTO=false;document.getElementById('xmode').textContent='○ exploring';document.getElementById('xzm').textContent=ZM.toFixed(2);});
let TP={};
cv.addEventListener('touchstart',e=>{e.preventDefault();AUTO=false;document.getElementById('xmode').textContent='○ exploring';for(let t of e.changedTouches)TP[t.identifier]={x:t.clientX,y:t.clientY};},{passive:false});
cv.addEventListener('touchend',e=>{for(let t of e.changedTouches)delete TP[t.identifier];},{passive:false});
cv.addEventListener('touchmove',e=>{e.preventDefault();const tl=[...e.changedTouches];if(Object.keys(TP).length<=1&&tl.length>=1){const t=tl[0];const pv=TP[t.identifier];if(pv){const dx=(t.clientX-pv.x)/R,dy=(t.clientY-pv.y)/R;Q=qNrm(qMul(qAx(0,1,0,-dx*2),qMul(qAx(1,0,0,dy*2),Q)));}TP[t.identifier]={x:t.clientX,y:t.clientY};}else if(tl.length>=2){const t1=tl[0],t2=tl[1],p1=TP[t1.identifier],p2=TP[t2.identifier];if(p1&&p2){const pa=Math.atan2(p1.y-p2.y,p1.x-p2.x),na=Math.atan2(t1.clientY-t2.clientY,t1.clientX-t2.clientX);Q=qNrm(qMul(qAx(0,0,1,na-pa),Q));const pd=Math.hypot(p1.x-p2.x,p1.y-p2.y),nd=Math.hypot(t1.clientX-t2.clientX,t1.clientY-t2.clientY);if(pd>5)ZM=Math.max(0.35,Math.min(5,ZM*nd/pd));}TP[t1.identifier]={x:t1.clientX,y:t1.clientY};TP[t2.identifier]={x:t2.clientX,y:t2.clientY};}},{passive:false});
function loop(){FR++;flowTime+=flowSpeed;updateFungi();if(AUTO)Q=qNrm(qMul(qAx(0,1,0,0.0022),qMul(qAx(0,0,1,0.00045),Q)));render();requestAnimationFrame(loop);}
loop();