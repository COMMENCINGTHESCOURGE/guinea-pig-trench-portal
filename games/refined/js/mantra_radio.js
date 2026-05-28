
var STATIONS=[
  {n:"GROOVE SALAD",url:"https://ice1.somafm.com/groovesalad-128-mp3",bpm:98},
  {n:"DRONE ZONE",url:"https://ice1.somafm.com/dronezone-128-mp3",bpm:55},
  {n:"BEAT BLENDER",url:"https://ice1.somafm.com/beatblender-128-mp3",bpm:118},
  {n:"SECRET AGENT",url:"https://ice1.somafm.com/secretagent-128-mp3",bpm:112},
  {n:"DEF CON",url:"https://ice1.somafm.com/defcon-128-mp3",bpm:138},
  {n:"LUSH",url:"https://ice1.somafm.com/lush-128-mp3",bpm:86}
];
var BLOBS=["b-logo","b-core","b-spectrum","b-stations","b-volume","b-meter"];
var EDGES=[["b-logo","b-core"],["b-logo","b-spectrum"],["b-core","b-spectrum"],["b-core","b-stations"],["b-core","b-volume"],["b-spectrum","b-meter"],["b-volume","b-meter"],["b-stations","b-meter"]];
var BLOB_COLOR={"b-logo":"#dce8ff","b-core":"#00e5cc","b-spectrum":"#b06cf7","b-stations":"#f0a500","b-volume":"#f0365e","b-meter":"#30e87a"};

function setPos(){var W=innerWidth,H=innerHeight,cx=W/2,cy=H/2;var p={"b-logo":{x:cx-67,y:cy-235},"b-core":{x:cx-93,y:cy-82},"b-spectrum":{x:cx+65,y:cy-138},"b-stations":{x:cx-268,y:cy+18},"b-volume":{x:cx+135,y:cy+42},"b-meter":{x:cx-68,y:cy+128}};BLOBS.forEach(function(id){var e=document.getElementById(id);e.style.left=p[id].x+"px";e.style.top=p[id].y+"px"})}
setPos();

var dragging=null,dox=0,doy=0;
BLOBS.forEach(function(id){document.getElementById(id).addEventListener("mousedown",function(e){if(e.button!==0)return;dragging=this;var r=this.getBoundingClientRect();dox=e.clientX-r.left;doy=e.clientY-r.top;this.style.zIndex=99;e.preventDefault()})});
document.addEventListener("mousemove",function(e){if(!dragging)return;dragging.style.left=(e.clientX-dox)+"px";dragging.style.top=(e.clientY-doy)+"px";drawTendrils()});
document.addEventListener("mouseup",function(){if(dragging){dragging.style.zIndex=10;dragging=null}});

var svgEl=document.getElementById("tendrils");
function blobCenter(id){var r=document.getElementById(id).getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}}
function drawTendrils(){while(svgEl.children.length>1)svgEl.removeChild(svgEl.lastChild);EDGES.forEach(function(e){var ca=blobCenter(e[0]),cb=blobCenter(e[1]);var dx=cb.x-ca.x,dy=cb.y-ca.y,dist=Math.hypot(dx,dy);if(dist<5)return;var w=dist*.22,mx=(ca.x+cb.x)/2,my=(ca.y+cb.y)/2,nx=-dy/dist*w,ny=dx/dist*w;var path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d","M"+ca.x+" "+ca.y+" Q"+(mx+nx)+" "+(my+ny)+" "+cb.x+" "+cb.y);path.setAttribute("fill","none");path.setAttribute("stroke",BLOB_COLOR[e[0]]);path.setAttribute("stroke-width","1");path.setAttribute("opacity",".28");path.setAttribute("filter","url(#glow)");svgEl.appendChild(path)})}

var audio=document.getElementById("audio"),audioCtx,analyser,gainNode,connected=false,freqData=new Uint8Array(128);
var isPlaying=false,currentStn=0,volume=2,elapsed=0,elTimer;
var BARS=22,vizData=new Array(BARS).fill(0),synthPhase=0;

function initAudio(){try{audioCtx=new(AudioContext||webkitAudioContext)();analyser=audioCtx.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.72;gainNode=audioCtx.createGain();gainNode.gain.value=volume/100;freqData=new Uint8Array(analyser.frequencyBinCount);var src=audioCtx.createMediaElementSource(audio);src.connect(analyser);analyser.connect(gainNode);gainNode.connect(audioCtx.destination);connected=true}catch(e){}}

var specCont=document.getElementById("spec-bars");
for(var i=0;i<BARS;i++){var b=document.createElement("div");b.className="sbar";b.style.height="2px";specCont.appendChild(b)}

var stnList=document.getElementById("stn-list");
STATIONS.forEach(function(s,i){var el=document.createElement("div");el.className="stn-item"+(i===0?" active":"");el.textContent=s.n;el.onclick=function(){selectStn(i)};stnList.appendChild(el)});

function selectStn(i){currentStn=i;document.getElementById("stn-name").textContent=STATIONS[i].n;document.querySelectorAll(".stn-item").forEach(function(el,j){el.classList.toggle("active",j===i)});if(isPlaying){audio.src=STATIONS[i].url;audio.load();if(!audioCtx)initAudio();audio.play().catch(function(){})}}

document.getElementById("play-btn").onclick=function(){
  if(!isPlaying){
    if(!audioCtx)initAudio();
    if(audioCtx&&audioCtx.state==="suspended")audioCtx.resume();
    audio.src=STATIONS[currentStn].url;audio.load();
    audio.play().then(function(){
      isPlaying=true;document.getElementById("play-btn").innerHTML="&#9208;";
      document.getElementById("status").textContent="STREAMING";
      document.getElementById("status").style.color="#00e5cc";
      elapsed=0;elTimer=setInterval(function(){elapsed++;var m=String(Math.floor(elapsed/60)).padStart(2,"0");var s=String(elapsed%60).padStart(2,"0");document.getElementById("elapsed").textContent=m+":"+s},1000)
    }).catch(function(){document.getElementById("status").textContent="ERROR"})
  }else{
    audio.pause();isPlaying=false;document.getElementById("play-btn").innerHTML="&#9654;";
    document.getElementById("status").textContent="IDLE";document.getElementById("status").style.color="rgba(0,229,204,.38)";
    clearInterval(elTimer)
  }
};

var volDrag=false,volY0=0,volV0=0;
document.getElementById("vol-wrap").addEventListener("mousedown",function(e){volDrag=true;volY0=e.clientY;volV0=volume;e.stopPropagation();e.preventDefault()});
document.addEventListener("mousemove",function(e){if(!volDrag)return;volume=Math.max(0,Math.min(100,Math.round(volV0+(volY0-e.clientY)*.55)));applyVol()});
document.addEventListener("mouseup",function(){volDrag=false});
document.getElementById("b-volume").addEventListener("wheel",function(e){volume=Math.max(0,Math.min(100,volume-Math.sign(e.deltaY)*2));applyVol();e.preventDefault()},{passive:false});
function applyVol(){if(gainNode)gainNode.gain.value=volume/100;document.getElementById("vol-pct").textContent=volume+"%";var d=(volume/100)*270;document.getElementById("vol-ring").style.background="conic-gradient(from 135deg,var(--volume) "+d+"deg,rgba(240,54,94,.12) "+d+"deg)"}
applyVol();

var specBars=specCont.querySelectorAll(".sbar");
function loop(){requestAnimationFrame(loop);if(connected&&analyser&&isPlaying){analyser.getByteFrequencyData(freqData);for(var i=0;i<BARS;i++){var lo=Math.floor(Math.pow(i/BARS,1.4)*55);var hi=Math.floor(Math.pow((i+1)/BARS,1.4)*55)+1;var sum=0,cnt=0;for(var j=lo;j<hi&&j<freqData.length;j++){sum+=freqData[j];cnt++}vizData[i]=cnt?sum/cnt/255:0}var rL=0,rR=0;for(var j=0;j<64;j++)rL+=freqData[j]*freqData[j];for(var j=64;j<128;j++)rR+=freqData[j]*freqData[j];var lL=Math.sqrt(rL/64)/255,lR=Math.sqrt(rR/64)/255;document.getElementById("m-l").style.width=(lL*100)+"%";document.getElementById("m-r").style.width=(lR*100)+"%";var pk=Math.max(lL,lR);document.getElementById("m-peak").textContent=(pk>0?(20*Math.log10(pk)).toFixed(1):"\u2212\u221E")+" dB"}else if(isPlaying){synthPhase+=.038;var bpm=STATIONS[currentStn].bpm;for(var i=0;i<BARS;i++)vizData[i]=.18+.52*Math.abs(Math.sin(synthPhase*(0.9+i*.18)+i*.45))*(0.5+0.5*Math.sin(synthPhase*bpm/60*.28));var avg=vizData.reduce(function(a,b){return a+b},0)/BARS;document.getElementById("m-l").style.width=(avg*82+8)+"%";document.getElementById("m-r").style.width=(avg*76+6)+"%"}else{for(var i=0;i<BARS;i++)vizData[i]*=.88;document.getElementById("m-l").style.width="0%";document.getElementById("m-r").style.width="0%"}specBars.forEach(function(bar,i){bar.style.height=Math.max(2,vizData[i]*62)+"px";bar.style.opacity=0.55+vizData[i]*.45})}
loop();

var sc=document.getElementById("stars"),sx=sc.getContext("2d");
function rs(){sc.width=innerWidth;sc.height=innerHeight}rs();addEventListener("resize",function(){rs();drawTendrils()});
var stars=[];for(var i=0;i<90;i++)stars.push({x:Math.random(),y:Math.random(),r:Math.random()*1.4+.25,op:Math.random()*.55+.08,tw:Math.random()*Math.PI*2,spd:Math.random()*.018+.004});
(function sl(){requestAnimationFrame(sl);sx.clearRect(0,0,sc.width,sc.height);stars.forEach(function(s){s.tw+=s.spd;sx.beginPath();sx.arc(s.x*sc.width,s.y*sc.height,s.r,0,Math.PI*2);sx.fillStyle="rgba(190,210,255,"+s.op*(0.45+0.55*Math.sin(s.tw))+")";sx.fill()})})();
setTimeout(drawTendrils,60);
audio.addEventListener("waiting",function(){if(isPlaying)document.getElementById("status").textContent="BUFFERING"});
audio.addEventListener("playing",function(){if(isPlaying){document.getElementById("status").textContent="STREAMING";document.getElementById("status").style.color="#00e5cc"}});



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
  var hbPeriod = 0.6555937947549284;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.018440366406169716;mix-blend-mode:overlay';
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
