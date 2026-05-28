
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});
if(!gl){document.body.innerHTML='<p style="color:red;padding:40px">WebGL2 required</p>';throw 0}

let W,H;
function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight;gl.viewport(0,0,W,H)}
resize();addEventListener('resize',resize);

// Load sprites for the world transitions
const sprites = {};
const spriteNames = ['aku_aku_mask_stylized','mecha_entity_alpha_v2_pixel','geometric_core_geode_flux'];
const spriteTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, spriteTex);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,200,180,255]));
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);

let currentSprite = 0;
const spriteImgs = [];
spriteNames.forEach((name,i) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = `../assets/sprites/${name}.png`;
  img.onload = () => {
    if(i === 0){
      gl.bindTexture(gl.TEXTURE_2D, spriteTex);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
    }
  };
  spriteImgs[i] = img;
});

function switchSprite(idx){
  if(!spriteImgs[idx] || !spriteImgs[idx].complete) return;
  gl.bindTexture(gl.TEXTURE_2D, spriteTex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,spriteImgs[idx]);
  currentSprite = idx;
}

// ══════════════════════════════════════════════════════════
// THE THRESHOLD — A journey through all the worlds
//
// The camera descends through layers:
//   1. THE PINK HOUR — magenta bloom, five signals on a grid
//   2. THE BLOCK — neon streets, four corners
//   3. THE THRESHOLD — where Aku waits, the membrane between
//   4. VAULT COMPOUND 7 — deep underground, sensor arrays
//   5. THE BETWEEN — the void beneath everything
//
// Each world has its own SDF, palette, and atmosphere.
// The transition between them IS the game.
// ══════════════════════════════════════════════════════════

const VS = `#version 300 es
in vec2 a;out vec2 uv;
void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uSprite;
in vec2 uv;out vec4 O;

const int STEPS=80;
const float FAR=50.,EPS=.003;

// ── Noise ──
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}

// ── Sprite height ──
float sprH(vec2 p){
  vec2 st=p*.5+.5;
  if(st.x<0.||st.x>1.||st.y<0.||st.y>1.)return 0.;
  vec4 c=texture(uSprite,st);
  return (c.r*.3+c.g*.5+c.b*.2)*c.a;
}

// ── World cycle (0-4, loops) ──
// Each world lasts ~12 seconds, transition takes ~3
float worldPhase(){return mod(uTime*.08,5.);}
float worldBlend(float phase){return smoothstep(0.,.15,fract(phase))*smoothstep(1.,.85,fract(phase));}

// ── SDFs for each world ──

// PINK HOUR — glowing grid floor with bloom pillars
float sdfPinkHour(vec3 p){
  float ground = p.y + 1.;
  // Grid pillars that pulse
  vec2 gp = mod(p.xz + 2., 4.) - 2.;
  float pillar = length(gp) - .1 - .05*sin(uTime*2.+p.x+p.z);
  pillar = max(pillar, abs(p.y - 1.) - 2.);
  return min(ground, pillar);
}

// THE BLOCK — angular buildings, street grid
float sdfBlock(vec3 p){
  float ground = p.y + 1.;
  // Buildings from grid
  vec2 bp = mod(p.xz + 3., 6.) - 3.;
  float building = max(max(abs(bp.x)-1.,abs(bp.y)-1.), -(p.y - 2. - hash(floor((p.xz+3.)/6.))*3.));
  // Street cuts
  float street = min(abs(bp.x)-.4, abs(bp.y)-.4);
  building = max(building, -street);
  return min(ground, building);
}

// THE THRESHOLD — Aku mask cross-section + temple
float sdfThreshold(vec3 p){
  float ground = p.y + 1.;
  // Aku mask
  vec3 mp = p; mp.y -= 1.5; mp *= 1.2;
  float breath = 1. + sin(uTime*1.2)*.02;
  mp.xz /= breath;
  float h1=sprH(mp.xy),h2=sprH(mp.xz);
  float mask = max(abs(mp.z)-h1*.35, abs(mp.y-.1)-h2*.35);
  // Pillars
  float pil = 999.;
  for(int i=0;i<4;i++){
    float a = float(i)*1.5708;
    vec3 pp = vec3(cos(a)*3., 0., sin(a)*3.);
    float r = length(p.xz-pp.xz)-.18;
    float h = abs(p.y-1.5)-2.5;
    pil = min(pil, max(r,h));
  }
  return min(ground, min(mask, pil));
}

// VAULT COMPOUND 7 — tight corridors, sensor panels
float sdfVault(vec3 p){
  // Corridor walls
  float walls = -max(abs(p.x)-2., abs(p.z)-8.);
  walls = max(walls, -(abs(p.y)-2.));
  // Panel details
  vec2 pp = mod(p.yz+.5, 1.)-.5;
  float panels = abs(pp.x)-.4;
  walls = max(walls, -panels*.3);
  float ground = p.y + 1.5;
  return max(min(ground, -walls), -(length(p.xz)-1.5));
}

// THE BETWEEN — pure void with floating particles defined by absence
float sdfBetween(vec3 p){
  // Floating voids — holes in space
  float d = 999.;
  for(int i=0;i<6;i++){
    float fi = float(i);
    vec3 center = vec3(
      sin(fi*1.1+uTime*.3)*3.,
      cos(fi*1.7+uTime*.2)*2.,
      sin(fi*2.3+uTime*.4)*3.
    );
    float sphere = length(p-center) - .5 - sin(uTime+fi)*.1;
    d = min(d, sphere);
  }
  // Invert — the voids ARE the geometry
  float shell = length(p) - 8.;
  return max(-d, shell);
}

// ── Combined scene with world blending ──
float scene(vec3 p, out int worldID){
  float phase = worldPhase();
  int w = int(floor(phase));
  float blend = worldBlend(phase);
  worldID = w;

  // Blend between current and next world SDFs during transitions
  float d_current, d_next;
  int nextW = (w + 1) > 4 ? 0 : w + 1;
  float frac = fract(phase);
  float blendT = smoothstep(0.8, 1.0, frac); // blend in last 20% of each world

  // Current world SDF
  if(w==0) d_current = sdfPinkHour(p);
  else if(w==1) d_current = sdfBlock(p);
  else if(w==2) d_current = sdfThreshold(p);
  else if(w==3) d_current = sdfVault(p);
  else d_current = sdfBetween(p);

  // Next world SDF (for blending)
  if(nextW==0) d_next = sdfPinkHour(p);
  else if(nextW==1) d_next = sdfBlock(p);
  else if(nextW==2) d_next = sdfThreshold(p);
  else if(nextW==3) d_next = sdfVault(p);
  else d_next = sdfBetween(p);

  // Smooth blend between worlds
  float d = mix(d_current, d_next, blendT);
  // Update worldID to next during blend for color grading transition
  if(blendT > 0.5) worldID = nextW;

  return d;
}

vec3 calcN(vec3 p){int dummy;const float h=.003;const vec2 k=vec2(1.,-1.);
  return normalize(k.xyy*scene(p+k.xyy*h,dummy)+k.yyx*scene(p+k.yyx*h,dummy)+
    k.yxy*scene(p+k.yxy*h,dummy)+k.xxx*scene(p+k.xxx*h,dummy));}

float calcAO(vec3 p,vec3 n){int dummy;float o=0.,s=1.;
  for(int i=0;i<4;i++){float h=.03+.12*float(i);o+=(h-scene(p+n*h,dummy))*s;s*=.6;}
  return clamp(1.-2.5*o,0.,1.);}

// ── World palettes ──
vec3 worldFog(int w){
  if(w==0) return vec3(.12,.04,.10); // pink
  if(w==1) return vec3(.02,.03,.06); // night city
  if(w==2) return vec3(.02,.04,.05); // temple dark
  if(w==3) return vec3(.03,.02,.01); // vault amber
  return vec3(.0,.0,.02);            // void
}

vec3 worldLight(int w){
  if(w==0) return vec3(1.,.4,.6);    // magenta
  if(w==1) return vec3(.2,1.,.6);    // neon green
  if(w==2) return vec3(1.,.7,.4);    // torchlight
  if(w==3) return vec3(1.,.6,.2);    // amber warning
  return vec3(.3,.5,1.);             // void blue
}

void main(){
  vec2 fc=(uv-.5)*vec2(uRes.x/uRes.y,1.);

  float phase = worldPhase();
  int worldIdx = int(floor(phase));
  float blend = worldBlend(phase);

  // Camera — spiraling descent through worlds
  float ct = uTime * .2;
  float camR = 5. + sin(uTime*.15)*1.5;
  float camY = 2. + sin(uTime*.1)*.8;
  vec3 eye = vec3(sin(ct)*camR, camY, cos(ct)*camR);
  vec3 ta = vec3(0., 1., 0.);
  vec3 fwd = normalize(ta-eye);
  vec3 rt = normalize(cross(fwd,vec3(0,1,0)));
  vec3 up = cross(rt,fwd);
  vec3 rd = normalize(fc.x*rt+fc.y*up+1.5*fwd);

  // Sky per world
  vec3 fogCol = worldFog(worldIdx);
  vec3 col = fogCol;

  // Stars (visible in all worlds but brightness varies)
  vec2 seed = floor(gl_FragCoord.xy/2.);
  float star = step(.997, hash(seed)) * hash(seed+.5);
  col += star * vec3(.3,.4,.6) * (worldIdx==4 ? .8 : .2);

  // Pink Hour bloom in sky
  if(worldIdx == 0){
    float bloomDist = length(fc - vec2(0.,.3));
    col += vec3(.8,.2,.5) * exp(-bloomDist*3.) * (.5+.3*sin(uTime));
    col += vec3(.4,.1,.3) * exp(-bloomDist*1.5) * .3;
  }

  float t=0.;int hitWorld;
  for(int i=0;i<STEPS;i++){
    vec3 p=eye+rd*t;
    float d=scene(p,hitWorld);
    if(d<EPS){
      vec3 n=calcN(p);float ao=calcAO(p,n);
      vec3 lightCol = worldLight(hitWorld);
      vec3 ld = normalize(vec3(.5,.7,-.3));
      float diff = max(dot(n,ld),0.);
      float spec = pow(max(dot(reflect(-ld,n),-rd),0.),32.);

      // Neon (surface) vs Void (valley) per world
      float neon = ao*ao;
      float voidAmt = 1.-ao;

      vec3 baseCol;
      if(hitWorld==0){
        // Pink Hour — magenta grid floor, glowing pillars
        float grid = smoothstep(.46,.48,max(abs(fract(p.x*.5)-.5),abs(fract(p.z*.5)-.5)));
        baseCol = vec3(.15,.05,.12) + grid*vec3(.8,.2,.5)*.3;
        if(p.y > 0.) baseCol = vec3(.6,.15,.4) * (1.+sin(uTime*2.+p.y*3.)*.2);
      }
      else if(hitWorld==1){
        // The Block — concrete with neon edges
        float edge = smoothstep(.35,.38,max(abs(fract(p.x)-.5),abs(fract(p.z)-.5)));
        baseCol = vec3(.1,.1,.12) + edge*vec3(0.,.8,.4)*.15;
        // Window glow
        float win = step(.6, hash(floor(p.yz*2.)))*.15;
        baseCol += vec3(.9,.7,.3)*win;
      }
      else if(hitWorld==2){
        // Threshold — carved stone with sprite color
        vec3 mp=p;mp.y-=1.5;mp*=1.2;
        vec2 tc=mp.xy*.5+.5;
        vec4 sprCol=texture(uSprite,clamp(tc,0.,1.));
        baseCol = vec3(.3,.29,.27);
        baseCol = mix(baseCol, sprCol.rgb*.7, sprCol.a*.4);
        // Gem
        if(length(mp.xy-vec2(0.,.15))<.1){
          float gp=sin(uTime*2.)*.5+.5;
          baseCol=mix(vec3(.15,.02,.25),vec3(.2,.5,1.),gp)*1.5;
        }
      }
      else if(hitWorld==3){
        // Vault — amber metal panels
        float panel = smoothstep(.42,.44,abs(fract(p.y*2.)-.5));
        baseCol = vec3(.12,.08,.04)+panel*vec3(.08,.05,.02);
        // Sensor strips
        float sensor = step(.95, sin(p.y*20.+p.z*15.))*.3;
        baseCol += vec3(.8,.3,.1)*sensor*(1.+sin(uTime*4.)*.3);
        // The 0.7s heartbeat
        float hb = pow(max(sin(uTime/0.7*6.2832),0.),8.);
        baseCol += vec3(.6,.2,.1)*hb*.1;
      }
      else{
        // The Between — void with depth coloring
        float depth = length(p)*.1;
        baseCol = vec3(.02,.03,.08)+vec3(.1,.15,.3)*depth;
        // The absence glows at the edges
        baseCol += vec3(.05,.1,.2)*voidAmt;
      }

      // Apply neon/void lighting model
      vec3 neonCol = baseCol * 1.3;
      vec3 voidCol = fogCol * voidAmt * 1.5;
      col = neonCol * (.08 + diff * lightCol * 1.2) * ao;
      col -= voidCol;
      col = max(col, vec3(0.));
      col += lightCol * spec * .4 * neon;

      // Rim light
      float rim = pow(1.-max(dot(n,-rd),0.),3.);
      col += lightCol * rim * .08 * neon;

      // Fog
      float fogAmt = 1.-exp(-max(t-3.,0.)*.06);
      col = mix(col, fogCol, fogAmt);

      // Transition flash between worlds
      float trans = 1.-blend;
      if(trans > .7) col += worldLight(worldIdx) * (trans-.7)/.3 * .3;

      break;
    }
    t+=d;if(t>FAR)break;
  }

  // Negative bloom approximation
  float lum=dot(col,vec3(.2126,.7152,.0722));
  col -= col*max(0.,lum-.35)*.3;

  // Color grade per world
  float l2=dot(col,vec3(.2126,.7152,.0722));
  if(worldIdx==0) col=mix(col,col*vec3(1.1,.85,1.),clamp(l2,0.,.5));
  else if(worldIdx==1) col=mix(col,col*vec3(.85,1.1,.95),clamp(l2,0.,.5));
  else if(worldIdx==2) col=mix(col,col*vec3(1.1,.95,.85),clamp(l2,0.,.5));

  // ACES + gamma
  col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14),0.,1.);
  col=pow(col,vec3(1./2.2));

  // Vignette
  col*=.35+.65*pow(16.*uv.x*uv.y*(1.-uv.x)*(1.-uv.y),.18);

  // Grain
  col+=(hash(gl_FragCoord.xy+uTime*80.)-.5)*.015;

  O=vec4(col,1.);
}`;

function mkS(src,type){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(s));return null}return s}
const prog=gl.createProgram();
gl.attachShader(prog,mkS(VS,gl.VERTEX_SHADER));
gl.attachShader(prog,mkS(FS,gl.FRAGMENT_SHADER));
gl.linkProgram(prog);
if(!gl.getProgramParameter(prog,gl.LINK_STATUS))console.error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);

const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
const aLoc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(aLoc);
gl.vertexAttribPointer(aLoc,2,gl.FLOAT,false,0,0);

const uRes=gl.getUniformLocation(prog,'uRes');
const uTime=gl.getUniformLocation(prog,'uTime');
gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,spriteTex);
gl.uniform1i(gl.getUniformLocation(prog,'uSprite'),0);

// ── World info overlay ──
const WORLDS = [
  {name:'THE PINK HOUR', sub:'five signals, one frequency', color:'#ff66aa', lore:'The Bloom is expanding. The grid is measuring. Five signals converge.'},
  {name:'THE BLOCK', sub:'four corners, one balance', color:'#00ff9d', lore:'Sixteen square miles of independent economy. Four women hold the balance.'},
  {name:'THE THRESHOLD', sub:'still here', color:'#00b8c8', lore:'The water is rising. The faces are blinking. The mushrooms just got brighter.'},
  {name:'VAULT COMPOUND 7', sub:'the lights are still on', color:'#ff8833', lore:'The Animated Cores pulse at 0.7 seconds. The room is breathing with you.'},
  {name:'THE BETWEEN', sub:'where the holes are', color:'#6688ff', lore:'The atmosphere is the cheese. The entities are the holes. Find the absence.'},
];

let lastWorld = -1;

function updateUI(time){
  const phase = (time * .08) % 5;
  const w = Math.floor(phase);
  if(w !== lastWorld){
    lastWorld = w;
    const world = WORLDS[w];
    const zn = document.getElementById('zone-name');
    const zs = document.getElementById('zone-sub');
    const lr = document.getElementById('lore');
    zn.textContent = world.name;
    zn.style.color = world.color;
    zs.textContent = world.sub;
    zs.style.color = world.color;
    lr.textContent = world.lore;
    lr.style.color = world.color;
    lr.style.opacity = '0';
    setTimeout(()=>lr.style.opacity='.4', 500);

    // Switch sprite per world — all 5 covered
    if(w === 0) switchSprite(2);      // Pink Hour → geode (crystal energy)
    else if(w === 1) switchSprite(1); // Block → mecha (the fighter)
    else if(w === 2) switchSprite(0); // Threshold → aku (the idol)
    else if(w === 3) switchSprite(1); // Vault → mecha (the technology)
    else switchSprite(2);             // Between → geode (the absence)
  }
  // Heartbeat counter (0.7s pulse from Vault lore)
  const hb = Math.sin(time / 0.7 * Math.PI * 2);
  document.getElementById('heartbeat').style.opacity = (0.15 + Math.max(0,hb) * 0.35).toString();
}

let fc=0,lastFps=0;
function render(t){
  t*=.001;resize();
  gl.uniform2f(uRes,W,H);
  gl.uniform1f(uTime,t);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  updateUI(t);
  fc++;if(t-lastFps>1){document.getElementById('heartbeat').textContent=fc+' FPS / 0.7s';fc=0;lastFps=t}
  requestAnimationFrame(render);
}
requestAnimationFrame(render);



// -- THE THRESHOLD CROSS-POLLINATION (pass 1) --
(function() {
  // Vignette
  var vig = document.createElement('div');
  vig.id = 'threshold-vignette';
  document.body.appendChild(vig);

  // World name
  var wn = document.createElement('div');
  wn.id = 'threshold-world-name';
  wn.textContent = 'THE THRESHOLD';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.7053225896215287;
  setInterval(function() {
    // Subtle pulse — the 0.7s heartbeat is part of the lore
    hb.style.opacity = '0.03';
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.01744226728205215;mix-blend-mode:overlay';
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
