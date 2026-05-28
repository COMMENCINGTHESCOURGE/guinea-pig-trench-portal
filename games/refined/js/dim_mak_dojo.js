
const bg=new RayBG('bg','arena',{dim:0.3,accent:[1,0.84,0]});
const C=document.getElementById('gc'),X=C.getContext('2d');
let W,H,FLOOR_Y;
const BG='#0a0810',GOLD='#FFD700',CRIMSON='#8B1A1A',CRIMSON_LIGHT='#B22222',
  DARK_GOLD='#B8860B',GREEN='#00ff88',RED='#ff3333',WHITE='#f0e6d3',
  INK='#1a1a2e',PARCHMENT='rgba(139,119,101,0.04)';

function resize(){W=C.width=window.innerWidth;H=C.height=window.innerHeight;FLOOR_Y=H*0.85}
resize();window.addEventListener('resize',resize);

// ============ AUDIO ============
const audioCtx=new(window.AudioContext||window.webkitAudioContext)();
function playSound(freq,dur,type='sine',vol=0.15){
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;o.frequency.value=freq;g.gain.value=vol;
  g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+dur);
  o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur);
}
function hitSound(){playSound(220,0.15,'triangle',0.2);playSound(110,0.2,'square',0.1)}
function missSound(){playSound(80,0.3,'sawtooth',0.1)}
function comboSound(n){playSound(440+n*60,0.1,'sine',0.15)}
function koSound(){playSound(60,0.5,'sawtooth',0.25);playSound(40,0.8,'square',0.15)}
function selectSound(){playSound(660,0.08,'sine',0.1);playSound(880,0.08,'sine',0.08)}

// ============ PRESSURE POINTS ============
// Positions as fractions of body height/width relative to figure center
const PRESSURE_POINTS=[
  {id:'GV20',name:'Baihui',label:'Crown (GV20)',x:0,y:-0.48,meridian:'GV'},
  {id:'taiyang',name:'Taiyang',label:'Temple',x:0.08,y:-0.42,meridian:'EX'},
  {id:'GV26',name:'Renzhong',label:'Philtrum (GV26)',x:0,y:-0.37,meridian:'GV'},
  {id:'GV16',name:'Fengfu',label:'Base of Skull (GV16)',x:0,y:-0.44,meridian:'GV'},
  {id:'CV22',name:'Throat',label:'Throat (CV22)',x:0,y:-0.30,meridian:'CV'},
  {id:'GB21',name:'Jianjing',label:'Trapezius (GB21)',x:0.14,y:-0.28,meridian:'GB'},
  {id:'CV12',name:'Solar Plexus',label:'Solar Plexus (CV12)',x:0,y:-0.12,meridian:'CV'},
  {id:'HT1',name:'Heart',label:'Heart (HT1)',x:0.06,y:-0.20,meridian:'HT'},
  {id:'ribs',name:'Floating Ribs',label:'Floating Ribs',x:0.12,y:-0.08,meridian:'LV'},
  {id:'CV4',name:'Dantian',label:'Dantian (CV4-6)',x:0,y:0.0,meridian:'CV'},
  {id:'PC6',name:'Inner Wrist',label:'Inner Wrist (PC6)',x:0.25,y:-0.02,meridian:'PC'},
  {id:'ST36',name:'Knee',label:'Knee (ST36)',x:0.07,y:0.22,meridian:'ST'},
  {id:'peroneal',name:'Peroneal',label:'Peroneal Nerve',x:0.09,y:0.32,meridian:'GB'},
];

// Meridian connections for drawing lines
const MERIDIAN_LINES=[
  ['GV20','GV16','GV26','CV22','CV12','CV4'],  // centerline
  ['GB21','HT1','ribs','CV4'],
  ['GB21','PC6'],
  ['CV4','ST36','peroneal'],
  ['taiyang','GV16'],
];

// ============ TECHNIQUES ============
const TECHNIQUES=[
  {id:'crane',nameCN:'白鶴式',nameEN:'White Crane Guard',pinyinName:'Bái Hè',
   hand:'Crane beak hands — fingers pinched to point',stance:'Horse stance, arms spread',
   targets:[],effect:'Defensive ready state. Centers chi, opens awareness.',
   description:'The foundation. Stand rooted like a mountain, hands poised like crane beaks ready to strike or deflect.'},
  {id:'snake',nameCN:'蛇形刺',nameEN:'Snake Finger Jab',pinyinName:'Shé Xíng Cì',
   hand:'Two-finger spear — index and middle extended',stance:'Forward bow stance, lead hand jabbing',
   targets:['CV22','taiyang'],effect:'Fast precision strike to soft tissue. Disorientation, airway disruption.',
   description:'The snake strikes without warning. Two fingers become a spear aimed at the throat or eyes.'},
  {id:'phoenix',nameCN:'鳳眼拳',nameEN:'Phoenix Eye Fist',pinyinName:'Fèng Yǎn Quán',
   hand:'Index knuckle protruding from fist',stance:'Front stance, fist drives forward',
   targets:['CV12','taiyang'],effect:'Concentrated force through single knuckle. Solar plexus: wind knocked out. Temple: KO.',
   description:'The phoenix eye focuses all power into a single protruding knuckle — devastating to nerve clusters.'},
  {id:'tiger',nameCN:'虎掌',nameEN:'Tiger Palm',pinyinName:'Hǔ Zhǎng',
   hand:'Open palm heel, fingers curled back',stance:'Horse to bow transition, palm drives upward',
   targets:['GV26'],effect:'Rising palm heel to jaw. Concussive knockout force.',
   description:'The tiger\'s paw rises with explosive power. The heel of the palm meets the jaw — lights out.'},
  {id:'knife',nameCN:'刀手',nameEN:'Knife Hand',pinyinName:'Dāo Shǒu',
   hand:'Blade edge of hand, fingers tight together',stance:'Side stance, arm sweeps laterally',
   targets:['GB21','CV22'],effect:'Edge chop to carotid artery or collarbone. Blood flow disruption, fracture.',
   description:'The hand becomes a blade. A clean chop to the neck disrupts blood to the brain instantly.'},
  {id:'eagle',nameCN:'鷹爪',nameEN:'Eagle Claw',pinyinName:'Yīng Zhuǎ',
   hand:'Clawed grip — fingers hooked like talons',stance:'Cat stance, grabbing motion',
   targets:['GB21','CV22','PC6'],effect:'Grab and rip nerves, tendons, throat. Incapacitating pain.',
   description:'The eagle seizes its prey. Iron fingers lock onto nerve clusters and rip with terrible force.'},
  {id:'dianxue',nameCN:'點穴',nameEN:'Point Strike',pinyinName:'Diǎn Xué',
   hand:'Single extended finger — precise point contact',stance:'Neutral stance, deliberate motion',
   targets:['GV20','GV16','PC6','ST36'],effect:'The true Dim Mak. Disrupts qi flow through meridian points. Delayed effects.',
   description:'The art itself. One finger, one point, and the body\'s energy flow is redirected or halted entirely.'},
  {id:'death',nameCN:'雙擊',nameEN:'Death Touch',pinyinName:'Shuāng Jī',
   hand:'Both hands strike simultaneously — one to each target',stance:'Deep horse stance, both arms extend',
   targets:['HT1','CV12'],effect:'Simultaneous heart + solar plexus strike. Cardiac disruption. The killing blow.',
   description:'The forbidden technique. Both points must be struck in the same heartbeat. There is no defense.'},
];

// ============ GAME STATE ============
let gameState='title'; // title, training, speed, combat, stats
let trainIdx=0, trainStep='show'; // show, click, done
let trainClickTarget=0;
let trainAnimTimer=0, trainCorrectFlash=0;

// Speed mode
let speedScore=0, speedCombo=0, speedBestCombo=0, speedMisses=0;
let speedActivePoint=null, speedTimer=0, speedTimeLimit=2.0;
let speedTechnique=null, speedGameOver=false, speedStartTime=0;
let speedPointsHit=0;

// Combat mode
let combatPlayer=null, combatEnemy=null, combatRound=1;
let combatPlayerWins=0, combatEnemyWins=0, combatTimer=60;
let combatState='fight'; // fight, roundEnd, gameEnd
let combatPressurePoints=[], combatPPTimer=0;
let combatChiMeter=0;
let combatEffects=[];
let combatHitParticles=[];
let combatRoundEndTimer=0;

// Animation
let t=0, mouseX=0, mouseY=0, mouseClick=false, mouseDown=false;
let clickX=0, clickY=0;
let particles=[];
let inkSplashes=[];
let keys={};

// Stats
let stats={trainCompleted:0,speedBest:0,combatWins:0,combatLosses:0,totalPPHits:0};
try{const s=localStorage.getItem('dimMakStats');if(s)stats=JSON.parse(s)}catch(e){}
function saveStats(){try{localStorage.setItem('dimMakStats',JSON.stringify(stats))}catch(e){}}

// Hover state
let hoveredButton=null;
let hoveredPoint=null;

// Sprites
let spriteImg=null, spriteLoaded=false;
let opponentSprites={};
const SPRITE_SRC='../assets/sprites/dim_mak_fighter_full_sheet.png';
const OPPONENT_SRCS={
  defender:{src:'../assets/sprites/armored_defender_sprite_sheet.png',name:'DEFENDER'},
  kraken:{src:'../assets/sprites/kraken_game_render.png',name:'KRAKEN'},
  mecha:{src:'../assets/sprites/mecha_entity_alpha_v2.png',name:'MECHA'},
};

// Load sprites
const sImg=new Image();sImg.onload=()=>{spriteLoaded=true;spriteImg=sImg};sImg.src=SPRITE_SRC;
for(const k in OPPONENT_SRCS){
  const img=new Image();
  img.onload=()=>{opponentSprites[k]={img,name:OPPONENT_SRCS[k].name}};
  img.src=OPPONENT_SRCS[k].src;
}

// ============ INPUT ============
C.addEventListener('mousemove',e=>{mouseX=e.clientX;mouseY=e.clientY});
C.addEventListener('mousedown',e=>{mouseDown=true;mouseClick=true;clickX=e.clientX;clickY=e.clientY;
  if(audioCtx.state==='suspended')audioCtx.resume()});
C.addEventListener('mouseup',()=>{mouseDown=false});
C.addEventListener('touchstart',e=>{
  e.preventDefault();const t0=e.touches[0];mouseX=t0.clientX;mouseY=t0.clientY;
  mouseClick=true;mouseDown=true;clickX=t0.clientX;clickY=t0.clientY;
  if(audioCtx.state==='suspended')audioCtx.resume()},{passive:false});
C.addEventListener('touchmove',e=>{e.preventDefault();const t0=e.touches[0];mouseX=t0.clientX;mouseY=t0.clientY},{passive:false});
C.addEventListener('touchend',e=>{e.preventDefault();mouseDown=false},{passive:false});
window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});

// ============ DRAWING HELPERS ============
function drawText(text,x,y,size,color,align='center',font=null){
  X.font=`${size}px ${font||"'Courier New', monospace"}`;
  X.fillStyle=color;X.textAlign=align;X.textBaseline='middle';
  X.fillText(text,x,y);
}
function drawTextShadow(text,x,y,size,color,align='center'){
  X.font=`${size}px 'Courier New', monospace`;X.textAlign=align;X.textBaseline='middle';
  X.fillStyle='rgba(0,0,0,0.6)';X.fillText(text,x+2,y+2);
  X.fillStyle=color;X.fillText(text,x,y);
}

function drawBrushText(text,x,y,size,color){
  // Simulate calligraphy feel with slight transforms
  X.save();X.translate(x,y);
  X.font=`bold ${size}px Georgia, 'Times New Roman', serif`;
  X.textAlign='center';X.textBaseline='middle';
  X.fillStyle='rgba(0,0,0,0.4)';X.fillText(text,2,2);
  X.fillStyle=color;X.fillText(text,0,0);
  X.restore();
}

function drawButton(text,x,y,w,h,hovered){
  const brd=hovered?GOLD:DARK_GOLD;
  X.fillStyle=hovered?'rgba(255,215,0,0.15)':'rgba(139,69,19,0.15)';
  X.strokeStyle=brd;X.lineWidth=hovered?2:1;
  X.beginPath();X.roundRect(x-w/2,y-h/2,w,h,4);X.fill();X.stroke();
  drawText(text,x,y,h*0.4,hovered?GOLD:WHITE);
  return mouseX>x-w/2&&mouseX<x+w/2&&mouseY>y-h/2&&mouseY<y+h/2;
}

function inRect(mx,my,x,y,w,h){return mx>x&&mx<x+w&&my>y&&my<y+h}

// ============ PARTICLE SYSTEM ============
function spawnParticles(x,y,color,count=10,speed=3){
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2,s=Math.random()*speed+1;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,color,size:Math.random()*3+1});
  }
}
function spawnInkSplash(x,y){
  for(let i=0;i<5;i++){
    const a=Math.random()*Math.PI*2,r=Math.random()*30+10;
    inkSplashes.push({x:x+Math.cos(a)*r*0.5,y:y+Math.sin(a)*r*0.5,r:Math.random()*8+4,life:1,
      color:`rgba(20,20,40,${Math.random()*0.5+0.3})`});
  }
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.life-=dt*2;
    if(p.life<=0)particles.splice(i,1);
  }
  for(let i=inkSplashes.length-1;i>=0;i--){
    inkSplashes[i].life-=dt*0.5;
    if(inkSplashes[i].life<=0)inkSplashes.splice(i,1);
  }
}
function drawParticles(){
  for(const p of particles){
    X.globalAlpha=p.life;X.fillStyle=p.color;
    X.beginPath();X.arc(p.x,p.y,p.size,0,Math.PI*2);X.fill();
  }
  for(const s of inkSplashes){
    X.globalAlpha=s.life*0.6;X.fillStyle=s.color;
    X.beginPath();X.arc(s.x,s.y,s.r,0,Math.PI*2);X.fill();
  }
  X.globalAlpha=1;
}

// ============ BODY FIGURE DRAWING ============
// Draw anatomically proportioned human figure
// cx,cy = center of figure, scale = height multiplier
function getBodyPoints(cx,cy,scale,pose='neutral',facing=1){
  const s=scale;
  // Base skeleton proportions (head at top)
  let head={x:cx,y:cy-s*0.42};
  let neck={x:cx,y:cy-s*0.34};
  let shoulderL={x:cx-s*0.16*facing,y:cy-s*0.30};
  let shoulderR={x:cx+s*0.16*facing,y:cy-s*0.30};
  let elbowL={x:cx-s*0.24*facing,y:cy-s*0.15};
  let elbowR={x:cx+s*0.24*facing,y:cy-s*0.15};
  let handL={x:cx-s*0.28*facing,y:cy-s*0.02};
  let handR={x:cx+s*0.28*facing,y:cy-s*0.02};
  let chest={x:cx,y:cy-s*0.22};
  let waist={x:cx,y:cy-s*0.05};
  let hipL={x:cx-s*0.08*facing,y:cy+s*0.02};
  let hipR={x:cx+s*0.08*facing,y:cy+s*0.02};
  let kneeL={x:cx-s*0.10*facing,y:cy+s*0.22};
  let kneeR={x:cx+s*0.10*facing,y:cy+s*0.22};
  let footL={x:cx-s*0.14*facing,y:cy+s*0.42};
  let footR={x:cx+s*0.14*facing,y:cy+s*0.42};

  // Apply pose modifications
  if(pose==='horse'){
    // Horse stance — wide legs, hands at waist
    kneeL.x=cx-s*0.18*facing;kneeR.x=cx+s*0.18*facing;
    footL.x=cx-s*0.22*facing;footR.x=cx+s*0.22*facing;
    kneeL.y=cy+s*0.25;kneeR.y=cy+s*0.25;
    elbowL.x=cx-s*0.22*facing;elbowR.x=cx+s*0.22*facing;
    elbowL.y=cy-s*0.18;elbowR.y=cy-s*0.18;
    handL.x=cx-s*0.18*facing;handR.x=cx+s*0.18*facing;
    handL.y=cy-s*0.08;handR.y=cy-s*0.08;
  }else if(pose==='crane'){
    // Crane stance — one leg up, arms spread like wings
    elbowL.x=cx-s*0.30*facing;elbowL.y=cy-s*0.28;
    elbowR.x=cx+s*0.30*facing;elbowR.y=cy-s*0.28;
    handL.x=cx-s*0.38*facing;handL.y=cy-s*0.25;
    handR.x=cx+s*0.38*facing;handR.y=cy-s*0.25;
    kneeR.x=cx+s*0.04*facing;kneeR.y=cy+s*0.12;
    footR.x=cx+s*0.06*facing;footR.y=cy+s*0.22;
  }else if(pose==='snake'){
    // Forward jab with two fingers
    elbowR.x=cx+s*0.20*facing;elbowR.y=cy-s*0.24;
    handR.x=cx+s*0.36*facing;handR.y=cy-s*0.28;
    elbowL.x=cx-s*0.16*facing;elbowL.y=cy-s*0.12;
    handL.x=cx-s*0.12*facing;handL.y=cy-s*0.06;
    footL.x=cx-s*0.18*facing;kneeR.x=cx+s*0.12*facing;
    footR.x=cx+s*0.08*facing;
  }else if(pose==='phoenix'){
    // Punch with protruding knuckle
    elbowR.x=cx+s*0.14*facing;elbowR.y=cy-s*0.22;
    handR.x=cx+s*0.34*facing;handR.y=cy-s*0.20;
    elbowL.x=cx-s*0.18*facing;elbowL.y=cy-s*0.14;
    handL.x=cx-s*0.14*facing;handL.y=cy-s*0.08;
  }else if(pose==='tiger'){
    // Rising palm strike
    elbowR.x=cx+s*0.12*facing;elbowR.y=cy-s*0.25;
    handR.x=cx+s*0.18*facing;handR.y=cy-s*0.36;
    elbowL.x=cx-s*0.18*facing;elbowL.y=cy-s*0.10;
    handL.x=cx-s*0.14*facing;handL.y=cy-s*0.04;
  }else if(pose==='knife'){
    // Lateral chop
    elbowR.x=cx+s*0.24*facing;elbowR.y=cy-s*0.28;
    handR.x=cx+s*0.36*facing;handR.y=cy-s*0.26;
    elbowL.x=cx-s*0.14*facing;elbowL.y=cy-s*0.16;
    handL.x=cx-s*0.10*facing;handL.y=cy-s*0.10;
  }else if(pose==='eagle'){
    // Claw grab
    elbowR.x=cx+s*0.18*facing;elbowR.y=cy-s*0.26;
    handR.x=cx+s*0.30*facing;handR.y=cy-s*0.30;
    elbowL.x=cx+s*0.10*facing;elbowL.y=cy-s*0.22;
    handL.x=cx+s*0.22*facing;handL.y=cy-s*0.24;
  }else if(pose==='dianxue'){
    // Single finger point
    elbowR.x=cx+s*0.16*facing;elbowR.y=cy-s*0.26;
    handR.x=cx+s*0.32*facing;handR.y=cy-s*0.30;
    elbowL.x=cx-s*0.16*facing;elbowL.y=cy-s*0.12;
    handL.x=cx-s*0.12*facing;handL.y=cy-s*0.06;
  }else if(pose==='death'){
    // Both arms extended to different points
    elbowR.x=cx+s*0.20*facing;elbowR.y=cy-s*0.24;
    handR.x=cx+s*0.30*facing;handR.y=cy-s*0.20;
    elbowL.x=cx+s*0.08*facing;elbowL.y=cy-s*0.18;
    handL.x=cx+s*0.22*facing;handL.y=cy-s*0.12;
    kneeL.x=cx-s*0.18*facing;kneeR.x=cx+s*0.18*facing;
    footL.x=cx-s*0.22*facing;footR.x=cx+s*0.22*facing;
  }else if(pose==='combat_idle'){
    elbowL.x=cx-s*0.20*facing;elbowL.y=cy-s*0.22;
    handL.x=cx-s*0.16*facing;handL.y=cy-s*0.28;
    elbowR.x=cx+s*0.14*facing;elbowR.y=cy-s*0.18;
    handR.x=cx+s*0.10*facing;handR.y=cy-s*0.12;
    kneeL.x=cx-s*0.12*facing;footL.x=cx-s*0.16*facing;
  }else if(pose==='combat_punch'){
    elbowR.x=cx+s*0.20*facing;elbowR.y=cy-s*0.22;
    handR.x=cx+s*0.38*facing;handR.y=cy-s*0.20;
    elbowL.x=cx-s*0.14*facing;elbowL.y=cy-s*0.16;
    handL.x=cx-s*0.10*facing;handL.y=cy-s*0.10;
  }else if(pose==='combat_kick'){
    kneeR.x=cx+s*0.16*facing;kneeR.y=cy+s*0.12;
    footR.x=cx+s*0.32*facing;footR.y=cy+s*0.14;
  }else if(pose==='stunned'){
    head.x=cx+s*0.04;elbowL.y=cy-s*0.08;elbowR.y=cy-s*0.08;
    handL.y=cy+s*0.02;handR.y=cy+s*0.02;
  }

  return {head,neck,shoulderL,shoulderR,elbowL,elbowR,handL,handR,chest,waist,hipL,hipR,kneeL,kneeR,footL,footR};
}

function drawFigure(cx,cy,scale,pose='neutral',color=CRIMSON,outlineColor=CRIMSON_LIGHT,facing=1,handType='fist'){
  const bp=getBodyPoints(cx,cy,scale,pose,facing);
  const lw=scale*0.018;

  X.strokeStyle=outlineColor;X.lineWidth=lw;X.lineCap='round';X.lineJoin='round';

  // Torso fill
  X.fillStyle=color;X.beginPath();
  X.moveTo(bp.shoulderL.x,bp.shoulderL.y);
  X.lineTo(bp.shoulderR.x,bp.shoulderR.y);
  X.lineTo(bp.hipR.x,bp.hipR.y);
  X.lineTo(bp.hipL.x,bp.hipL.y);
  X.closePath();X.fill();X.stroke();

  // Limbs
  const drawLimb=(a,b,c)=>{
    X.beginPath();X.moveTo(a.x,a.y);X.lineTo(b.x,b.y);X.lineTo(c.x,c.y);X.stroke();
  };
  drawLimb(bp.shoulderL,bp.elbowL,bp.handL);
  drawLimb(bp.shoulderR,bp.elbowR,bp.handR);
  drawLimb(bp.hipL,bp.kneeL,bp.footL);
  drawLimb(bp.hipR,bp.kneeR,bp.footR);

  // Joints
  const jr=lw*1.5;
  X.fillStyle=outlineColor;
  [bp.shoulderL,bp.shoulderR,bp.elbowL,bp.elbowR,bp.hipL,bp.hipR,bp.kneeL,bp.kneeR].forEach(j=>{
    X.beginPath();X.arc(j.x,j.y,jr,0,Math.PI*2);X.fill();
  });

  // Head
  const hr=scale*0.065;
  X.fillStyle=color;X.beginPath();X.arc(bp.head.x,bp.head.y,hr,0,Math.PI*2);X.fill();
  X.strokeStyle=outlineColor;X.stroke();
  // Neck
  X.beginPath();X.moveTo(bp.head.x,bp.head.y+hr);X.lineTo(bp.neck.x,bp.neck.y);X.stroke();

  // Hand formations
  drawHand(bp.handR.x,bp.handR.y,scale*0.03,handType,facing,outlineColor);
  drawHand(bp.handL.x,bp.handL.y,scale*0.03,handType==='crane'?'crane':'fist',-facing,outlineColor);

  // Feet
  X.fillStyle=outlineColor;
  [bp.footL,bp.footR].forEach(f=>{
    X.beginPath();X.ellipse(f.x+facing*scale*0.02,f.y,scale*0.035,scale*0.015,0,0,Math.PI*2);X.fill();
  });

  return bp;
}

function drawHand(x,y,size,type,facing,color){
  X.strokeStyle=color;X.fillStyle=color;X.lineWidth=size*0.4;
  if(type==='crane'){
    // Pinched fingers pointing down
    X.beginPath();X.moveTo(x,y);X.lineTo(x+facing*size*1.2,y+size*1.5);X.stroke();
    X.beginPath();X.arc(x+facing*size*1.2,y+size*1.5,size*0.4,0,Math.PI*2);X.fill();
  }else if(type==='spear'){
    // Two fingers extended
    X.beginPath();X.moveTo(x,y);X.lineTo(x+facing*size*2,y-size*0.3);X.stroke();
    X.beginPath();X.moveTo(x,y);X.lineTo(x+facing*size*2,y+size*0.3);X.stroke();
  }else if(type==='phoenixeye'){
    // Fist with protruding knuckle
    X.beginPath();X.arc(x,y,size*0.8,0,Math.PI*2);X.fill();
    X.beginPath();X.moveTo(x+facing*size*0.8,y);X.lineTo(x+facing*size*1.8,y);X.stroke();
    X.beginPath();X.arc(x+facing*size*1.8,y,size*0.3,0,Math.PI*2);X.fill();
  }else if(type==='palm'){
    // Open palm
    X.beginPath();X.ellipse(x+facing*size*0.4,y,size*0.9,size*1.2,facing*0.2,0,Math.PI*2);X.stroke();
    for(let i=-2;i<=1;i++){
      X.beginPath();X.moveTo(x+facing*size*0.6,y+i*size*0.4);
      X.lineTo(x+facing*size*1.4,y+i*size*0.5-size*0.4);X.stroke();
    }
  }else if(type==='blade'){
    // Flat hand edge
    X.beginPath();X.moveTo(x,y-size*0.8);X.lineTo(x+facing*size*1.8,y-size*0.2);
    X.lineTo(x+facing*size*1.8,y+size*0.2);X.lineTo(x,y+size*0.8);X.closePath();X.stroke();
  }else if(type==='claw'){
    // Hooked fingers
    X.beginPath();X.arc(x,y,size*0.6,0,Math.PI*2);X.fill();
    for(let i=-2;i<=2;i++){
      X.beginPath();X.moveTo(x+facing*size*0.5,y+i*size*0.35);
      X.quadraticCurveTo(x+facing*size*1.6,y+i*size*0.3,x+facing*size*1.2,y+i*size*0.5+size*0.3);X.stroke();
    }
  }else if(type==='finger'){
    // Single pointed finger
    X.beginPath();X.arc(x,y,size*0.6,0,Math.PI*2);X.fill();
    X.beginPath();X.moveTo(x+facing*size*0.6,y);X.lineTo(x+facing*size*2.2,y);X.stroke();
    X.beginPath();X.arc(x+facing*size*2.2,y,size*0.25,0,Math.PI*2);X.fill();
  }else{
    // Default fist
    X.beginPath();X.arc(x,y,size*0.9,0,Math.PI*2);X.fill();
  }
}

// ============ PRESSURE POINT OVERLAY ON FIGURE ============
function getPPPosition(ppId,cx,cy,scale){
  const pp=PRESSURE_POINTS.find(p=>p.id===ppId);
  if(!pp)return null;
  return{x:cx+pp.x*scale,y:cy+pp.y*scale,pp};
}

function drawPressurePointsOnFigure(cx,cy,scale,highlightIds=[],dimAll=false){
  // Draw meridian lines first
  X.strokeStyle='rgba(255,215,0,0.08)';X.lineWidth=1;X.setLineDash([4,6]);
  for(const line of MERIDIAN_LINES){
    X.beginPath();let started=false;
    for(const id of line){
      const pos=getPPPosition(id,cx,cy,scale);
      if(pos){if(!started){X.moveTo(pos.x,pos.y);started=true}else X.lineTo(pos.x,pos.y)}
    }
    X.stroke();
  }
  X.setLineDash([]);

  // Draw points
  const glow=Math.sin(t*3)*0.3+0.7;
  for(const pp of PRESSURE_POINTS){
    const px=cx+pp.x*scale,py=cy+pp.y*scale;
    const isHighlighted=highlightIds.includes(pp.id);
    const r=scale*0.018;

    if(isHighlighted){
      // Pulsing bright gold
      X.shadowColor=GOLD;X.shadowBlur=15*glow;
      X.fillStyle=`rgba(255,215,0,${0.6+glow*0.4})`;
      X.beginPath();X.arc(px,py,r*1.5,0,Math.PI*2);X.fill();
      X.shadowBlur=0;
      // Outer ring
      X.strokeStyle=GOLD;X.lineWidth=1.5;
      X.beginPath();X.arc(px,py,r*2.5*glow,0,Math.PI*2);X.stroke();
    }else{
      // Dim gold dot
      X.fillStyle=dimAll?'rgba(255,215,0,0.1)':`rgba(255,215,0,${0.25+Math.sin(t*2+pp.x*10)*0.05})`;
      X.beginPath();X.arc(px,py,r,0,Math.PI*2);X.fill();
    }
  }
}

function getPPAtClick(cx,cy,scale,mx,my,filterIds=null){
  let closest=null,closestDist=Infinity;
  const pts=filterIds?PRESSURE_POINTS.filter(p=>filterIds.includes(p.id)):PRESSURE_POINTS;
  for(const pp of pts){
    const px=cx+pp.x*scale,py=cy+pp.y*scale;
    const d=Math.hypot(mx-px,my-py);
    const hitR=scale*0.04;
    if(d<hitR&&d<closestDist){closest=pp;closestDist=d}
  }
  return closest;
}

// ============ PARCHMENT / BACKGROUND ============
function drawBackground(){
  X.fillStyle=BG;X.fillRect(0,0,W,H);
  // Subtle parchment texture
  for(let i=0;i<20;i++){
    X.fillStyle=PARCHMENT;
    X.fillRect(Math.random()*W,Math.random()*H,Math.random()*200+50,Math.random()*2+0.5);
  }
  // Vignette
  const g=X.createRadialGradient(W/2,H/2,W*0.2,W/2,H/2,W*0.7);
  g.addColorStop(0,'transparent');g.addColorStop(1,'rgba(0,0,0,0.4)');
  X.fillStyle=g;X.fillRect(0,0,W,H);
}

function drawDojoFloor(){
  X.fillStyle='rgba(40,20,10,0.3)';
  X.fillRect(0,FLOOR_Y,W,H-FLOOR_Y);
  X.strokeStyle='rgba(139,69,19,0.2)';X.lineWidth=1;
  X.beginPath();X.moveTo(0,FLOOR_Y);X.lineTo(W,FLOOR_Y);X.stroke();
}

// ============ TITLE SCREEN ============
function updateTitle(){
  drawBackground();

  // Title
  drawBrushText('DIM MAK',W/2,H*0.18,Math.min(W*0.08,60),GOLD);
  drawBrushText('點 穴',W/2,H*0.27,Math.min(W*0.1,72),'rgba(255,215,0,0.7)');
  drawText('The Art of the Death Touch',W/2,H*0.34,Math.min(W*0.025,18),WHITE);

  // Figure silhouette
  const figScale=Math.min(H*0.28,180);
  drawFigure(W/2,H*0.56,figScale,'crane',CRIMSON,CRIMSON_LIGHT,1,'crane');
  drawPressurePointsOnFigure(W/2,H*0.56,figScale);

  // Buttons
  const btnW=Math.min(W*0.35,280),btnH=50,btnX=W/2,btnGap=62;
  const btns=[
    {label:'TRAINING — Learn the 8 Techniques',mode:'training'},
    {label:'SPEED STRIKE — Timed Pressure Points',mode:'speed'},
    {label:'COMBAT — Pressure Point Fighting',mode:'combat'},
    {label:'RECORDS',mode:'stats'},
  ];

  for(let i=0;i<btns.length;i++){
    const by=H*0.76+i*btnGap;
    const hov=drawButton(btns[i].label,btnX,by,btnW,btnH,
      inRect(mouseX,mouseY,btnX-btnW/2,by-btnH/2,btnW,btnH));
    if(mouseClick&&hov){
      selectSound();
      gameState=btns[i].mode;
      if(gameState==='training')initTraining();
      if(gameState==='speed')initSpeed();
      if(gameState==='combat')initCombat();
    }
  }
}

// ============ TRAINING MODE ============
function initTraining(){trainIdx=0;trainStep='show';trainClickTarget=0;trainAnimTimer=0;trainCorrectFlash=0}

function updateTraining(){
  drawBackground();drawDojoFloor();
  const tech=TECHNIQUES[trainIdx];
  const figScale=Math.min(H*0.45,300);
  const figX=W*0.35,figY=H*0.52;

  // Info panel on right
  const panelX=W*0.65,panelW=W*0.30;
  X.fillStyle='rgba(10,8,16,0.7)';X.strokeStyle='rgba(255,215,0,0.2)';X.lineWidth=1;
  X.beginPath();X.roundRect(panelX-panelW/2,H*0.08,panelW,H*0.84,6);X.fill();X.stroke();

  drawBrushText(tech.nameCN,panelX,H*0.15,Math.min(panelW*0.2,36),GOLD);
  drawText(tech.pinyinName,panelX,H*0.21,Math.min(panelW*0.08,16),WHITE);
  drawText(tech.nameEN,panelX,H*0.26,Math.min(panelW*0.09,18),GOLD);

  // Technique details (wrapped)
  X.font=`${Math.min(panelW*0.06,13)}px 'Courier New', monospace`;X.textAlign='left';
  const detailX=panelX-panelW/2+15;
  let dy=H*0.33;
  const lineH=Math.min(panelW*0.07,16);

  X.fillStyle='rgba(255,215,0,0.6)';X.fillText('HAND:',detailX,dy);dy+=lineH;
  X.fillStyle=WHITE;wrapText(tech.hand,detailX,dy,panelW-30,lineH);dy+=lineH*2.5;

  X.fillStyle='rgba(255,215,0,0.6)';X.fillText('STANCE:',detailX,dy);dy+=lineH;
  X.fillStyle=WHITE;wrapText(tech.stance,detailX,dy,panelW-30,lineH);dy+=lineH*2.5;

  X.fillStyle='rgba(255,215,0,0.6)';X.fillText('EFFECT:',detailX,dy);dy+=lineH;
  X.fillStyle=WHITE;wrapText(tech.effect,detailX,dy,panelW-30,lineH);dy+=lineH*3;

  X.fillStyle='rgba(255,215,0,0.6)';X.fillText('DESCRIPTION:',detailX,dy);dy+=lineH;
  X.fillStyle='rgba(240,230,211,0.8)';wrapText(tech.description,detailX,dy,panelW-30,lineH);

  // Target info
  if(tech.targets.length>0){
    dy+=lineH*4;
    X.fillStyle='rgba(255,215,0,0.6)';X.textAlign='left';
    X.fillText('TARGETS:',detailX,dy);dy+=lineH;
    for(const tid of tech.targets){
      const pp=PRESSURE_POINTS.find(p=>p.id===tid);
      if(pp){X.fillStyle=GOLD;X.fillText('► '+pp.label,detailX+10,dy);dy+=lineH}
    }
  }

  // Draw figure with pose based on training step
  const poseMap=['horse','crane','snake','phoenix','tiger','knife','eagle','dianxue','death'];
  const handMap=['crane','crane','spear','phoenixeye','palm','blade','claw','finger','fist'];

  if(trainStep==='show'){
    // Show the technique pose
    drawFigure(figX,figY,figScale,trainIdx===0?'crane':poseMap[trainIdx],
      CRIMSON,CRIMSON_LIGHT,1,handMap[trainIdx]);
    drawPressurePointsOnFigure(figX,figY,figScale,tech.targets);

    // Instruction
    if(tech.targets.length>0){
      drawText('Click the highlighted pressure point'+(tech.targets.length>1?'s':''),
        figX,H*0.06,16,'rgba(255,215,0,0.8)');
      drawText(`(${trainClickTarget+1}/${tech.targets.length})`,figX,H*0.09,14,WHITE);
    }else{
      drawText('Observe the stance — click anywhere to continue',figX,H*0.06,16,'rgba(255,215,0,0.8)');
    }

    // Handle clicks
    if(mouseClick){
      if(tech.targets.length===0){
        // Crane guard — just advance
        trainStep='done';trainAnimTimer=1.5;hitSound();
        spawnParticles(figX,figY,GOLD,15,4);
      }else{
        const targetId=tech.targets[trainClickTarget];
        const clicked=getPPAtClick(figX,figY,figScale,clickX,clickY);
        if(clicked){
          if(clicked.id===targetId){
            // Correct!
            hitSound();comboSound(trainClickTarget+3);
            const pos=getPPPosition(targetId,figX,figY,figScale);
            spawnParticles(pos.x,pos.y,GREEN,12,3);
            spawnInkSplash(pos.x,pos.y);
            trainCorrectFlash=0.5;
            trainClickTarget++;
            if(trainClickTarget>=tech.targets.length){
              trainStep='done';trainAnimTimer=2.0;
              spawnParticles(figX,figY,GOLD,20,5);
            }
          }else{
            // Wrong
            missSound();
            const pos=getPPPosition(clicked.id,figX,figY,figScale);
            spawnParticles(pos.x,pos.y,RED,8,2);
            trainCorrectFlash=-0.5; // negative = red flash
          }
        }
      }
    }
  }else if(trainStep==='done'){
    // Show completion animation
    trainAnimTimer-=1/60;
    const anim=Math.max(0,1-trainAnimTimer/2);
    drawFigure(figX,figY,figScale,poseMap[trainIdx],CRIMSON,CRIMSON_LIGHT,1,handMap[trainIdx]);
    drawPressurePointsOnFigure(figX,figY,figScale,tech.targets);

    // Attack trajectory lines for techniques with targets
    if(tech.targets.length>0&&anim<1){
      const bp=getBodyPoints(figX,figY,figScale,poseMap[trainIdx],1);
      for(const tid of tech.targets){
        const pos=getPPPosition(tid,figX,figY,figScale);
        if(pos){
          X.strokeStyle=`rgba(255,215,0,${1-anim})`;X.lineWidth=2;X.setLineDash([4,4]);
          X.beginPath();X.moveTo(bp.handR.x,bp.handR.y);X.lineTo(pos.x,pos.y);X.stroke();
          X.setLineDash([]);
        }
      }
    }

    // Green check
    drawBrushText('✓ '+tech.nameEN,figX,H*0.06,20,GREEN);

    if(trainAnimTimer<=0){
      if(trainIdx<TECHNIQUES.length-1){
        trainIdx++;trainStep='show';trainClickTarget=0;
      }else{
        stats.trainCompleted++;saveStats();
        drawBrushText('TRAINING COMPLETE',figX,H*0.12,24,GOLD);
      }
    }
  }

  // Correct/wrong flash
  if(trainCorrectFlash>0){
    X.fillStyle=`rgba(0,255,136,${trainCorrectFlash*0.15})`;X.fillRect(0,0,W,H);
    trainCorrectFlash-=1/60*2;
  }else if(trainCorrectFlash<0){
    X.fillStyle=`rgba(255,50,50,${-trainCorrectFlash*0.15})`;X.fillRect(0,0,W,H);
    trainCorrectFlash+=1/60*2;
  }

  // Progress bar
  const progW=W*0.3,progH=8,progX=W*0.05,progY=H*0.95;
  X.fillStyle='rgba(255,255,255,0.1)';X.fillRect(progX,progY,progW,progH);
  X.fillStyle=GOLD;X.fillRect(progX,progY,progW*(trainIdx/TECHNIQUES.length),progH);
  drawText(`${trainIdx+1}/${TECHNIQUES.length}`,progX+progW+40,progY+4,12,WHITE);

  // Back button
  drawBackButton();
  drawParticles();
}

function wrapText(text,x,y,maxW,lineH){
  const words=text.split(' ');let line='';let cy=y;
  for(const word of words){
    const test=line+word+' ';
    if(X.measureText(test).width>maxW&&line!==''){
      X.fillText(line,x,cy);cy+=lineH;line=word+' ';
    }else line=test;
  }
  X.fillText(line,x,cy);
}

// ============ SPEED STRIKE MODE ============
function initSpeed(){
  speedScore=0;speedCombo=0;speedBestCombo=0;speedMisses=0;
  speedGameOver=false;speedTimeLimit=2.0;speedPointsHit=0;
  speedTechnique=null;speedStartTime=Date.now();
  nextSpeedPoint();
}

function nextSpeedPoint(){
  // Every 5 hits, call out a technique
  if(speedPointsHit>0&&speedPointsHit%5===0){
    const techsWithTargets=TECHNIQUES.filter(t=>t.targets.length>0);
    speedTechnique=techsWithTargets[Math.floor(Math.random()*techsWithTargets.length)];
    const targetId=speedTechnique.targets[Math.floor(Math.random()*speedTechnique.targets.length)];
    speedActivePoint=PRESSURE_POINTS.find(p=>p.id===targetId);
  }else{
    speedTechnique=null;
    speedActivePoint=PRESSURE_POINTS[Math.floor(Math.random()*PRESSURE_POINTS.length)];
  }
  speedTimer=speedTimeLimit;
}

function updateSpeed(){
  drawBackground();drawDojoFloor();

  const figScale=Math.min(H*0.5,320);
  const figX=W/2,figY=H*0.50;

  if(speedGameOver){
    drawFigure(figX,figY,figScale,'neutral',CRIMSON,'rgba(139,26,26,0.5)');
    drawBrushText('GAME OVER',W/2,H*0.12,40,RED);
    drawText(`Score: ${speedScore}`,W/2,H*0.20,24,GOLD);
    drawText(`Best Combo: ${speedBestCombo}x`,W/2,H*0.26,18,WHITE);
    drawText(`Points Hit: ${speedPointsHit}`,W/2,H*0.31,16,WHITE);

    const elapsed=((speedStartTime?Date.now()-speedStartTime:0)/1000).toFixed(1);
    drawText(`Time: ${elapsed}s`,W/2,H*0.35,16,WHITE);

    const retryHov=drawButton('RETRY',W/2,H*0.88,180,44,
      inRect(mouseX,mouseY,W/2-90,H*0.88-22,180,44));
    if(mouseClick&&retryHov){selectSound();initSpeed()}

    drawBackButton();drawParticles();return;
  }

  // Update timer
  speedTimer-=1/60;
  if(speedTimer<=0){
    speedMisses++;speedCombo=0;
    missSound();
    if(speedMisses>=3){
      speedGameOver=true;
      if(speedScore>stats.speedBest){stats.speedBest=speedScore;saveStats()}
      koSound();return;
    }
    nextSpeedPoint();
  }

  // Draw figure
  drawFigure(figX,figY,figScale,'neutral',CRIMSON,CRIMSON_LIGHT);

  // Draw all points dimly
  drawPressurePointsOnFigure(figX,figY,figScale,
    speedActivePoint?[speedActivePoint.id]:[],false);

  // Technique callout
  if(speedTechnique){
    const pp=speedActivePoint;
    drawBrushText(speedTechnique.nameEN.toUpperCase(),W/2,H*0.06,22,GOLD);
    drawText(`— ${pp.name.toUpperCase()}!`,W/2,H*0.10,18,RED);
  }

  // Timer bar
  const timerPct=speedTimer/speedTimeLimit;
  const barW=W*0.4,barH=8,barX=W/2-barW/2,barY=H*0.04;
  X.fillStyle='rgba(255,255,255,0.1)';X.fillRect(barX,barY,barW,barH);
  X.fillStyle=timerPct>0.3?GOLD:RED;X.fillRect(barX,barY,barW*timerPct,barH);

  // HUD
  drawText(`Score: ${speedScore}`,W*0.08,H*0.04,18,GOLD,'left');
  drawText(`Combo: ${speedCombo}x`,W*0.92,H*0.04,18,speedCombo>3?GOLD:WHITE,'right');

  // Miss indicators
  for(let i=0;i<3;i++){
    X.fillStyle=i<speedMisses?RED:'rgba(255,50,50,0.2)';
    X.beginPath();X.arc(W*0.08+i*20,H*0.08,6,0,Math.PI*2);X.fill();
  }

  // Handle click
  if(mouseClick){
    const clicked=getPPAtClick(figX,figY,figScale,clickX,clickY);
    if(clicked&&speedActivePoint&&clicked.id===speedActivePoint.id){
      // Hit!
      const pos=getPPPosition(clicked.id,figX,figY,figScale);
      hitSound();
      speedCombo++;speedPointsHit++;
      if(speedCombo>speedBestCombo)speedBestCombo=speedCombo;
      comboSound(speedCombo);

      // Score: faster = more points, combo multiplier
      const timeBonus=Math.floor(speedTimer/speedTimeLimit*100);
      const comboMult=Math.min(speedCombo,10);
      speedScore+=10*comboMult+timeBonus;
      stats.totalPPHits++;saveStats();

      spawnParticles(pos.x,pos.y,GREEN,15,4);
      spawnInkSplash(pos.x,pos.y);

      // Speed up gradually
      speedTimeLimit=Math.max(0.5,2.0-speedPointsHit*0.05);
      nextSpeedPoint();
    }else if(clicked){
      // Wrong point
      missSound();speedCombo=0;speedMisses++;
      const pos=getPPPosition(clicked.id,figX,figY,figScale);
      spawnParticles(pos.x,pos.y,RED,10,3);
      if(speedMisses>=3){
        speedGameOver=true;
        if(speedScore>stats.speedBest){stats.speedBest=speedScore;saveStats()}
        koSound();
      }
    }
  }

  drawBackButton();drawParticles();
}

// ============ COMBAT MODE ============
function initCombat(){
  combatRound=1;combatPlayerWins=0;combatEnemyWins=0;
  combatState='fight';combatTimer=60;combatChiMeter=0;
  combatHitParticles=[];combatEffects=[];
  combatPressurePoints=[];combatPPTimer=0;

  combatPlayer={
    x:W*0.25,y:0,vy:0,hp:100,maxHp:100,facing:1,
    state:'idle',stateTimer:0,attackCooldown:0,
    speed:4,damage:8,defense:0,
    stunTimer:0,noSpecialTimer:0,damageMult:1,damageReduction:1,slowTimer:0,
    combo:0,pose:'combat_idle',chi:0
  };
  combatEnemy={
    x:W*0.75,y:0,vy:0,hp:100,maxHp:100,facing:-1,
    state:'idle',stateTimer:0,attackCooldown:0,
    speed:2.5,damage:6,defense:0,
    stunTimer:0,noSpecialTimer:0,damageMult:1,damageReduction:1,slowTimer:0,
    combo:0,pose:'combat_idle',aiTimer:0,chi:0,
    name:'SHADOW FIGHTER'
  };

  // Spawn initial pressure points on enemy
  spawnCombatPP();
}

function spawnCombatPP(){
  combatPressurePoints=[];
  // Show 2-3 random pressure points on the enemy
  const available=[...PRESSURE_POINTS];
  const count=2+Math.floor(Math.random()*2);
  for(let i=0;i<count;i++){
    const idx=Math.floor(Math.random()*available.length);
    const pp=available.splice(idx,1)[0];
    combatPressurePoints.push({...pp,timer:3+Math.random()*2,hit:false});
  }
  combatPPTimer=5+Math.random()*3; // Time until next spawn
}

function updateCombat(){
  drawBackground();drawDojoFloor();
  const dt=1/60;
  const p=combatPlayer,e=combatEnemy;
  const grav=0.6;

  if(combatState==='fight'){
    combatTimer-=dt;
    if(combatTimer<=0){endCombatRound()}

    // === PLAYER MOVEMENT ===
    const pSpeed=p.slowTimer>0?p.speed*0.5:p.speed;
    if(p.stunTimer<=0){
      if(keys['a']||keys['arrowleft'])p.x-=pSpeed;
      if(keys['d']||keys['arrowright'])p.x+=pSpeed;
      if((keys['w']||keys['arrowup']||keys[' '])&&p.y>=FLOOR_Y){p.vy=-13}
      p.facing=e.x>p.x?1:-1;
    }

    // Gravity
    p.vy+=grav;p.y+=p.vy;
    if(p.y>=FLOOR_Y){p.y=FLOOR_Y;p.vy=0}
    p.x=Math.max(40,Math.min(W-40,p.x));

    // Timers
    p.stunTimer=Math.max(0,p.stunTimer-dt);
    p.noSpecialTimer=Math.max(0,p.noSpecialTimer-dt);
    p.slowTimer=Math.max(0,p.slowTimer-dt);
    p.attackCooldown=Math.max(0,p.attackCooldown-dt);
    if(p.stateTimer>0){p.stateTimer-=dt;if(p.stateTimer<=0)p.state='idle'}

    // Player attack
    if(p.stunTimer<=0&&p.attackCooldown<=0){
      // J = punch, K = kick, L = special (chi attack)
      if(keys['j']){
        p.state='punch';p.stateTimer=0.3;p.attackCooldown=0.4;p.pose='combat_punch';
        tryHit(p,e,p.damage,0.38);
      }else if(keys['k']){
        p.state='kick';p.stateTimer=0.35;p.attackCooldown=0.5;p.pose='combat_kick';
        tryHit(p,e,p.damage*1.2,0.42);
      }else if(keys['l']&&combatChiMeter>=30&&p.noSpecialTimer<=0){
        // Chi strike — check for pressure point hits
        p.state='special';p.stateTimer=0.5;p.attackCooldown=0.6;p.pose='dianxue';
        combatChiMeter-=30;
        tryHit(p,e,p.damage*1.5,0.45);
      }
    }
    if(p.state==='idle')p.pose='combat_idle';

    // === ENEMY AI ===
    e.stunTimer=Math.max(0,e.stunTimer-dt);
    e.noSpecialTimer=Math.max(0,e.noSpecialTimer-dt);
    e.slowTimer=Math.max(0,e.slowTimer-dt);
    e.attackCooldown=Math.max(0,e.attackCooldown-dt);
    if(e.stateTimer>0){e.stateTimer-=dt;if(e.stateTimer<=0)e.state='idle'}

    if(e.stunTimer<=0){
      e.aiTimer-=dt;
      const dist=Math.abs(p.x-e.x);
      const eSpeed=e.slowTimer>0?e.speed*0.5:e.speed;

      if(e.aiTimer<=0){
        e.aiTimer=0.3+Math.random()*0.5;
        if(dist>120){
          // Move toward player
          e.x+=eSpeed*3*(p.x>e.x?1:-1);
        }else if(dist<60){
          // Back up sometimes
          if(Math.random()<0.3)e.x+=eSpeed*2*(p.x>e.x?-1:1);
        }

        if(dist<130&&e.attackCooldown<=0&&Math.random()<0.6){
          e.state=Math.random()<0.6?'punch':'kick';
          e.stateTimer=0.35;e.attackCooldown=0.6+Math.random()*0.4;
          e.pose=e.state==='punch'?'combat_punch':'combat_kick';
          tryHit(e,p,e.damage*(e.state==='kick'?1.2:1)*e.damageMult,0.38);
        }
      }
      e.facing=p.x>e.x?1:-1;
      // Slowly approach
      if(dist>100)e.x+=eSpeed*0.5*(p.x>e.x?1:-1);
    }else{
      e.pose='stunned';
    }
    if(e.state==='idle'&&e.stunTimer<=0)e.pose='combat_idle';
    e.x=Math.max(40,Math.min(W-40,e.x));

    // === PRESSURE POINT MANAGEMENT ===
    combatPPTimer-=dt;
    if(combatPPTimer<=0)spawnCombatPP();
    for(let i=combatPressurePoints.length-1;i>=0;i--){
      combatPressurePoints[i].timer-=dt;
      if(combatPressurePoints[i].timer<=0)combatPressurePoints.splice(i,1);
    }

    // === EFFECTS ===
    for(let i=combatEffects.length-1;i>=0;i--){
      combatEffects[i].timer-=dt;
      if(combatEffects[i].timer<=0)combatEffects.splice(i,1);
    }

    // Reset damage mults each frame then reapply from effects
    e.damageMult=1;e.damageReduction=1;
    for(const eff of combatEffects){
      if(eff.target==='enemy'){
        if(eff.type==='damageTaken')e.damageMult=1.5;
        if(eff.type==='damageReduction')e.damageReduction=0.5;
      }
    }

    // Chi regen
    combatChiMeter=Math.min(100,combatChiMeter+dt*3);

    // Check HP
    if(p.hp<=0){combatEnemyWins++;endCombatRound()}
    if(e.hp<=0){combatPlayerWins++;endCombatRound()}
  }

  // === DRAW COMBAT ===
  const figScale=Math.min(H*0.35,220);

  // Draw enemy
  const eFigY=FLOOR_Y;
  drawFigure(e.x,eFigY,figScale,e.pose,'#4a1a1a','#6a2a2a',e.facing,'fist');

  // Draw pressure points on enemy
  if(combatState==='fight'){
    const glow=Math.sin(t*4)*0.3+0.7;
    for(const cpp of combatPressurePoints){
      if(cpp.hit)continue;
      const px=e.x+cpp.x*figScale*e.facing,py=eFigY+cpp.y*figScale;
      const fadeAlpha=cpp.timer<1?cpp.timer:1;
      X.shadowColor=GOLD;X.shadowBlur=10*glow;
      X.fillStyle=`rgba(255,215,0,${fadeAlpha*(0.5+glow*0.3)})`;
      X.beginPath();X.arc(px,py,figScale*0.025,0,Math.PI*2);X.fill();
      X.shadowBlur=0;
      // Label
      if(cpp.timer>1){
        drawText(cpp.name,px,py-figScale*0.05,10,`rgba(255,215,0,${fadeAlpha*0.7})`);
      }
    }
  }

  // Draw player
  const pFigY=FLOOR_Y;
  drawFigure(p.x,pFigY,figScale,p.pose,CRIMSON,CRIMSON_LIGHT,p.facing,
    p.state==='special'?'finger':'fist');

  // Stun indicator on enemy
  if(e.stunTimer>0){
    for(let i=0;i<3;i++){
      const sx=e.x+Math.cos(t*5+i*2.1)*20;
      const sy=eFigY-figScale*0.5+Math.sin(t*6+i*1.7)*5;
      drawText('★',sx,sy,14,'rgba(255,215,0,0.7)');
    }
  }

  // Effects text
  for(const eff of combatEffects){
    if(eff.target==='enemy'){
      const alpha=Math.min(1,eff.timer);
      drawText(eff.label,e.x,eFigY-figScale*0.55-10,12,`rgba(255,100,100,${alpha})`);
    }
  }

  // === HUD ===
  // Player HP
  const hpW=W*0.3,hpH=14,hpY=30;
  X.fillStyle='rgba(255,255,255,0.1)';X.fillRect(20,hpY,hpW,hpH);
  X.fillStyle=p.hp>30?GREEN:RED;X.fillRect(20,hpY,hpW*(Math.max(0,p.hp)/p.maxHp),hpH);
  X.strokeStyle='rgba(255,255,255,0.3)';X.lineWidth=1;X.strokeRect(20,hpY,hpW,hpH);
  drawText('PLAYER',20+hpW/2,hpY-10,12,WHITE);
  drawText(`${Math.max(0,Math.ceil(p.hp))}`,20+hpW/2,hpY+hpH/2,11,WHITE);

  // Enemy HP
  X.fillStyle='rgba(255,255,255,0.1)';X.fillRect(W-20-hpW,hpY,hpW,hpH);
  X.fillStyle=e.hp>30?'#ff6060':RED;X.fillRect(W-20-hpW,hpY,hpW*(Math.max(0,e.hp)/e.maxHp),hpH);
  X.strokeStyle='rgba(255,255,255,0.3)';X.strokeRect(W-20-hpW,hpY,hpW,hpH);
  drawText(e.name,W-20-hpW/2,hpY-10,12,WHITE);
  drawText(`${Math.max(0,Math.ceil(e.hp))}`,W-20-hpW/2,hpY+hpH/2,11,WHITE);

  // Chi meter
  const chiW=W*0.15,chiH=8,chiY=hpY+hpH+8;
  X.fillStyle='rgba(255,255,255,0.05)';X.fillRect(20,chiY,chiW,chiH);
  X.fillStyle='rgba(100,150,255,0.7)';X.fillRect(20,chiY,chiW*(combatChiMeter/100),chiH);
  X.strokeStyle='rgba(100,150,255,0.3)';X.strokeRect(20,chiY,chiW,chiH);
  drawText('CHI',20+chiW+30,chiY+4,10,'rgba(100,150,255,0.7)','left');

  // Round info
  drawText(`Round ${combatRound}/3`,W/2,20,16,GOLD);
  drawText(`${Math.max(0,Math.ceil(combatTimer))}`,W/2,38,14,combatTimer<10?RED:WHITE);

  // Score
  drawText(`${combatPlayerWins}`,W/2-40,56,20,GREEN);
  drawText('—',W/2,56,20,WHITE);
  drawText(`${combatEnemyWins}`,W/2+40,56,20,RED);

  // Controls hint
  drawText('WASD move · J punch · K kick · L chi strike (costs 30 chi)',W/2,H-20,11,'rgba(255,255,255,0.3)');
  drawText('Click glowing pressure points during attacks for bonus effects!',W/2,H-35,11,'rgba(255,215,0,0.3)');

  // Handle pressure point clicking in combat
  if(mouseClick&&combatState==='fight'){
    for(let i=combatPressurePoints.length-1;i>=0;i--){
      const cpp=combatPressurePoints[i];
      if(cpp.hit)continue;
      const px=e.x+cpp.x*figScale*e.facing,py=eFigY+cpp.y*figScale;
      const dist=Math.hypot(clickX-px,clickY-py);
      if(dist<figScale*0.05){
        // Pressure point hit!
        cpp.hit=true;
        hitSound();comboSound(5);bg.pulse(0.8);
        spawnParticles(px,py,GOLD,20,5);
        spawnInkSplash(px,py);
        stats.totalPPHits++;saveStats();
        combatChiMeter=Math.min(100,combatChiMeter+15);

        // Apply effect based on point type
        applyPPEffect(cpp,e);
        combatPressurePoints.splice(i,1);
        break;
      }
    }
  }

  // Round end screen
  if(combatState==='roundEnd'){
    combatRoundEndTimer-=dt;
    X.fillStyle='rgba(10,8,16,0.6)';X.fillRect(0,0,W,H);
    const winner=p.hp>e.hp?'PLAYER':'ENEMY';
    drawBrushText(`${winner} WINS ROUND ${combatRound-1}`,W/2,H*0.4,30,winner==='PLAYER'?GREEN:RED);
    drawText(`${combatPlayerWins} — ${combatEnemyWins}`,W/2,H*0.5,24,GOLD);
    if(combatRoundEndTimer<=0){
      if(combatPlayerWins>=2||combatEnemyWins>=2){
        combatState='gameEnd';
      }else{
        startNewRound();
      }
    }
  }

  if(combatState==='gameEnd'){
    X.fillStyle='rgba(10,8,16,0.7)';X.fillRect(0,0,W,H);
    const won=combatPlayerWins>=2;
    drawBrushText(won?'VICTORY':'DEFEAT',W/2,H*0.35,44,won?GOLD:RED);
    drawText(`Final Score: ${combatPlayerWins} — ${combatEnemyWins}`,W/2,H*0.45,22,WHITE);
    if(won){stats.combatWins++}else{stats.combatLosses++}
    saveStats();

    const retryHov=drawButton('FIGHT AGAIN',W/2,H*0.6,200,44,
      inRect(mouseX,mouseY,W/2-100,H*0.6-22,200,44));
    if(mouseClick&&retryHov){selectSound();initCombat()}
  }

  drawBackButton();drawParticles();
}

function tryHit(attacker,target,damage,range){
  const dist=Math.abs(attacker.x-target.x);
  const figScale=Math.min(H*0.35,220);
  if(dist<figScale*range){
    const actualDmg=damage*target.damageMult*target.damageReduction;
    target.hp-=actualDmg;
    const hitX=(attacker.x+target.x)/2;
    const hitY=FLOOR_Y-figScale*0.25;
    spawnParticles(hitX,hitY,attacker===combatPlayer?GOLD:RED,8,3);
    hitSound();
    if(attacker===combatPlayer){
      bg.pulse(0.4);
      combatChiMeter=Math.min(100,combatChiMeter+5);
    }else{
      bg.shake(0.3);
    }
  }
}

function applyPPEffect(pp,target){
  const eid=pp.id;
  if(eid==='taiyang'){
    // Temple = stun 2s
    target.stunTimer=2;
    combatEffects.push({target:'enemy',type:'stun',timer:2,label:'STUNNED — Temple Strike!'});
  }else if(eid==='CV22'){
    // Throat = no specials 3s
    target.noSpecialTimer=3;
    combatEffects.push({target:'enemy',type:'noSpecial',timer:3,label:'SILENCED — Throat Strike!'});
  }else if(eid==='CV12'){
    // Solar plexus = 1.5x damage taken 4s
    combatEffects.push({target:'enemy',type:'damageTaken',timer:4,label:'VULNERABLE — Solar Plexus!'});
  }else if(eid==='PC6'){
    // Wrist = damage halved 3s
    combatEffects.push({target:'enemy',type:'damageReduction',timer:3,label:'WEAKENED — Wrist Lock!'});
  }else if(eid==='ST36'||eid==='peroneal'){
    // Knee/peroneal = slowed 50% 3s
    target.slowTimer=3;
    combatEffects.push({target:'enemy',type:'slow',timer:3,label:'SLOWED — Leg Strike!'});
  }else if(eid==='HT1'){
    // Heart — check if solar plexus also hit recently for Death Touch
    const hasSolar=combatEffects.some(e=>e.type==='damageTaken'&&e.timer>0);
    if(hasSolar){
      // DEATH TOUCH — instant KO
      target.hp=0;koSound();bg.pulse(1.0);bg.shake(0.5);
      combatEffects.push({target:'enemy',type:'deathTouch',timer:3,label:'DEATH TOUCH — 雙擊!'});
      spawnParticles(target.x,FLOOR_Y-100,RED,40,8);
    }else{
      target.hp-=20;
      combatEffects.push({target:'enemy',type:'heartStrike',timer:2,label:'Heart Strike!'});
    }
  }else if(eid==='GV20'||eid==='GV16'||eid==='GV26'){
    target.stunTimer=1.5;target.hp-=10;
    combatEffects.push({target:'enemy',type:'stun',timer:1.5,label:'DAZED — Head Strike!'});
  }else if(eid==='GB21'){
    target.hp-=12;
    combatEffects.push({target:'enemy',type:'nerve',timer:2,label:'NERVE STRIKE — Trapezius!'});
  }else if(eid==='ribs'){
    target.hp-=15;
    combatEffects.push({target:'enemy',type:'bodyBlow',timer:2,label:'BODY BLOW — Floating Ribs!'});
  }else if(eid==='CV4'){
    target.slowTimer=2;target.hp-=8;
    combatEffects.push({target:'enemy',type:'slow',timer:2,label:'CORE DISRUPTION — Dantian!'});
  }else{
    target.hp-=10;
    combatEffects.push({target:'enemy',type:'generic',timer:2,label:'Pressure Point Hit!'});
  }
}

function endCombatRound(){
  combatState='roundEnd';combatRoundEndTimer=2.5;combatRound++;
}
function startNewRound(){
  combatState='fight';combatTimer=60;
  combatPlayer.hp=100;combatEnemy.hp=100;
  combatPlayer.x=W*0.25;combatEnemy.x=W*0.75;
  combatPlayer.stunTimer=0;combatEnemy.stunTimer=0;
  combatPlayer.state='idle';combatEnemy.state='idle';
  combatEffects=[];combatPressurePoints=[];
  combatChiMeter=50;spawnCombatPP();
}

// ============ STATS SCREEN ============
function updateStats(){
  drawBackground();
  drawBrushText('RECORDS',W/2,H*0.12,36,GOLD);
  drawBrushText('記錄',W/2,H*0.19,28,'rgba(255,215,0,0.5)');

  const entries=[
    ['Training Completed',stats.trainCompleted+'x'],
    ['Speed Strike Best',stats.speedBest+' pts'],
    ['Combat Wins',stats.combatWins+''],
    ['Combat Losses',stats.combatLosses+''],
    ['Total PP Hits',stats.totalPPHits+''],
    ['Win Rate',stats.combatWins+stats.combatLosses>0?
      Math.round(stats.combatWins/(stats.combatWins+stats.combatLosses)*100)+'%':'—'],
  ];

  const startY=H*0.32,lineH=36;
  for(let i=0;i<entries.length;i++){
    const y=startY+i*lineH;
    drawText(entries[i][0],W/2-20,y,16,WHITE,'right');
    drawText(entries[i][1],W/2+20,y,18,GOLD,'left');
  }

  // Reset button
  const resetHov=drawButton('RESET RECORDS',W/2,H*0.78,200,40,
    inRect(mouseX,mouseY,W/2-100,H*0.78-20,200,40));
  if(mouseClick&&resetHov){
    stats={trainCompleted:0,speedBest:0,combatWins:0,combatLosses:0,totalPPHits:0};
    saveStats();selectSound();
  }

  // Draw decorative figure
  const figScale=Math.min(H*0.18,100);
  drawFigure(W*0.15,H*0.65,figScale,'crane',CRIMSON,CRIMSON_LIGHT,1,'crane');
  drawFigure(W*0.85,H*0.65,figScale,'dianxue',CRIMSON,CRIMSON_LIGHT,-1,'finger');

  drawBackButton();
}

function drawBackButton(){
  const bx=50,by=H-30,bw=80,bh=30;
  const hov=drawButton('← BACK',bx,by,bw,bh,inRect(mouseX,mouseY,bx-bw/2,by-bh/2,bw,bh));
  if(mouseClick&&hov){selectSound();gameState='title'}
}

// ============ MAIN LOOP ============
function update(){
  bg.render(performance.now());
  t+=1/60;

  switch(gameState){
    case'title':updateTitle();break;
    case'training':updateTraining();break;
    case'speed':updateSpeed();break;
    case'combat':updateCombat();break;
    case'stats':updateStats();break;
  }

  updateParticles(1/60);
  mouseClick=false;
  requestAnimationFrame(update);
}

update();



// -- THE THRESHOLD CROSS-POLLINATION (pass 1) --
(function() {
  // Vignette
  var vig = document.createElement('div');
  vig.id = 'threshold-vignette';
  document.body.appendChild(vig);

  // World name
  var wn = document.createElement('div');
  wn.id = 'threshold-world-name';
  wn.textContent = 'THE BETWEEN';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.6879927300637337;
  setInterval(function() {
    hb.style.opacity = '0.06';
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.01475164577983177;mix-blend-mode:overlay';
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



// CHAIN FIX: SCREENSHOT
document.addEventListener("keydown",function(e){if((e.key==="s"||e.key==="S")&&!e.ctrlKey&&!e.metaKey&&!document.pointerLockElement){var c=document.querySelector("canvas");if(!c)return;var url=c.toDataURL("image/png");var a=document.createElement("a");a.href=url;a.download="gpt_"+Date.now()+".png";a.click();if(typeof _tone==="function")_tone(1200,.08,"sine",.05)}});



// CHAIN FIX: MUSIC LINK
setInterval(function(){try{if(parent.AUDIO_BASS!==undefined){window.AUDIO_BASS=parent.AUDIO_BASS;window.AUDIO_MID=parent.AUDIO_MID;window.AUDIO_HIGH=parent.AUDIO_HIGH;window.AUDIO_ENERGY=parent.AUDIO_ENERGY}}catch(e){}},33);
