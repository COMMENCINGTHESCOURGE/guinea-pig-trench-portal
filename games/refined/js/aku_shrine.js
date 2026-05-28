
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', {antialias:false, alpha:false, powerPreference:'high-performance'});
if(!gl){document.body.innerHTML='<p style="color:red;padding:40px">WebGL2 required</p>';throw 0}

let W, H;
function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight;gl.viewport(0,0,W,H)}
resize();addEventListener('resize',resize);

// Load the Aku sprite as texture
const akuImg = new Image();
akuImg.crossOrigin = 'anonymous';
akuImg.src = '../assets/sprites/aku_aku_mask_stylized.png';
let akuLoaded = false;
const akuTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, akuTex);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,180,160,255]));
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
akuImg.onload = () => {
  gl.bindTexture(gl.TEXTURE_2D, akuTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, akuImg);
  akuLoaded = true;
};

// ══════════════════════════════════════════════════════════
// SCENE SHADER — Aku mask as cross-section SDF + temple
// with negative bloom, bioluminescence, and tentacles
// ══════════════════════════════════════════════════════════

const VS = `#version 300 es
in vec2 a;out vec2 uv;
void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

const FS_SCENE = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uAku;
in vec2 uv;out vec4 O;

const int STEPS=90;
const float FAR=30.,EPS=.003;

// ── Sprite height from Aku texture ──
float akuH(vec2 p){
  vec2 st=p*.5+.5;
  if(st.x<0.||st.x>1.||st.y<0.||st.y>1.)return 0.;
  vec4 c=texture(uAku,st);
  return (c.r*.3+c.g*.5+c.b*.2)*c.a;
}

// ── Cross-section SDF — THE BOULDER that makes Aku 3D ──
float sdfAkuMask(vec3 p){
  // Scale and position the mask
  vec3 mp = p;
  mp.y -= 1.8; // raise it up
  mp *= 1.3;   // scale

  // Breathing animation
  float breath = 1.0 + sin(uTime * 1.2) * 0.02;
  mp.xz /= breath;

  float h1 = akuH(mp.xy);
  float h2 = akuH(mp.xz);
  float mask = max(abs(mp.z) - h1 * .35, abs(mp.y - .1) - h2 * .35);

  // Add carved depth — make it more 3D
  float carve = sin(mp.x * 12.) * sin(mp.y * 12.) * .008;
  return mask + carve;
}

// ── Tentacles as bezier-curved cylinders ──
float sdfTentacle(vec3 p, float phase, float side){
  // Bezier control points animated over time
  float t = uTime * .8 + phase;
  vec3 p0 = vec3(side * .6, 1.2, 0.);
  vec3 p1 = vec3(side * 1.2, 1.0 + sin(t) * .3, sin(t * .7) * .4);
  vec3 p2 = vec3(side * 1.5, .5 + cos(t * .9) * .4, cos(t * .6) * .6);
  vec3 p3 = vec3(side * 1.2, -.2 + sin(t * 1.1) * .3, sin(t * .8) * .3);

  // De Casteljau evaluation — sample closest point on bezier
  float minD = 999.;
  for(int i = 0; i <= 16; i++){
    float s = float(i) / 16.;
    // Cubic bezier
    vec3 a = mix(p0, p1, s);
    vec3 b = mix(p1, p2, s);
    vec3 c = mix(p2, p3, s);
    vec3 ab = mix(a, b, s);
    vec3 bc = mix(b, c, s);
    vec3 pt = mix(ab, bc, s);

    float thickness = .06 * (1. - s * .6); // taper
    float d = length(p - pt) - thickness;
    minD = min(minD, d);
  }
  return minD;
}

// ── Temple pillars ──
float sdfPillar(vec3 p, vec3 pos){
  vec3 d = p - pos;
  float r = length(d.xz) - .15;
  float h = abs(d.y) - 2.5;
  return max(r, h);
}

// ── Ground — carved stone floor ──
float sdfGround(vec3 p){
  return p.y + .5;
}

// ── Bioluminescent mushroom ──
float sdfMushroom(vec3 p, vec3 pos){
  vec3 d = p - pos;
  float stem = max(length(d.xz) - .03, abs(d.y - .1) - .15);
  float cap = length(d - vec3(0,.25,0)) - .08;
  return min(stem, cap);
}

// ── Full scene ──
float scene(vec3 p, out int matID){
  float d = sdfGround(p);
  matID = 0; // ground

  // Aku mask
  float aku = sdfAkuMask(p);
  if(aku < d){ d = aku; matID = 1; }

  // Tentacles (6 total, 3 per side)
  for(int i = 0; i < 3; i++){
    float phase = float(i) * 2.1;
    float tL = sdfTentacle(p, phase, -1.);
    float tR = sdfTentacle(p, phase + 1.05, 1.);
    if(tL < d){ d = tL; matID = 2; }
    if(tR < d){ d = tR; matID = 2; }
  }

  // Temple pillars
  float pil1 = sdfPillar(p, vec3(-2.5, 2., -1.5));
  float pil2 = sdfPillar(p, vec3(2.5, 2., -1.5));
  float pil3 = sdfPillar(p, vec3(-2.5, 2., 1.5));
  float pil4 = sdfPillar(p, vec3(2.5, 2., 1.5));
  float pillars = min(min(pil1, pil2), min(pil3, pil4));
  if(pillars < d){ d = pillars; matID = 3; }

  // Mushrooms
  float m1 = sdfMushroom(p, vec3(-1.8, -.5, .8));
  float m2 = sdfMushroom(p, vec3(2.1, -.5, 1.2));
  float m3 = sdfMushroom(p, vec3(-1.2, -.5, -1.));
  float m4 = sdfMushroom(p, vec3(1.5, -.5, -.6));
  float m5 = sdfMushroom(p, vec3(.3, -.5, 1.8));
  float mush = min(min(min(m1,m2),min(m3,m4)),m5);
  if(mush < d){ d = mush; matID = 4; }

  return d;
}

vec3 calcN(vec3 p){
  int dummy;
  const float h=.002;const vec2 k=vec2(1.,-1.);
  return normalize(
    k.xyy*scene(p+k.xyy*h,dummy)+k.yyx*scene(p+k.yyx*h,dummy)+
    k.yxy*scene(p+k.yxy*h,dummy)+k.xxx*scene(p+k.xxx*h,dummy));
}

float calcAO(vec3 p,vec3 n){
  int dummy;float o=0.,s=1.;
  for(int i=0;i<5;i++){float h=.02+.1*float(i);o+=(h-scene(p+n*h,dummy))*s;s*=.6;}
  return clamp(1.-2.5*o,0.,1.);
}

void main(){
  vec2 fc=(uv-.5)*vec2(uRes.x/uRes.y,1.);

  // Camera orbits slowly
  float ct = uTime * .15;
  float camR = 5.5 + sin(uTime * .1) * .5;
  vec3 eye = vec3(sin(ct)*camR, 2.2 + sin(uTime*.2)*.3, cos(ct)*camR);
  vec3 ta = vec3(0., 1.5, 0.);
  vec3 fwd = normalize(ta - eye);
  vec3 rt = normalize(cross(fwd, vec3(0,1,0)));
  vec3 up = cross(rt, fwd);
  vec3 rd = normalize(fc.x*rt + fc.y*up + 1.6*fwd);

  // Sky — dark temple interior
  float skyY = max(rd.y, 0.);
  vec3 col = mix(vec3(.02,.03,.05), vec3(.01,.015,.03), skyY);

  float t = 0.;
  int matID;
  for(int i = 0; i < STEPS; i++){
    vec3 p = eye + rd * t;
    float d = scene(p, matID);
    if(d < EPS){
      vec3 n = calcN(p);
      float ao = calcAO(p, n);

      // Torchlight — warm, from the sides
      vec3 torch1 = vec3(-2., 2.5, -1.);
      vec3 torch2 = vec3(2., 2.5, -1.);
      float tl1 = max(dot(n, normalize(torch1 - p)), 0.) / (1. + length(torch1 - p) * .3);
      float tl2 = max(dot(n, normalize(torch2 - p)), 0.) / (1. + length(torch2 - p) * .3);
      float torchLight = tl1 + tl2;

      // Cool ambient from above
      float amb = max(dot(n, vec3(0,1,0)), 0.) * .08;

      vec3 baseCol;

      if(matID == 0){
        // Ground — dark carved stone with tile pattern
        float stoneN = fract(sin(dot(floor(p.xz*3.),vec2(127.1,311.7)))*43758.5)*.05;
        vec2 tile = fract(p.xz * 1.5) - .5;
        float mortar = smoothstep(.46,.48,max(abs(tile.x),abs(tile.y)));
        baseCol = vec3(.08,.09,.10) + stoneN;
        baseCol = mix(baseCol, vec3(.04,.045,.05), mortar * .5);
        // Water reflection hint
        float water = pow(max(dot(reflect(rd,n), normalize(vec3(.5,1,.3))), 0.), 32.);
        baseCol += vec3(.1,.15,.2) * water * .3;
      }
      else if(matID == 1){
        // AKU MASK — carved stone with orbit trap coloring
        // Sample the sprite for color hints
        vec3 mp = p; mp.y -= 1.8; mp *= 1.3;
        vec2 tc = mp.xy * .5 + .5;
        vec4 sprCol = texture(uAku, clamp(tc, 0., 1.));

        // Stone base with gold/teal from sprite
        baseCol = vec3(.35,.34,.32); // grey stone
        baseCol = mix(baseCol, sprCol.rgb * .8, sprCol.a * .4);

        // Tribal carving lines — darken grooves
        float carveDetail = sin(p.x*20.)*sin(p.y*15.)*.5+.5;
        baseCol *= .7 + carveDetail * .3;

        // Diamond gem — bright blue at center
        float gemDist = length(mp.xy - vec2(0., .15));
        if(gemDist < .08){
          baseCol = vec3(.2,.4,.9) * (1.5 + sin(uTime*3.)*.5);
        }

        // Crown faces glow
        if(mp.y > .4 && abs(mp.x) < .4){
          baseCol += vec3(.03,.05,.04) * (1. + sin(uTime + mp.x * 5.) * .3);
        }
      }
      else if(matID == 2){
        // Tentacles — grey-green organic
        baseCol = vec3(.25,.28,.25);
        float wetness = pow(max(dot(reflect(rd,n), normalize(vec3(0,1,0))), 0.), 16.);
        baseCol += vec3(.05,.1,.08) * wetness;
        // Sucker detail
        float suckers = sin(length(p)*30.)*.5+.5;
        baseCol *= .8 + suckers * .2;
      }
      else if(matID == 3){
        // Pillars — dark carved stone with tribal pattern
        float pattern = sin(p.y*8.)*sin(atan(p.x-floor(p.x/5.)*5.,p.z-floor(p.z/3.)*3.)*6.)*.5+.5;
        baseCol = vec3(.12,.11,.10) + vec3(.02) * pattern;
      }
      else if(matID == 4){
        // Mushrooms — BIOLUMINESCENT
        baseCol = vec3(0.,.8,.7);
        // Pulsing glow
        float pulse = .7 + .3 * sin(uTime * 2. + p.x * 3.);
        baseCol *= pulse * 1.5;
      }

      // ── VOID (valleys) vs NEON (surface) lighting model ──
      // Concavities get void energy — cold, dark, pulling inward
      // Convexities get neon energy — bright, vivid, pushing outward
      // AO already measures this: low AO = valley = void, high AO = exposed = neon

      // Neon surface light — warm torch + vivid HSV shift on exposed surfaces
      float neonAmt = ao * ao; // squared = only the most exposed surfaces glow
      vec3 neonCol = baseCol * 1.4 + vec3(.05,.12,.1) * neonAmt;

      // Void valley energy — cold blue-purple darkness in crevices
      float voidAmt = 1. - ao; // inverse of AO = how deep the valley
      vec3 voidCol = vec3(.02,.01,.06) * voidAmt * 2.;

      // Combine: surface gets neon, valleys get void
      col = neonCol * (amb + torchLight * vec3(1.,.75,.5) * 1.5) * ao;
      col -= voidCol; // void SUBTRACTS — negative bloom principle in the lighting itself
      col = max(col, vec3(0.)); // clamp negative

      // Specular from torches — neon highlights on peaks
      vec3 H1 = normalize(normalize(torch1-p) - rd);
      float spec = pow(max(dot(n, H1), 0.), 48.) * tl1;
      col += vec3(1.,.85,.65) * spec * .6 * neonAmt; // only on exposed surface

      // Neon rim light — the surface announces itself
      float rim = pow(1. - max(dot(n, -rd), 0.), 3.);
      col += baseCol * rim * .15 * neonAmt;

      // Subsurface scatter on tentacles and mask
      if(matID == 1 || matID == 2){
        float sss = pow(clamp(dot(rd, normalize(vec3(.5,.3,-.3))) + .3, 0., 1.), 3.);
        col += vec3(.15,.08,.04) * sss * .15 * ao;
      }

      // Mushroom glow emission — pure neon, unaffected by void
      if(matID == 4){
        col += baseCol * .4; // stronger emission
        // Cast teal light into nearby void areas
        col += vec3(0.,.15,.12) * voidAmt * .3;
      }

      // The gem pulses between void and neon
      if(matID == 1){
        vec3 mp2 = p; mp2.y -= 1.8; mp2 *= 1.3;
        float gemDist2 = length(mp2.xy - vec2(0.,.15));
        if(gemDist2 < .1){
          float gemPulse = sin(uTime * 2.) * .5 + .5;
          // Oscillates between void purple and neon blue
          vec3 gemVoid = vec3(.15,.02,.25);
          vec3 gemNeon = vec3(.2,.5,1.);
          col += mix(gemVoid, gemNeon, gemPulse) * .8;
        }
      }

      // Atmospheric fog — thick temple air
      vec3 fogCol = vec3(.02,.03,.06);
      float fogAmt = 1. - exp(-max(t-2., 0.) * .08);
      col = mix(col, fogCol, fogAmt);

      break;
    }
    t += d;
    if(t > FAR) break;
  }

  // ── NEGATIVE BLOOM (in-shader approximation) ──
  // Bright pixels darken their surroundings
  float lum = dot(col, vec3(.2126,.7152,.0722));
  // The mask and mushrooms should cast dark halos
  // This is approximated by darkening based on neighbor brightness gradient
  vec3 darkHalo = col * max(0., lum - .3) * .4;
  col -= darkHalo;

  // Color grading — push shadows blue, highlights warm
  float l2 = dot(col, vec3(.2126,.7152,.0722));
  col = mix(col, col * vec3(.85,.9,1.1), max(0., .2-l2) * 3.);
  col = mix(col, col * vec3(1.1,.95,.85), clamp(l2-.3, 0., .3) * 2.);

  // ACES tonemap
  col = clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14), 0., 1.);
  col = pow(col, vec3(1./2.2));

  // Heavy vignette — temple framing
  float vig = pow(16.*uv.x*uv.y*(1.-uv.x)*(1.-uv.y), .2);
  col *= .35 + .65 * vig;

  // Film grain
  float grain = fract(sin(dot(gl_FragCoord.xy + uTime*80., vec2(12.9898,78.233)))*43758.5);
  col += (grain - .5) * .015;

  O = vec4(col, 1.);
}`;

// Compile
function mkS(src,type){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(s));return null}return s}
const prog=gl.createProgram();
gl.attachShader(prog,mkS(VS,gl.VERTEX_SHADER));
gl.attachShader(prog,mkS(FS_SCENE,gl.FRAGMENT_SHADER));
gl.linkProgram(prog);
if(!gl.getProgramParameter(prog,gl.LINK_STATUS))console.error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);

const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
const aLoc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(aLoc);
gl.vertexAttribPointer(aLoc,2,gl.FLOAT,false,0,0);

const uRes=gl.getUniformLocation(prog,'uRes');
const uTime=gl.getUniformLocation(prog,'uTime');
const uAkuLoc=gl.getUniformLocation(prog,'uAku');

gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D,akuTex);
gl.uniform1i(uAkuLoc,0);

let fc=0,lastFps=0;
function render(t){
  t*=.001;
  resize();
  gl.uniform2f(uRes,W,H);
  gl.uniform1f(uTime,t);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);

  fc++;
  if(t-lastFps>1){
    document.getElementById('fps').textContent=fc+' FPS';
    fc=0;lastFps=t;
  }
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
  wn.textContent = 'VAULT COMPOUND 7';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.6744891853803476;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.01281996140937206;mix-blend-mode:overlay';
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
