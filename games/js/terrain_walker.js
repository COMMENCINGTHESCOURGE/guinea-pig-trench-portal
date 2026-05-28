function rgba(r,g,b,a){return((a||255)<<24)|(b<<16)|(g<<8)|r}
var W=320,H=200,M=1024,MK=M-1,scr=document.getElementById("screen"),sx=scr.getContext("2d",{alpha:false});scr.width=W;scr.height=H;
var oc=document.getElementById("oc"),ox=oc.getContext("2d");function roc(){oc.width=innerWidth;oc.height=innerHeight}roc();addEventListener("resize",roc);
var id=sx.createImageData(W,H),b32=new Uint32Array(id.data.buffer);
var hM=new Uint8Array(M*M),cM=new Uint32Array(M*M),shM=new Uint8Array(M*M),scM=new Uint32Array(M*M),ahM=new Uint8Array(M*M),acM=new Uint32Array(M*M);
var nX=new Int8Array(M*M),nY=new Int8Array(M*M),hY=new Int32Array(W);
var aH=hM,aC=cM,ks={},lk=false;
addEventListener("keydown",function(e){ks[e.code]=true;if(e.code==="Tab"){e.preventDefault();twMode=twMode==="SURVIVAL"?"CREATIVE":"SURVIVAL";var d=document.getElementById("twModeDisplay");if(d){d.textContent="MODE: "+twMode;d.style.color=twMode==="CREATIVE"?"#00ffd2":"#ff6b4a"}}e.preventDefault()});addEventListener("keyup",function(e){ks[e.code]=false});
var lp=document.getElementById("lp");document.addEventListener("pointerlockchange",function(){lk=document.pointerLockElement===document.body;lp.classList.toggle("hidden",lk)});
document.addEventListener("click",function(){if(!lk)document.body.requestPointerLock();else if(st.gs==="P")fire()});
document.addEventListener("mousemove",function(e){if(!lk||st.gs!=="P")return;st.a+=e.movementX*.0022;st.pi=Math.max(-60,Math.min(60,st.pi+e.movementY*.35))});
// Sprite loading
var geodeImg=new Image();geodeImg.src='../assets/sprites/geometric_core_geode_flux.png';var geodeLoaded=false;
geodeImg.onload=function(){geodeLoaded=true};geodeImg.onerror=function(){geodeLoaded=false};
var mechaImg=new Image();mechaImg.src='../assets/sprites/mecha_entity_alpha_v2_pixel.png';var mechaLoaded=false;
mechaImg.onload=function(){mechaLoaded=true};mechaImg.onerror=function(){mechaLoaded=false};

// Generate floating core positions
var floatingCores=[];
for(var ci=0;ci<5;ci++){
  floatingCores.push({
    x:300+Math.random()*424,
    y:300+Math.random()*424,
    z:0,
    bobOffset:Math.random()*Math.PI*2,
    collected:false
  });
}

// ── THE FIVE WORLDS — terrain zones (SMOOTH BLEND) ──
var TWORLDS=[
  {name:"PINK HOUR",fog:[30,10,25],water:[80,20,60],sky:[30,10,25],accent:"#ff66aa"},
  {name:"THE BLOCK",fog:[5,15,10],water:[10,60,40],sky:[5,15,10],accent:"#00ff9d"},
  {name:"THE THRESHOLD",fog:[8,22,50],water:[4,55,110],sky:[8,22,50],accent:"#00b8c8"},
  {name:"VAULT COMPOUND 7",fog:[20,12,5],water:[40,25,10],sky:[20,12,5],accent:"#ff8833"},
  {name:"THE BETWEEN",fog:[2,4,14],water:[5,10,30],sky:[2,4,14],accent:"#6688ff"},
];
function getTerrainWorld(x,y){
  // Smooth distance-weighted blend of ALL worlds
  // Each world has a center point. Fog = weighted average by inverse distance.
  // No hard boundaries. The transition IS the terrain.
  var centers=[
    {wx:300,wy:300,w:TWORLDS[0]},   // Pink Hour NW
    {wx:724,wy:300,w:TWORLDS[1]},   // Block NE
    {wx:512,wy:512,w:TWORLDS[2]},   // Threshold center
    {wx:300,wy:724,w:TWORLDS[3]},   // Vault SW
    {wx:724,wy:724,w:TWORLDS[4]},   // Between SE
  ];
  var totalWeight=0;
  var blendFog=[0,0,0];
  var bestDist=1e9,bestWorld=TWORLDS[2];
  for(var i=0;i<centers.length;i++){
    var dx=x-centers[i].wx,dy=y-centers[i].wy;
    var dist=Math.sqrt(dx*dx+dy*dy)+1;
    // Inverse square distance weighting — closer = stronger
    var weight=1/(dist*dist);
    totalWeight+=weight;
    blendFog[0]+=centers[i].w.fog[0]*weight;
    blendFog[1]+=centers[i].w.fog[1]*weight;
    blendFog[2]+=centers[i].w.fog[2]*weight;
    if(dist<bestDist){bestDist=dist;bestWorld=centers[i].w}
  }
  // Normalize
  blendFog[0]/=totalWeight;
  blendFog[1]/=totalWeight;
  blendFog[2]/=totalWeight;
  // Return the nearest world for the name, but with blended fog
  return {name:bestWorld.name,fog:blendFog,accent:bestWorld.accent};
}
var curTerrainWorld=TWORLDS[2];
// MODE 1: CREATIVE — no instability, no timer, no death, just explore
// MODE 2: SURVIVAL — instability rises underground, collect before signal lost
var twMode="SURVIVAL"; // toggle in pause menu
var AM=6,AR=3500,st={x:512,y:512,h:160,a:-Math.PI/2,pi:0,g:0,ins:0,gs:"P",ly:"S",sw:0,t:0,st:0,ng:false,fog:[8,22,50],am:AM,lar:0,mf:0};
var pjs=[],PS=14,PL=1.8;
function fire(){if(st.am<=0)return;st.am--;st.mf=.18;pl("sm");pjs.push({x:st.x+Math.cos(st.a)*5,y:st.y+Math.sin(st.a)*5,vx:Math.cos(st.a)*PS,vy:Math.sin(st.a)*PS,age:0,tr:[]});uap()}
function uap(){var c=document.getElementById("ap");c.innerHTML="";for(var i=0;i<AM;i++){var d=document.createElement("span");d.className="pip"+(i>=st.am?" e":"");c.appendChild(d)}}uap();
function pl(i){var s=document.getElementById(i);if(s){s.currentTime=0;s.play().catch(function(){})}}
function gen(){for(var i=0;i<M*M;i++){var x=i&MK,y=i>>10,dx=x-512,dy=y-512,ds=dx*dx+dy*dy;var h=Math.sin(x*.015)*Math.cos(y*.015)*40+Math.sin(x*.005)*30+60+Math.sin(x*.031+y*.017)*8+Math.cos(x*.009-y*.013)*5;if(ds>1600)h+=(ds-1600)*.000006*120;h=Math.max(0,Math.min(255,h));hM[i]=h;if(h<60)cM[i]=rgba(188,152,90);else if(h<70)cM[i]=rgba(172,135,68);else if(h<78)cM[i]=rgba(128,110,58);else if(h<110)cM[i]=rgba(28,75,20+(h-78>>1));else if(h<158)cM[i]=rgba(55+(h>>3),66+(h>>4),50);else cM[i]=rgba(192,206,222);if(h>84&&Math.random()<.0018)cM[i]=rgba(255,0,180);var sh=Math.abs(Math.sin(x*.08)*Math.cos(y*.08)*40)+148;shM[i]=sh;var sv=(8+sh/6)|0;scM[i]=rgba(2,sv,16);if(Math.random()<.003)scM[i]=rgba(0,200,255);if(Math.random()<.001)scM[i]=rgba(160,0,255);var ah=(Math.sin(x*.05)*Math.cos(y*.05)>.8)?80:0;ahM[i]=ah;acM[i]=rgba(185,218,255)}for(var y=490;y<534;y++)for(var x=490;x<534;x++){hM[(y<<10)|x]=0;cM[(y<<10)|x]=rgba(0,0,0)}}
function rn(){for(var i=1025;i<M*M-1025;i++){nX[i]=aH[i-1]-aH[i+1];nY[i]=aH[i-1024]-aH[i+1024]}}gen();rn();
function dsk(){var f=st.fog;for(var y=0;y<H;y++){var t=y/H,r=(f[0]*(.3+t*.7))|0,g=(f[1]*(.28+t*.72))|0,b=(f[2]*(.38+t*.8))|0,c=rgba(r,g,b);for(var x=0;x<W;x++)b32[y*W+x]=c}}
function ren(){dsk();hY.fill(H);var ca=Math.cos(st.a),sa=Math.sin(st.a),iS=st.ly==="U",ds=Math.min(1,st.ins/500),wt=st.t*15,po=st.pi|0;st.sw+=iS?.04+st.ins/2000:.04;var so=Math.sin(st.sw)*(1+st.ins/50)+po;var zM=160,zS=iS?1.4:2,zF=iS?.009:.007;for(var z=1;z<zM;z+=zS){var iv=1/z,sc=iv*120,fg=Math.min(1,z*zF);var px=-ca*z*1.05-sa*z+st.x,py=sa*z-ca*z+st.y,dx=(ca*z*2)/W,dy=(-sa*z*2)/W;for(var i=0;i<W;i++){var mx=(px|0)&MK,my=(py|0)&MK,of=(my<<10)|mx,th=aH[of],ho=((st.h-th)*sc+105+so)|0;if(st.ly==="S"&&th<76){var wH=73+Math.sin(px*.04+wt)*3.5+Math.cos(py*.05+wt)*2.5+Math.sin((px-py)*.08-wt)*1.2;var wO=((st.h-wH)*sc+105+so)|0;if(wO<hY[i]){var yT=Math.max(0,wO),yB=Math.min(hY[i],ho);if(yT<yB){var dp=wH-th;var wr=4,wg=55,wb=110;if(dp<10){wr=18;wg=135;wb=210}else if(dp>28){wr=1;wg=10;wb=24}var cc=Math.sin(px*.2+wt)+Math.cos(py*.2+wt*1.2);if(wH>79.5+Math.random()*1.5){wr=232;wg=248;wb=255}else if(cc>1.1&&dp<20){wr+=40;wg+=54;wb+=65}wr=(wr+(st.fog[0]-wr)*fg)|0;wg=(wg+(st.fog[1]-wg)*fg)|0;wb=(wb+(st.fog[2]-wb)*fg)|0;var wc=rgba(wr,wg,wb);for(var y=yT;y<yB;y++)b32[y*W+i]=wc}hY[i]=Math.min(hY[i],wO)}}if(ho<hY[i]){var sh=Math.max(.15,Math.min(1.5,.6+((nX[of]+nY[of]+256)>>7)*.11));var c=aC[of];var r=(c&255)*sh,g=((c>>8)&255)*sh,b=((c>>16)&255)*sh;if(ds>.1){var av=(r+g+b)/3;r+=(av-r)*ds;g+=(av-g)*ds;b+=(av-b)*ds}r=(r+(st.fog[0]-r)*fg)|0;g=(g+(st.fog[1]-g)*fg)|0;b=(b+(st.fog[2]-b)*fg)|0;var cl=rgba(r,g,b);for(var y=Math.max(0,ho);y<hY[i];y++)b32[y*W+i]=cl;hY[i]=ho}px+=dx;py+=dy}}sx.putImageData(id,0,0)}
function w2s(wx,wy,wz){var dx=wx-st.x,dy=wy-st.y,fw=dx*Math.cos(st.a)+dy*Math.sin(st.a);if(fw<.5)return null;var sr=(-dx*Math.sin(st.a)+dy*Math.cos(st.a));return{sx:(W/2+(sr/fw)*W*.5)*oc.width/W,sy:(H/2+((st.h-(wz||0))/fw)*60+st.pi)*oc.height/H,d:fw}}
function dov(){ox.clearRect(0,0,oc.width,oc.height);var cx=oc.width/2,cy=oc.height/2;var cc=st.ng?"#ff00cc":"#00ff9d";ox.save();ox.strokeStyle=cc;ox.lineWidth=1.5;ox.globalAlpha=.7;ox.beginPath();ox.moveTo(cx-13,cy);ox.lineTo(cx-5,cy);ox.moveTo(cx+5,cy);ox.lineTo(cx+13,cy);ox.moveTo(cx,cy-13);ox.lineTo(cx,cy-5);ox.moveTo(cx,cy+5);ox.lineTo(cx,cy+13);ox.stroke();ox.globalAlpha=.28;ox.beginPath();ox.arc(cx,cy,9,0,Math.PI*2);ox.stroke();ox.globalAlpha=1;ox.fillStyle=cc;ox.beginPath();ox.arc(cx,cy,1.5,0,Math.PI*2);ox.fill();if(st.am<AM){ox.globalAlpha=.45;ox.strokeStyle="rgba(255,170,34,.5)";ox.lineWidth=1;ox.beginPath();ox.arc(cx,cy,20,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-st.am/AM));ox.stroke()}ox.restore();

// Draw floating geode cores
if(geodeLoaded){for(var fc=0;fc<floatingCores.length;fc++){var core=floatingCores[fc];if(core.collected)continue;var coreZ=aH[((core.y|0)&MK)<<10|((core.x|0)&MK)]+12+Math.sin(st.t*3+core.bobOffset)*4;var cs=w2s(core.x,core.y,coreZ);if(!cs||cs.d>120)continue;var csz=Math.max(12,48/cs.d)*2;ox.save();var cgr=ox.createRadialGradient(cs.sx,cs.sy,0,cs.sx,cs.sy,csz*1.2);cgr.addColorStop(0,'rgba(0,255,200,0.35)');cgr.addColorStop(0.5,'rgba(0,200,255,0.12)');cgr.addColorStop(1,'rgba(0,255,200,0)');ox.fillStyle=cgr;ox.beginPath();ox.arc(cs.sx,cs.sy,csz*1.2,0,Math.PI*2);ox.fill();ox.drawImage(geodeImg,cs.sx-csz/2,cs.sy-csz/2,csz,csz);ox.restore()}}

// Draw mecha portrait in bottom-right HUD
if(mechaLoaded){ox.save();ox.drawImage(mechaImg,oc.width-46,oc.height-46,24,24);ox.restore()}for(var p of pjs){var s=w2s(p.x,p.y,aH[((p.y|0)&MK)<<10|((p.x|0)&MK)]+8);if(!s)continue;var sz=Math.max(2,18/s.d);var gr=ox.createRadialGradient(s.sx,s.sy,0,s.sx,s.sy,sz*3.5);gr.addColorStop(0,"rgba(0,255,157,.85)");gr.addColorStop(.4,"rgba(0,255,157,.3)");gr.addColorStop(1,"rgba(0,255,157,0)");ox.fillStyle=gr;ox.beginPath();ox.arc(s.sx,s.sy,sz*3.5,0,Math.PI*2);ox.fill();ox.fillStyle="#fff";ox.beginPath();ox.arc(s.sx,s.sy,sz*.6,0,Math.PI*2);ox.fill()}if(st.mf>0){var r=Math.round(st.mf*180);var g2=ox.createRadialGradient(cx,cy,0,cx,cy,r);g2.addColorStop(0,"rgba(0,255,157,"+st.mf*.6+")");g2.addColorStop(1,"rgba(0,255,157,0)");ox.fillStyle=g2;ox.beginPath();ox.arc(cx,cy,r,0,Math.PI*2);ox.fill()}}
var mc=document.getElementById("minimap"),mx=mc.getContext("2d");function dmm(){var S=100,d=mx.createImageData(S,S),m=new Uint32Array(d.data.buffer);for(var y=0;y<S;y++)for(var x=0;x<S;x++){var wx=(x/S*1024)|0,wy=(y/S*1024)|0,h=aH[(wy<<10)+wx];var r,g,b;if(h===0){r=0;g=8;b=16}else if(h<76&&st.ly==="S"){r=4;g=32;b=72}else if(h<70){var t=(h-40)/30;r=(18+t*60)|0;g=(90+t*30)|0;b=(14+t*10)|0}else if(h<110){var t=(h-70)/40;r=(78-t*50)|0;g=(120-t*40)|0;b=(24+t*14)|0}else if(h<158){var t=(h-110)/48;r=(28+t*100)|0;g=(80+t*50)|0;b=(38+t*20)|0}else{var t=Math.min(1,(h-158)/40);r=(180+t*60)|0;g=(195+t*50)|0;b=(210+t*40)|0}m[y*S+x]=rgba(r,g,b)}mx.putImageData(d,0,0);mx.globalAlpha=.12;mx.strokeStyle="#00ff9d";mx.lineWidth=.5;mx.strokeRect(0,0,S,S);mx.globalAlpha=1;var px=(st.x/1024*S)|0,py=(st.y/1024*S)|0;
// Pulsing outer ring — always visible
var pulse=.5+Math.sin(performance.now()*.004)*.5;
mx.save();mx.shadowColor="#00ff9d";mx.shadowBlur=10;
mx.strokeStyle="rgba(0,255,157,"+(0.4+pulse*0.5)+")";mx.lineWidth=1.5;mx.beginPath();mx.arc(px,py,5+pulse*2,0,Math.PI*2);mx.stroke();
// Solid white center dot
mx.fillStyle="#ffffff";mx.shadowColor="#ffffff";mx.shadowBlur=8;mx.beginPath();mx.arc(px,py,2.5,0,Math.PI*2);mx.fill();
// Bright cyan inner ring
mx.shadowBlur=4;mx.shadowColor="#00ccff";mx.strokeStyle="#00ccff";mx.lineWidth=1.5;mx.beginPath();mx.arc(px,py,4,0,Math.PI*2);mx.stroke();
mx.shadowBlur=0;mx.restore();
// Direction arrow — thicker, brighter
mx.strokeStyle="#00ff9d";mx.lineWidth=2;mx.globalAlpha=.95;mx.beginPath();mx.moveTo(px,py);var ax=px+Math.cos(st.a)*11,ay=py+Math.sin(st.a)*11;mx.lineTo(ax,ay);mx.stroke();
// Arrowhead
mx.fillStyle="#00ff9d";mx.beginPath();mx.moveTo(ax+Math.cos(st.a)*3,ay+Math.sin(st.a)*3);mx.lineTo(ax+Math.cos(st.a+2.4)*4,ay+Math.sin(st.a+2.4)*4);mx.lineTo(ax+Math.cos(st.a-2.4)*4,ay+Math.sin(st.a-2.4)*4);mx.closePath();mx.fill();
// Draw floating cores on minimap
for(var fc=0;fc<floatingCores.length;fc++){var core=floatingCores[fc];if(core.collected)continue;var cpx=(core.x/1024*S)|0,cpy=(core.y/1024*S)|0;var cp=.5+Math.sin(performance.now()*.006+fc)*.5;mx.fillStyle="rgba(0,255,200,"+(0.5+cp*0.5)+")";mx.shadowColor="#00ffc8";mx.shadowBlur=5;mx.beginPath();mx.arc(cpx,cpy,2,0,Math.PI*2);mx.fill();mx.shadowBlur=0}
mx.globalAlpha=1}
function upj(dt){var nw=performance.now();if(st.am<AM&&nw-st.lar>AR){st.am=Math.min(AM,st.am+1);st.lar=nw;uap()}for(var i=pjs.length-1;i>=0;i--){var p=pjs[i];p.age+=dt;if(p.age>PL){pjs.splice(i,1);continue}p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;p.x=(p.x+M)&MK;p.y=(p.y+M)&MK;var px=(p.x|0)&MK,py=(p.y|0)&MK,ix=(py<<10)|px,c=aC[ix];if(c===rgba(255,0,180)||c===rgba(0,200,255)){st.g+=10;pl("sm");aC[ix]=rgba(38,38,38);aH[ix]=Math.max(0,aH[ix]-5);rn();pjs.splice(i,1);continue}if(aH[ix]>80){pjs.splice(i,1)}
// Check projectile vs floating cores
for(var fc=0;fc<floatingCores.length;fc++){var core=floatingCores[fc];if(core.collected)continue;var cdx=p.x-core.x,cdy=p.y-core.y;if(cdx*cdx+cdy*cdy<400){core.collected=true;st.g+=15;pl("sm");pjs.splice(i,1);break}}
}st.mf=Math.max(0,st.mf-dt*4)}
function uhud(){document.getElementById("ln").innerText=curTerrainWorld.name;document.getElementById("sv").innerText=String(st.g).padStart(3,"0");var pc=Math.min(100,(st.g/300)*100);document.getElementById("pf").style.width=pc+"%";document.getElementById("pp").innerText=Math.round(pc)+"%";document.getElementById("pv").innerText=Math.round(st.x)+", "+Math.round(st.y);document.getElementById("dv").innerText=Math.max(0,(200-st.h)).toFixed(1)+"m";document.getElementById("if").style.width=Math.min(100,(st.ins/600)*100)+"%";document.getElementById("iv").innerText=Math.round(st.ins)+" / 600";var sv=document.getElementById("stv");if(st.ins>400){sv.innerText="CRITICAL";sv.style.color="var(--danger)"}else if(st.ins>200){sv.innerText="UNSTABLE";sv.style.color="var(--amber)"}else{sv.innerText="NOMINAL";sv.style.color="var(--phosphor)"}var ca=Math.cos(st.a),sa=Math.sin(st.a),hx=(st.x+ca*40)&MK,hy=(st.y+sa*40)&MK;st.ng=aC[(hy<<10)+hx]===rgba(255,0,180)||aC[(hy<<10)+hx]===rgba(0,200,255)}
function tasc(){st.gs="W";st.ly="A";aH=ahM;aC=acM;st.h=200;st.fog=[175,212,255];rn();document.getElementById("lb").innerText="ASCENDED";var ov=document.getElementById("ov");ov.classList.add("show","won");document.getElementById("ot").innerText="ASCENSION";document.getElementById("os").innerText="HARVESTED — "+st.g+" UNITS"}
function tend(){st.gs="L";var ov=document.getElementById("ov");ov.classList.add("show","lost");document.getElementById("ot").innerText="SIGNAL LOST";document.getElementById("os").innerText="HARVESTED — "+st.g+" / 300 UNITS"}
function clt(gd){if(st.ly==="S"&&gd===0&&st.h<15){st.ly="U";aH=shM;aC=scM;st.h=220;st.fog=[0,5,2];rn();document.getElementById("ln").innerText="SUB_CORE";document.getElementById("lb").innerText="SUBTERRANEAN"}}
function upd(dt){if(st.gs!=="P")return;var sp=ks.ShiftLeft?5:2.5,ca=Math.cos(st.a),sa=Math.sin(st.a);if(ks.KeyW){st.x+=ca*sp;st.y+=sa*sp}if(ks.KeyS){st.x-=ca*sp;st.y-=sa*sp}if(ks.KeyA){st.x+=sa*sp;st.y-=ca*sp}if(ks.KeyD){st.x-=sa*sp;st.y+=ca*sp}if(!lk&&ks.KeyQ)st.a-=.05;if(!lk&&ks.KeyE)st.a+=.05;st.t+=.01;upj(dt);var gx=(st.x|0)&MK,gy=(st.y|0)&MK,gd=aH[(gy<<10)|gx],th=(st.ly==="S"&&gd<76)?95:gd+20;st.h=Math.max(th,st.h-1.2);if(st.ly==="U"){if(twMode==="SURVIVAL"){st.ins+=.12;if(st.ins>=600)tend()}}else{st.ins=Math.max(0,st.ins-1)}if(st.ly==="S"&&st.g>=300){var mv=ks.KeyW||ks.KeyS||ks.KeyA||ks.KeyD;if(!mv&&Math.abs(st.x-512)<50&&Math.abs(st.y-512)<50){if(++st.st>150)tasc()}else{st.st=0}}clt(gd);uhud();dmm()}
var lt=0;function loop(t){var dt=Math.min((t-lt)/1000,.05);lt=t;
// Update world zone based on player position
curTerrainWorld=getTerrainWorld(st.x,st.y);
// Very slow fog blend — like weather changing, not a switch
// 0.008 per frame = takes ~125 frames (~2 seconds) to fully transition
var tf=curTerrainWorld.fog;
st.fog[0]+=(tf[0]-st.fog[0])*.008;
st.fog[1]+=(tf[1]-st.fog[1])*.008;
st.fog[2]+=(tf[2]-st.fog[2])*.008;
upd(dt);ren();dov();
// ── POST-PROCESSING (The Threshold standard) ──
// Vignette on the overlay canvas
ox.save();
var vg=ox.createRadialGradient(oc.width/2,oc.height/2,oc.height*.2,oc.width/2,oc.height/2,oc.height*.65);
vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(0,0,0,0.35)");
ox.fillStyle=vg;ox.fillRect(0,0,oc.width,oc.height);
// World name indicator
ox.fillStyle=curTerrainWorld.accent;ox.globalAlpha=.45;
ox.font="bold 11px 'Courier New'";ox.textAlign="center";
ox.fillText(curTerrainWorld.name,oc.width/2,22);
ox.globalAlpha=1;ox.textAlign="left";
// Heartbeat pulse at high instability (0.7s from Vault lore)
if(st.ins>300){
  var hbPulse=Math.pow(Math.max(0,Math.sin(st.t/0.7*Math.PI*2)),4)*Math.min(1,(st.ins-300)/300)*0.25;
  if(hbPulse>0.01){ox.fillStyle="rgba(255,34,68,"+hbPulse+")";ox.fillRect(0,0,oc.width,oc.height)}
}
ox.restore();
requestAnimationFrame(loop)}requestAnimationFrame(loop);

// -- THE THRESHOLD CROSS-POLLINATION (pass 1) --
(function() {
  // Vignette
  var vig = document.createElement('div');
  vig.id = 'threshold-vignette';
  document.body.appendChild(vig);

  // World name
  var wn = document.createElement('div');
  wn.id = 'threshold-world-name';
  wn.textContent = 'THE BLOCK';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.7095888428361128;
  setInterval(function() {
    hb.style.opacity = '0.06';
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.014011312959854506;mix-blend-mode:overlay';
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