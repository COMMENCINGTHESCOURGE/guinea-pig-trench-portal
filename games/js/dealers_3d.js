// ═══════════════════════════════════════════════════
// LAYER 1: WebGL Raymarched Backgrounds
// ═══════════════════════════════════════════════════
const bgCanvas = document.getElementById('bg');
const gl = bgCanvas.getContext('webgl2', {antialias:false, alpha:true, powerPreference:'high-performance'});

let BW, BH;
function resizeBg(){BW=bgCanvas.width=window.innerWidth;BH=bgCanvas.height=window.innerHeight}
resizeBg();

// Each location has its own SDF scene
const BG_VS = `#version 300 es
in vec2 a;out vec2 uv;
void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

const BG_FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime, uWarp, uHigh, uDistort;
uniform int uScene; // 0-5 = locations
uniform vec3 uAccent;
in vec2 uv;
out vec4 O;

const int STEPS=48;
const float FAR=12.0, EPS=0.003;

// ── SDF Primitives ──
float sdSphere(vec3 p,float r){return length(p)-r;}
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sdTorus(vec3 p,vec2 t){vec2 q=vec2(length(p.xz)-t.x,p.y);return length(q)-t.y;}
float sdCylinder(vec3 p,float h,float r){vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r,h);return min(max(d.x,d.y),0.)+length(max(d,0.));}

// ── Mandelbulb fragment (for warp/substance effects) ──
float mandelbulb(vec3 p, float power){
  vec3 z=p;float dr=1.,r=0.;
  for(int i=0;i<6;i++){
    r=length(z);if(r>2.)break;
    float th=acos(clamp(z.y/r,-1.,1.)),ph=atan(z.x,z.z);
    dr=pow(r,power-1.)*power*dr+1.;
    float zr=pow(r,power);th*=power;ph*=power;
    z=zr*vec3(sin(th)*sin(ph),cos(th),sin(th)*cos(ph))+p;
  }
  return .5*log(max(r,1e-6))*r/dr;
}

// ── Location SDFs ──
float sceneTrenchHub(vec3 p){
  // Floating platforms in void
  float ground=p.y+1.5;
  float pillars=sdBox(p-vec3(sin(uTime*.3)*2.,0.,cos(uTime*.2)*3.),vec3(.3,2.,.3));
  float orb=sdSphere(p-vec3(0.,sin(uTime*.5)*.5+1.,0.),.4);
  return min(ground,min(pillars,orb));
}

float sceneKrakenDepths(vec3 p){
  // Underwater: bubbles, kelp, undulating floor
  float floor=p.y+1.5+sin(p.x*.5+uTime)*0.3+cos(p.z*.4+uTime*.7)*.2;
  float bubble=sdSphere(p-vec3(sin(uTime+p.z)*.8,mod(uTime*.5+p.x,4.)-2.,cos(uTime*.7+p.x)*1.2),.08);
  float kelp=sdCylinder(p-vec3(sin(p.z*2.+uTime*.3)*.3,-0.5,2.),.8+sin(uTime+p.y)*.2,.06);
  return min(floor,min(bubble,kelp));
}

float sceneDimMakDistrict(vec3 p){
  // Neon city blocks
  vec3 q=p;q.xz=mod(q.xz+2.,4.)-2.;
  float buildings=sdBox(q-vec3(0.,-0.5,0.),vec3(.6,1.+sin(p.x*3.+p.z*2.)*.5,.6));
  float street=p.y+1.5;
  float neon=sdTorus(p-vec3(0.,2.,0.),vec2(1.5+sin(uTime)*.2,.03));
  return min(street,min(buildings,neon));
}

float sceneMechaStation(vec3 p){
  // Industrial: gears, pipes, sparks
  float floor=p.y+1.5;
  vec3 rp=p;
  float a2=atan(rp.x,rp.z)+uTime*.2;
  float gear=sdTorus(vec3(cos(a2)*length(rp.xz),rp.y-1.,sin(a2)*length(rp.xz)),vec2(1.8,.08));
  float pipe=sdCylinder(p-vec3(2.,0.,0.),3.,.1);
  return min(floor,min(gear,pipe));
}

float sceneGriefWastes(vec3 p){
  // Desolate: cracked ground, floating debris
  float ground=p.y+1.5+sin(p.x*2.)*.1*cos(p.z*2.);
  float debris=sdBox(p-vec3(sin(uTime*.4)*2.,sin(uTime*.6)*.5+.5,cos(uTime*.3)*1.5),
                     vec3(.15,.15,.15));
  float skull=sdSphere(p-vec3(-1.,.5+sin(uTime*.2)*.3,2.),.25);
  return min(ground,min(debris,skull));
}

float sceneAkuSanctum(vec3 p){
  // Mystical: floating crystals, energy rings
  float ground=p.y+1.5;
  float crystal=sdBox(p-vec3(0.,1.+sin(uTime*.4)*.3,0.),vec3(.15,1.,.15));
  // Rotate crystal
  float a3=uTime*.3;
  vec3 cp=p-vec3(0.,1.,0.);
  cp.xz=mat2(cos(a3),-sin(a3),sin(a3),cos(a3))*cp.xz;
  float crystal2=sdBox(cp,vec3(.1,.8,.1));
  float ring=sdTorus(p-vec3(0.,1.5,0.),vec2(1.2+sin(uTime)*.1,.02));
  return min(ground,min(min(crystal,crystal2),ring));
}

// ── Combined scene selector ──
float scene(vec3 p){
  // Apply substance distortion (user mode high)
  if(uDistort>0.01){
    p+=sin(p*3.+uTime*2.)*uDistort*.15;
  }
  // Apply mandelbulb warp during travel
  if(uWarp>0.01){
    float mb=mandelbulb(p*.5,6.+uWarp*4.);
    return mb*.5+.01;
  }

  if(uScene==0) return sceneTrenchHub(p);
  if(uScene==1) return sceneKrakenDepths(p);
  if(uScene==2) return sceneDimMakDistrict(p);
  if(uScene==3) return sceneMechaStation(p);
  if(uScene==4) return sceneGriefWastes(p);
  return sceneAkuSanctum(p);
}

vec3 calcNormal(vec3 p){
  const float h=.002;const vec2 k=vec2(1.,-1.);
  return normalize(k.xyy*scene(p+k.xyy*h)+k.yyx*scene(p+k.yyx*h)+
                   k.yxy*scene(p+k.yxy*h)+k.xxx*scene(p+k.xxx*h));
}

void main(){
  vec2 p=(gl_FragCoord.xy-uRes*.5)/uRes.y;

  // Slow auto-orbit camera
  float ct=cos(uTime*.08),st2=sin(uTime*.08);
  vec3 eye=vec3(st2*4.,2.+sin(uTime*.12)*.5,ct*4.);
  vec3 ta=vec3(0.,.5,0.);
  vec3 fwd=normalize(ta-eye);
  vec3 right=normalize(cross(fwd,vec3(0,1,0)));
  vec3 up=cross(right,fwd);
  vec3 rd=normalize(p.x*right+p.y*up+1.5*fwd);

  float t=0.;
  vec3 col=vec3(.02,.02,.04);

  for(int i=0;i<STEPS;i++){
    vec3 pos=eye+rd*t;
    float d=scene(pos);
    if(d<EPS){
      vec3 n=calcNormal(pos);
      vec3 ld=normalize(vec3(.5,.8,-.3));
      float diff=max(dot(n,ld),0.);
      float spec=pow(max(dot(reflect(-ld,n),-rd),0.),16.);

      // Location accent color for lighting
      col=uAccent*(0.08+diff*0.5)+uAccent*spec*.3;

      // Substance high: pulse the colors
      if(uHigh>0.01){
        col+=uAccent*sin(uTime*4.+pos.y*3.)*.1*uHigh;
      }

      // Fog
      float fog=exp(-t*.15);
      col=mix(vec3(.02,.02,.04),col,fog);
      break;
    }
    t+=d;
    if(t>FAR)break;
  }

  // Vignette
  float v=1.-dot(p,p)*.3;
  col*=v;

  // Dim so UI is readable on top
  col*=0.35;

  O=vec4(col,1.);
}`;

// Compile
function mkShader(src,type){
  const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(s));return null}
  return s;
}
const bgVs=mkShader(BG_VS,gl.VERTEX_SHADER);
const bgFs=mkShader(BG_FS,gl.FRAGMENT_SHADER);
let bgProg=null,bgUniforms={};

if(bgVs&&bgFs){
  bgProg=gl.createProgram();
  gl.attachShader(bgProg,bgVs);gl.attachShader(bgProg,bgFs);gl.linkProgram(bgProg);

  const buf=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  gl.useProgram(bgProg);
  const a=gl.getAttribLocation(bgProg,'a');
  gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);

  bgUniforms={
    uRes:gl.getUniformLocation(bgProg,'uRes'),
    uTime:gl.getUniformLocation(bgProg,'uTime'),
    uWarp:gl.getUniformLocation(bgProg,'uWarp'),
    uHigh:gl.getUniformLocation(bgProg,'uHigh'),
    uDistort:gl.getUniformLocation(bgProg,'uDistort'),
    uScene:gl.getUniformLocation(bgProg,'uScene'),
    uAccent:gl.getUniformLocation(bgProg,'uAccent'),
  };
}

// Location accent colors (RGB 0-1)
const LOC_ACCENTS = [
  [0, 0.82, 1],     // Trench Hub — teal
  [0.13, 0.27, 0.66], // Kraken Depths — deep blue
  [1, 0.38, 0.63],  // Dim Mak — pink
  [1, 0.55, 0],     // Mecha Station — orange
  [0.67, 0.13, 0.2], // Grief Wastes — blood
  [0.69, 0.38, 1],  // Aku Sanctum — purple
];

let bgScene = 0;
let bgWarp = 0;     // 0-1 during travel
let bgHigh = 0;     // 0-1 substance high level
let bgDistort = 0;  // 0-1 substance visual distortion

function renderBg(t){
  if(!bgProg)return;
  resizeBg();
  gl.viewport(0,0,BW,BH);
  gl.useProgram(bgProg);
  gl.uniform2f(bgUniforms.uRes,BW,BH);
  gl.uniform1f(bgUniforms.uTime,t);
  gl.uniform1f(bgUniforms.uWarp,bgWarp);
  gl.uniform1f(bgUniforms.uHigh,bgHigh);
  gl.uniform1f(bgUniforms.uDistort,bgDistort);
  gl.uniform1i(bgUniforms.uScene,bgScene);
  const ac=LOC_ACCENTS[bgScene%LOC_ACCENTS.length];
  gl.uniform3f(bgUniforms.uAccent,ac[0],ac[1],ac[2]);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
}

// ═══════════════════════════════════════════════════
// LAYER 2: 2D Game (import full existing game logic)
// ═══════════════════════════════════════════════════
const canvas = document.getElementById('gc');
const ctx = canvas.getContext('2d');
let W, H;
function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight}
resize();window.addEventListener('resize',resize);

// ── Colors ──
const BG='rgba(0,0,0,0)'; // transparent — WebGL shows through
const TEAL='#00d2ff';const PINK='#ff60a0';const GOLD='#ffd700';
const GREEN='#39ff14';const RED='#ff3344';const PURPLE='#b060ff';
const ORANGE='#ff8c00';const WHITE='#e0e0e0';const DIM='#556677';
const PANEL_BG='rgba(8,12,30,0.82)';const PANEL_BORDER='rgba(0,210,255,0.25)';

// ── Sieve Constants ──
const SALEZ=[2,3,5,7,8,9,11];
const SEEDS=[9,41,49,89,161,169,281,401,601,609,641,649,801,921,961];
const DIGIT_SUMS=[43,46,49,52,55,58,61,64,67,70,73];

// ── Stars (visible through transparent canvas) ──
const stars=[];
for(let i=0;i<200;i++)stars.push({x:Math.random(),y:Math.random(),s:Math.random()*2+0.5,b:Math.random()});
function drawStars(t){
  for(const s of stars){
    const bri=0.3+0.7*(0.5+0.5*Math.sin(t*0.001+s.b*10));
    ctx.fillStyle=`rgba(200,220,255,${bri*0.3})`;
    ctx.fillRect(s.x*W,s.y*H,s.s,s.s);
  }
}

// ── Game Data (same as original) ──
const SUBSTANCES=[
  {name:'Void Dust',color:'#88aacc',minPrice:15,maxPrice:40},
  {name:'Nebula Crystals',color:'#aa66ff',minPrice:50,maxPrice:120},
  {name:'Plasma Vials',color:'#ff6644',minPrice:200,maxPrice:500},
  {name:'Dark Matter',color:'#334466',minPrice:1000,maxPrice:3000},
  {name:'Quantum Tears',color:'#00eeff',minPrice:5000,maxPrice:12000},
  {name:'Onion Extract',color:GOLD,minPrice:10000,maxPrice:50000}
];

const SUBSTANCE_EFFECTS=[
  {potency:10,duration:1,addictive:false},
  {potency:25,duration:2,addictive:false},
  {potency:40,duration:2,addictive:false},
  {potency:60,duration:3,addictive:false},
  {potency:80,duration:3,addictive:false},
  {potency:100,duration:4,addictive:true}
];

const LOCATIONS=[
  {name:'Trench Hub',desc:'Balanced prices',color:TEAL,priceMod:[1,1,1,1,1,1],policeRate:0.08,volatility:0.2},
  {name:'Kraken Depths',desc:'Cheap dust, pricey tears',color:'#2244aa',priceMod:[.5,.8,1,1.2,1.8,1.3],policeRate:0.12,volatility:0.3},
  {name:'Dim Mak District',desc:'Volatile, frequent events',color:PINK,priceMod:[1.2,1.1,.9,.8,1,1.2],policeRate:0.15,volatility:0.6},
  {name:'Mecha Station',desc:'Stable, high security',color:ORANGE,priceMod:[1.1,1,1.1,1,.9,.8],policeRate:0.22,volatility:0.1},
  {name:'Grief Wastes',desc:'Everything cheap, dangerous',color:'#aa2233',priceMod:[.6,.6,.7,.7,.8,.9],policeRate:0.25,volatility:0.4},
  {name:'Aku Sanctum',desc:'Rare goods, mysterious',color:PURPLE,priceMod:[1.3,1.2,1,.9,.7,.5],policeRate:0.1,volatility:0.5}
];

const CHARACTERS=[
  {id:'defender',name:'Defender',bonus:'+$500 starting cash'},
  {id:'dimmak',name:'Dim Mak',bonus:'+30 inventory slots'},
  {id:'mecha',name:'Mecha',bonus:'-50% police encounters'},
  {id:'kraken',name:'Kraken',bonus:'10% buy discount'},
  {id:'akuaku',name:'Aku Aku',bonus:'See price trends'},
  {id:'grief',name:'Grief',bonus:'+$2000 but starts in debt'}
];

const DEALER_RANKS=[{name:'Petty Dealer',min:0},{name:'Street Hustler',min:SEEDS[1]*50},
  {name:'Kingpin',min:SEEDS[4]*120},{name:'Cartel Boss',min:SEEDS[7]*200},
  {name:'Galactic Overlord',min:SEEDS[10]*400}];

// ── Game State ──
let state='title';
let selectedChar=0;
let game=null;
let buttons=[];
let mouseX=0,mouseY=0;
let eventLog=[];
let priceHistory=[[],[],[],[],[],[]];
let floatingTexts=[];
let highScores=JSON.parse(localStorage.getItem('igd3d_highscores')||'[]');
let gameTime=0;

function newGame(charIdx){
  const ch=CHARACTERS[charIdx];
  let cash=2000,debt=0,maxSlots=100;
  if(ch.id==='defender')cash+=500;
  if(ch.id==='dimmak')maxSlots+=30;
  if(ch.id==='grief'){cash+=2000;debt=5000}
  game={day:1,maxDays:30,cash,debt,health:100,maxSlots,
    inventory:[0,0,0,0,0,0],location:0,character:ch.id,charIdx,
    prices:[],prevPrices:null,loanRate:0.10,
    upgradesBought:[false,false,false],
    priceTrends:[0,0,0,0,0,0],
    // User mode
    highMeter:50,tolerance:[0,0,0,0,0,0],totalUses:0,
    daysAlive:0,withdrawalActive:false,lastUsedDay:0,
    role:'dealer'
  };
  generatePrices();
  eventLog=['Welcome to the Trench Hub. The void breathes around you.'];
  priceHistory=[[],[],[],[],[],[]];
  for(let i=0;i<6;i++)priceHistory[i].push(game.prices[i]);
  floatingTexts=[];
  bgScene=0;bgWarp=0;bgHigh=0;bgDistort=0;
}

function generatePrices(){
  const loc=LOCATIONS[game.location];
  game.prevPrices=game.prices.length?[...game.prices]:null;
  game.prices=[];game.priceTrends=[];
  for(let i=0;i<6;i++){
    const sub=SUBSTANCES[i];
    const base=sub.minPrice+Math.random()*(sub.maxPrice-sub.minPrice);
    const vol=1+(Math.random()*2-1)*loc.volatility;
    game.prices.push(Math.max(1,Math.round(base*loc.priceMod[i]*vol)));
    game.priceTrends.push(Math.random()<.33?-1:Math.random()<.5?1:0);
  }
}

function totalInventory(){return game.inventory.reduce((a,b)=>a+b,0)}
function netWorth(){
  let v=game.cash-game.debt;
  for(let i=0;i<6;i++)v+=game.inventory[i]*game.prices[i];
  return v;
}
function getRank(w){
  let r=DEALER_RANKS[0];
  for(const rank of DEALER_RANKS)if(w>=rank.min)r=rank;
  return r;
}

function addFloat(text,x,y,color){floatingTexts.push({text,x,y,color,life:60,startY:y})}
function addLog(msg){eventLog.unshift(`[Day ${game.day}] ${msg}`);if(eventLog.length>30)eventLog.pop()}

// ── Trading ──
function buySubstance(si,qty){
  const price=game.prices[si];
  let discount=game.character==='kraken'?0.9:1;
  const cost=Math.round(price*discount);
  const freeSlots=game.maxSlots-totalInventory();
  const maxAfford=Math.floor(game.cash/cost);
  const actual=Math.min(qty===0?99999:qty,freeSlots,maxAfford);
  if(actual<=0)return;
  game.cash-=actual*cost;game.inventory[si]+=actual;
  addLog(`Bought ${actual} ${SUBSTANCES[si].name} @ $${cost.toLocaleString()}`);
  addFloat(`-$${(actual*cost).toLocaleString()}`,W/2,H/2,RED);
}

function sellSubstance(si,qty){
  const price=game.prices[si];
  const actual=Math.min(qty===0?99999:qty,game.inventory[si]);
  if(actual<=0)return;
  game.cash+=actual*price;game.inventory[si]-=actual;
  addLog(`Sold ${actual} ${SUBSTANCES[si].name} @ $${price.toLocaleString()}`);
  addFloat(`+$${(actual*price).toLocaleString()}`,W/2,H/2,GREEN);
}

// ── Travel (triggers 3D warp) ──
function travelTo(locIdx){
  if(locIdx===game.location)return;
  if(game.day>=game.maxDays){endGame();return}
  game.day++;
  if(game.debt>0)game.debt=Math.round(game.debt*(1+game.loanRate));
  game.location=locIdx;
  bgScene=locIdx; // Switch 3D background
  bgWarp=1.0;     // Trigger warp animation
  generatePrices();
  for(let i=0;i<6;i++){priceHistory[i].push(game.prices[i]);if(priceHistory[i].length>7)priceHistory[i].shift()}
  addLog(`Warped to ${LOCATIONS[locIdx].name}.`);
  if(Math.random()<0.4)triggerRandomEvent();
  if(game.day>=game.maxDays)setTimeout(()=>endGame(),800);
}

function waitDay(){
  if(game.day>=game.maxDays){endGame();return}
  game.day++;
  if(game.debt>0)game.debt=Math.round(game.debt*(1+game.loanRate));
  generatePrices();
  for(let i=0;i<6;i++){priceHistory[i].push(game.prices[i]);if(priceHistory[i].length>7)priceHistory[i].shift()}
  addLog('Waited a day. Prices shifted.');
  addFloat('DAY +1',W/2,H/3,DIM);
  if(Math.random()<0.3)triggerRandomEvent();
  if(game.day>=game.maxDays)setTimeout(()=>endGame(),800);
}

// ── Events (simplified) ──
function triggerRandomEvent(){
  const roll=Math.random();
  if(roll<0.15){
    const si=Math.floor(Math.random()*6);
    game.prices[si]=Math.max(1,Math.round(game.prices[si]*(0.2+Math.random()*0.3)));
    addLog(`${SUBSTANCES[si].name} CRASHED!`);addFloat('CRASH',W/2,H/4,GREEN);
  }else if(roll<0.3){
    const si=Math.floor(Math.random()*6);
    game.prices[si]=Math.round(game.prices[si]*(2+Math.random()*3));
    addLog(`${SUBSTANCES[si].name} SURGED!`);addFloat('SURGE',W/2,H/4,GOLD);
  }else if(roll<0.45){
    let chance=LOCATIONS[game.location].policeRate;
    if(game.character==='mecha')chance*=0.5;
    if(Math.random()<chance){
      const owned=game.inventory.map((q,i)=>({q,i})).filter(x=>x.q>0);
      if(owned.length>0){
        const t=owned[Math.floor(Math.random()*owned.length)];
        const lost=Math.min(t.q,Math.ceil(t.q*0.4));
        game.inventory[t.i]-=lost;
        addLog(`Police seized ${lost} ${SUBSTANCES[t.i].name}!`);
        addFloat('RAIDED',W/2,H/4,RED);
        bgDistort=0.5; // Visual distortion on raid
      }
    }
  }else if(roll<0.55){
    const found=Math.round(100+Math.random()*800);
    game.cash+=found;
    addLog(`Found $${found.toLocaleString()} in cargo!`);
    addFloat(`+$${found}`,W/2,H/4,GOLD);
  }else if(roll<0.65){
    const dmg=Math.floor(Math.random()*20)+5;
    game.health=Math.max(0,game.health-dmg);
    addLog(`Ambushed! -${dmg} HP`);addFloat(`-${dmg} HP`,W/2,H/4,RED);
    bgDistort=0.3;
    if(game.health<=0)endGame();
  }
}

function endGame(){
  const worth=netWorth();
  highScores.push({worth,rank:getRank(worth).name,character:game.character,date:new Date().toLocaleDateString()});
  highScores.sort((a,b)=>b.worth-a.worth);
  highScores=highScores.slice(0,10);
  localStorage.setItem('igd3d_highscores',JSON.stringify(highScores));
  state='gameover';
}

// ── Drawing helpers ──
function drawPanel(x,y,w,h,bc){
  ctx.fillStyle=PANEL_BG;
  // Rounded rect
  const r=6;
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
  ctx.fill();ctx.strokeStyle=bc||PANEL_BORDER;ctx.lineWidth=1;ctx.stroke();
}

function drawText(text,x,y,color,size,align){
  ctx.fillStyle=color||WHITE;ctx.font=`${size||14}px 'Courier New',monospace`;
  ctx.textAlign=align||'left';ctx.textBaseline='top';ctx.fillText(text,x,y);
}

function isHover(x,y,w,h){return mouseX>=x&&mouseX<=x+w&&mouseY>=y&&mouseY<=y+h}

function drawButton(label,x,y,w,h,color,hov){
  ctx.fillStyle=hov?(color+'22'):'rgba(0,0,0,0.2)';
  const r=4;
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
  ctx.fill();ctx.strokeStyle=hov?color:(color+'66');ctx.lineWidth=hov?2:1;ctx.stroke();
  ctx.fillStyle=hov?WHITE:color;ctx.font=`${Math.min(13,h-6)}px 'Courier New',monospace`;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x+w/2,y+h/2);
}

// ── Draw sparkline ──
function drawSparkline(x,y,w,h,data,color){
  if(data.length<2)return;
  const min=Math.min(...data),max=Math.max(...data);
  const range=max-min||1;
  ctx.beginPath();
  for(let i=0;i<data.length;i++){
    const px=x+i/(data.length-1)*w;
    const py=y+h-(data[i]-min)/range*h;
    if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();
}

// ── Title Screen ──
function drawTitle(t){
  ctx.clearRect(0,0,W,H);
  drawStars(t);
  const cx=W/2;
  ctx.save();ctx.shadowColor=TEAL;ctx.shadowBlur=25;
  drawText('INTERGALACTIC',cx,H*0.15,TEAL,Math.min(48,W*0.04),'center');
  drawText('DRUG DEALERS',cx,H*0.15+55,GOLD,Math.min(56,W*0.05),'center');
  ctx.shadowBlur=0;ctx.restore();
  drawText('3D EDITION · Guinea Pig Trench',cx,H*0.15+120,DIM,12,'center');

  buttons=[];
  const bw=260,bh=50,bx=cx-bw/2,by=H*0.15+160;
  drawButton('[ START GAME ]',bx,by,bw,bh,TEAL,isHover(bx,by,bw,bh));
  buttons.push({x:bx,y:by,w:bw,h:bh,action:()=>{state='charselect'}});
}

// ── Character Select ──
function drawCharSelect(t){
  ctx.clearRect(0,0,W,H);
  drawStars(t);
  drawText('SELECT CHARACTER',W/2,40,TEAL,24,'center');
  buttons=[];
  const cols=3,cardW=Math.min(200,(W-80)/cols-20),cardH=120;
  const startX=W/2-(cols*(cardW+20))/2+10;

  for(let i=0;i<6;i++){
    const col=i%cols,row=Math.floor(i/cols);
    const x=startX+col*(cardW+20),y=100+row*(cardH+15);
    const ch=CHARACTERS[i];
    const hov=isHover(x,y,cardW,cardH);
    const sel=selectedChar===i;
    drawPanel(x,y,cardW,cardH,sel?GOLD:(hov?TEAL:PANEL_BORDER));
    drawText(ch.name,x+cardW/2,y+20,sel?GOLD:TEAL,16,'center');
    drawText(ch.bonus,x+cardW/2,y+45,DIM,10,'center');
    const ci=i;
    buttons.push({x,y,w:cardW,h:cardH,action:()=>{selectedChar=ci}});
  }

  const bw=200,bh=45,bx=W/2-bw/2,by=100+Math.ceil(6/cols)*(cardH+15)+10;
  drawButton('[ BEGIN ]',bx,by,bw,bh,GOLD,isHover(bx,by,bw,bh));
  buttons.push({x:bx,y:by,w:bw,h:bh,action:()=>{newGame(selectedChar);state='game'}});
}

// ── Main Game Screen ──
function drawGame(t){
  ctx.clearRect(0,0,W,H); // transparent — 3D shows through

  // Decay effects
  bgWarp=Math.max(0,bgWarp-0.015);
  bgDistort=Math.max(0,bgDistort-0.008);

  buttons=[];
  const loc=LOCATIONS[game.location];

  // ── Top HUD bar ──
  drawPanel(0,0,W,45,PANEL_BORDER);
  drawText(`DAY ${game.day}/${game.maxDays}`,15,12,TEAL,15);
  ctx.save();ctx.shadowColor=GREEN;ctx.shadowBlur=8;
  drawText(`$${game.cash.toLocaleString()}`,180,12,GREEN,15);
  ctx.shadowBlur=0;ctx.restore();
  if(game.debt>0)drawText(`DEBT $${game.debt.toLocaleString()}`,360,12,RED,13);
  drawText(`INV ${totalInventory()}/${game.maxSlots}`,520,12,ORANGE,13);
  drawText(`HP ${game.health}`,660,12,game.health<30?RED:WHITE,13);
  ctx.save();ctx.shadowColor=GOLD;ctx.shadowBlur=10;
  drawText(`NET $${netWorth().toLocaleString()}`,W-200,12,GOLD,15);
  ctx.shadowBlur=0;ctx.restore();

  // ── Location + Map (left) ──
  const leftW=Math.min(200,W*0.18),leftX=10,leftY=55;
  drawPanel(leftX,leftY,leftW,H-120,loc.color+'44');
  ctx.save();ctx.shadowColor=loc.color;ctx.shadowBlur=12;
  drawText(loc.name,leftX+leftW/2,leftY+12,loc.color,14,'center');
  ctx.shadowBlur=0;ctx.restore();
  drawText(loc.desc,leftX+leftW/2,leftY+32,DIM,9,'center');

  // Location nodes as mini galaxy map
  const mapCx=leftX+leftW/2,mapCy=leftY+120,mapR=60;
  for(let i=0;i<6;i++){
    const ang=(i/6)*Math.PI*2-Math.PI/2;
    const nx=mapCx+Math.cos(ang)*mapR,ny=mapCy+Math.sin(ang)*mapR;
    const isCur=game.location===i;
    const hov=isHover(nx-15,ny-15,30,30);

    // Node
    ctx.beginPath();ctx.arc(nx,ny,isCur?10:7,0,Math.PI*2);
    ctx.fillStyle=isCur?LOCATIONS[i].color+'88':'rgba(255,255,255,0.05)';ctx.fill();
    ctx.strokeStyle=LOCATIONS[i].color+(hov?'cc':'44');ctx.lineWidth=hov?2:1;ctx.stroke();

    if(isCur){ctx.save();ctx.shadowColor=LOCATIONS[i].color;ctx.shadowBlur=15;
      ctx.beginPath();ctx.arc(nx,ny,10,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.restore()}

    drawText(LOCATIONS[i].name.split(' ')[0],nx,ny+14,DIM,7,'center');

    if(!isCur){
      const li=i;
      buttons.push({x:nx-15,y:ny-15,w:30,h:30,action:()=>travelTo(li)});
    }
  }

  // Wait button
  const waitY=mapCy+mapR+40;
  const waitHov=isHover(leftX+10,waitY,leftW-20,28);
  drawButton('WAIT [W]',leftX+10,waitY,leftW-20,28,DIM,waitHov);
  buttons.push({x:leftX+10,y:waitY,w:leftW-20,h:28,action:waitDay});

  // Rank
  const rank=getRank(netWorth());
  drawText('RANK',leftX+10,waitY+40,DIM,8);
  drawText(rank.name,leftX+10,waitY+52,GOLD,12);

  // ── Trading cards (center) ──
  const centerX=leftX+leftW+10,centerW=W-centerX-220,centerY=55;
  drawPanel(centerX,centerY,centerW,H-120,PANEL_BORDER);
  drawText('MARKET',centerX+15,centerY+10,TEAL,12);

  const cardH=Math.min(75,(H-180)/6-4);

  for(let i=0;i<6;i++){
    const sub=SUBSTANCES[i];
    const cy=centerY+30+i*(cardH+4);
    const rowHov=mouseY>=cy&&mouseY<cy+cardH&&mouseX>=centerX&&mouseX<=centerX+centerW;

    // Card background
    ctx.fillStyle=rowHov?'rgba(0,210,255,0.04)':'rgba(0,0,0,0.15)';
    ctx.fillRect(centerX+8,cy,centerW-16,cardH);

    // Substance icon (colored orb)
    ctx.beginPath();ctx.arc(centerX+30,cy+cardH/2,10,0,Math.PI*2);
    ctx.fillStyle=sub.color+'44';ctx.fill();
    ctx.strokeStyle=sub.color;ctx.lineWidth=1.5;ctx.stroke();

    // Name + price
    drawText(sub.name,centerX+50,cy+6,sub.color,12);
    ctx.save();ctx.shadowColor=sub.color;ctx.shadowBlur=6;
    drawText(`$${game.prices[i].toLocaleString()}`,centerX+50,cy+22,WHITE,14);
    ctx.shadowBlur=0;ctx.restore();

    // Sparkline
    if(priceHistory[i].length>1){
      drawSparkline(centerX+200,cy+8,80,cardH-16,priceHistory[i],sub.color+'88');
    }

    // Owned
    drawText(`×${game.inventory[i]}`,centerX+290,cy+12,game.inventory[i]>0?WHITE:DIM,12);

    // Buy/Sell buttons
    const btnY=cy+6;
    const buyX=centerX+centerW-140,sellX=centerX+centerW-70;
    const buyHov=isHover(buyX,btnY,60,cardH-12);
    const sellHov=isHover(sellX,btnY,60,cardH-12);
    drawButton('BUY',buyX,btnY,60,cardH-12,GREEN,buyHov);
    drawButton('SELL',sellX,btnY,60,cardH-12,RED,sellHov);
    const si=i;
    buttons.push({x:buyX,y:btnY,w:60,h:cardH-12,action:()=>buySubstance(si,1)});
    buttons.push({x:sellX,y:btnY,w:60,h:cardH-12,action:()=>sellSubstance(si,1)});
  }

  // ── Event log (right sidebar) ──
  const rightX=W-200,rightW=190,rightY=55;
  drawPanel(rightX,rightY,rightW,H-120,PANEL_BORDER);
  drawText('EVENT LOG',rightX+10,rightY+10,DIM,9);
  ctx.save();
  ctx.beginPath();ctx.rect(rightX+5,rightY+24,rightW-10,H-170);ctx.clip();
  for(let i=0;i<Math.min(20,eventLog.length);i++){
    const alpha=i===0?1:0.4;
    ctx.globalAlpha=alpha;
    drawText(eventLog[i],rightX+10,rightY+28+i*16,WHITE,9);
  }
  ctx.globalAlpha=1;ctx.restore();

  // ── Floating texts ──
  for(let i=floatingTexts.length-1;i>=0;i--){
    const ft=floatingTexts[i];ft.life--;
    if(ft.life<=0){floatingTexts.splice(i,1);continue}
    const alpha=ft.life/60;
    const yOff=(60-ft.life)*1.5;
    ctx.globalAlpha=alpha;
    ctx.save();ctx.shadowColor=ft.color;ctx.shadowBlur=10;
    drawText(ft.text,ft.x,ft.startY-yOff,ft.color,18,'center');
    ctx.shadowBlur=0;ctx.restore();
    ctx.globalAlpha=1;
  }
}

// ── Game Over ──
function drawGameOver(t){
  ctx.clearRect(0,0,W,H);
  drawStars(t);
  const cx=W/2;
  const worth=netWorth();
  const rank=getRank(worth);

  ctx.save();ctx.shadowColor=worth>=0?GREEN:RED;ctx.shadowBlur=30;
  drawText('GAME OVER',cx,H*0.15,worth>=0?GREEN:RED,42,'center');
  ctx.shadowBlur=0;ctx.restore();

  drawText(`Net Worth: $${worth.toLocaleString()}`,cx,H*0.3,GOLD,28,'center');
  drawText(`Rank: ${rank.name}`,cx,H*0.38,TEAL,20,'center');
  drawText(`Day ${game.day} · ${CHARACTERS[game.charIdx].name}`,cx,H*0.45,DIM,14,'center');

  buttons=[];
  const bw=220,bh=45,bx=cx-bw/2,by=H*0.55;
  drawButton('[ PLAY AGAIN ]',bx,by,bw,bh,TEAL,isHover(bx,by,bw,bh));
  buttons.push({x:bx,y:by,w:bw,h:bh,action:()=>{state='charselect';selectedChar=0}});
}

// ── Input ──
canvas.addEventListener('mousemove',e=>{mouseX=e.clientX;mouseY=e.clientY});
canvas.addEventListener('click',e=>{
  mouseX=e.clientX;mouseY=e.clientY;
  for(const btn of buttons)if(isHover(btn.x,btn.y,btn.w,btn.h)){btn.action();return}
});
canvas.addEventListener('touchend',e=>{
  if(e.changedTouches.length){
    mouseX=e.changedTouches[0].clientX;mouseY=e.changedTouches[0].clientY;
    for(const btn of buttons)if(isHover(btn.x,btn.y,btn.w,btn.h)){btn.action();return}
  }
},{passive:true});

document.addEventListener('keydown',e=>{
  if(state!=='game')return;
  if(e.key==='w'||e.key==='W')waitDay();
  const n=parseInt(e.key);
  if(n>=1&&n<=6)travelTo(n-1);
});

// ── Main Loop ──
function frame(t){
  gameTime=t;
  const ts=t*0.001;

  // Render 3D background
  renderBg(ts);

  // Render 2D game
  switch(state){
    case'title':drawTitle(t);break;
    case'charselect':drawCharSelect(t);break;
    case'game':drawGame(t);break;
    case'gameover':drawGameOver(t);break;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

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
  var hbPeriod = 0.6659659316376889;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.014222970733373134;mix-blend-mode:overlay';
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