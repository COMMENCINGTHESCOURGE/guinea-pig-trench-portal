/**
 * RAYBG — Drop-in raymarched 3D background for any canvas game.
 *
 * Usage (in any game HTML):
 *   <canvas id="bg"></canvas>        <!-- add before game canvas -->
 *   <script src="../js/raybg.js"></script>
 *
 *   // Initialize with a scene name:
 *   const bg = new RayBG('bg', 'underwater');
 *
 *   // In your game loop:
 *   bg.render(time);
 *
 *   // React to gameplay:
 *   bg.pulse(0.5);     // energy burst (hit, collect, event)
 *   bg.warp(1.0);      // mandelbulb warp (travel, transition)
 *   bg.shake(0.3);     // distortion (damage, police, explosion)
 *   bg.setScene('factory');  // switch environment
 *
 * Scenes: void, underwater, city, factory, wasteland, sanctum, forest,
 *         winter, volcanic, arena, space, tunnel
 *
 * Guinea Pig Trench LLC — ohthatsthe
 */

class RayBG {
  constructor(canvasId, scene = 'void', options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = canvasId;
      this.canvas.style.cssText = 'position:fixed;inset:0;z-index:0';
      document.body.prepend(this.canvas);
    }

    this.gl = this.canvas.getContext('webgl2', {
      antialias: false, alpha: true, powerPreference: 'high-performance'
    });

    if (!this.gl) {
      console.warn('RayBG: WebGL2 not available');
      this.enabled = false;
      return;
    }
    this.enabled = true;

    this.scene = scene;
    this.sceneIdx = this._sceneIndex(scene);
    this.dim = options.dim || 0.35;     // background dimming (0-1)
    this.speed = options.speed || 1.0;  // animation speed
    this.accent = options.accent || [0, 0.82, 1]; // teal default

    // Effect state
    this.warpLevel = 0;
    this.pulseLevel = 0;
    this.shakeLevel = 0;

    this._initGL();
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _sceneIndex(name) {
    const scenes = {
      'void': 0, 'underwater': 1, 'city': 2, 'factory': 3,
      'wasteland': 4, 'sanctum': 5, 'forest': 6, 'winter': 7,
      'volcanic': 8, 'arena': 9, 'space': 10, 'tunnel': 11
    };
    return scenes[name] || 0;
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _initGL() {
    const gl = this.gl;

    const vs = `#version 300 es
    in vec2 a;out vec2 uv;
    void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

    const fs = `#version 300 es
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime,uWarp,uPulse,uShake,uDim;
    uniform int uScene;
    uniform vec3 uAccent;
    in vec2 uv;
    out vec4 O;

    const int S=40;const float FAR=10.,E=.004;

    float box(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
    float sph(vec3 p,float r){return length(p)-r;}
    float tor(vec3 p,vec2 t){return length(vec2(length(p.xz)-t.x,p.y))-t.y;}
    float cyl(vec3 p,float h,float r){vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r,h);return min(max(d.x,d.y),0.)+length(max(d,0.));}
    float cap(vec3 p,float h,float r){p.y-=clamp(p.y,-h,h);return length(p)-r;}

    // Mandelbulb for warp transitions
    float mbulb(vec3 p,float pw){
      vec3 z=p;float dr=1.,r=0.;
      for(int i=0;i<5;i++){
        r=length(z);if(r>2.)break;
        float th=acos(clamp(z.y/r,-1.,1.)),ph=atan(z.x,z.z);
        dr=pow(r,pw-1.)*pw*dr+1.;
        float zr=pow(r,pw);th*=pw;ph*=pw;
        z=zr*vec3(sin(th)*sin(ph),cos(th),sin(th)*cos(ph))+p;
      }
      return .5*log(max(r,1e-6))*r/dr;
    }

    // ── Scene SDFs ──
    float scVoid(vec3 p){
      float g=p.y+1.5;
      float o=sph(p-vec3(0.,sin(uTime*.5)*.5+1.,0.),.35);
      return min(g,o);
    }
    float scUnderwater(vec3 p){
      float f=p.y+1.5+sin(p.x*.5+uTime)*.3+cos(p.z*.4+uTime*.7)*.2;
      float b=sph(p-vec3(sin(uTime+p.z)*.8,mod(uTime*.5+p.x,4.)-2.,cos(uTime*.7)*.8),.06);
      return min(f,b);
    }
    float scCity(vec3 p){
      vec3 q=p;q.xz=mod(q.xz+2.,4.)-2.;
      float b=box(q-vec3(0.,-.5,0.),vec3(.5,1.+sin(p.x*3.+p.z*2.)*.4,.5));
      float s=p.y+1.5;
      float n=tor(p-vec3(0.,2.,0.),vec2(1.5+sin(uTime)*.15,.025));
      return min(s,min(b,n));
    }
    float scFactory(vec3 p){
      float f=p.y+1.5;
      float a2=atan(p.x,p.z)+uTime*.2;
      float g=tor(vec3(cos(a2)*length(p.xz),p.y-1.,sin(a2)*length(p.xz)),vec2(1.6,.06));
      float pi=cyl(p-vec3(2.,0.,0.),3.,.08);
      // Bricks: repeating boxes with gaps
      vec3 bp=p;bp.xz=mod(bp.xz+.25,.5)-.25;bp.y=mod(bp.y+.125,.25)-.125;
      float bricks=box(bp,vec3(.22,.1,.22));
      float wall=max(box(p-vec3(-3.,0.,0.),vec3(.15,2.,3.)),bricks);
      return min(f,min(g,min(pi,wall)));
    }
    float scWasteland(vec3 p){
      float g=p.y+1.5+sin(p.x*2.)*.08*cos(p.z*2.);
      float d=box(p-vec3(sin(uTime*.4)*2.,sin(uTime*.6)*.5+.5,cos(uTime*.3)*1.5),vec3(.12));
      return min(g,d);
    }
    float scSanctum(vec3 p){
      float g=p.y+1.5;
      float a3=uTime*.3;
      vec3 cp=p-vec3(0.,1.,0.);
      cp.xz=mat2(cos(a3),-sin(a3),sin(a3),cos(a3))*cp.xz;
      float c=box(cp,vec3(.08,.7,.08));
      float r=tor(p-vec3(0.,1.5,0.),vec2(1.+sin(uTime)*.08,.018));
      return min(g,min(c,r));
    }
    float scForest(vec3 p){
      float g=p.y+1.5+sin(p.x*.8)*.15;
      // Tree trunks
      vec3 tp=p;tp.xz=mod(tp.xz+1.5,3.)-1.5;
      float trunk=cyl(tp-vec3(0.,-0.5,0.),.8,.08);
      // Canopy
      float canopy=sph(tp-vec3(0.,1.,0.),.5+sin(p.x*2.+uTime)*.1);
      return min(g,min(trunk,canopy));
    }
    float scWinter(vec3 p){
      float g=p.y+1.5+sin(p.x*.4)*.3+cos(p.z*.3)*.2;
      // Snow particles
      float snow=sph(p-vec3(sin(uTime+p.z*2.)*1.5,mod(-uTime*.3+p.x,3.)-1.,cos(uTime*.7+p.x)*1.2),.03);
      return min(g,snow);
    }
    float scVolcanic(vec3 p){
      float g=p.y+1.5-max(0.,.5-length(p.xz))*.8; // crater dip
      // Lava glow orbs
      float lava=sph(p-vec3(sin(uTime*.3)*1.2,-.8+sin(uTime)*.2,cos(uTime*.4)*1.2),.15);
      return min(g,lava);
    }
    float scArena(vec3 p){
      float f=p.y+1.5;
      // Ring
      float ring=tor(p-vec3(0.,-1.,0.),vec2(2.5,.12));
      // Pillars
      vec3 pp=p;float pa=atan(pp.x,pp.z);
      pp.xz=vec2(cos(pa),sin(pa))*2.8;
      float pil=cyl(p-vec3(pp.x,0.,pp.z),2.,.1);
      return min(f,min(ring,pil));
    }
    float scSpace(vec3 p){
      // Asteroid field
      vec3 q=mod(p+2.,4.)-2.;
      float ast=sph(q,.15+sin(p.x*3.+p.y*5.)*.05);
      // Station ring
      float st=tor(p,vec2(3.,.08));
      return min(ast,st);
    }
    float scTunnel(vec3 p){
      float d=length(p.xy)-1.5-sin(p.z*.5+uTime)*.3;
      return -d; // inside a tube
    }

    float scene(vec3 p){
      if(uShake>.01)p+=sin(p*4.+uTime*6.)*uShake*.1;
      if(uWarp>.01)return mbulb(p*.5,6.+uWarp*4.)*.5;
      if(uScene==0)return scVoid(p);
      if(uScene==1)return scUnderwater(p);
      if(uScene==2)return scCity(p);
      if(uScene==3)return scFactory(p);
      if(uScene==4)return scWasteland(p);
      if(uScene==5)return scSanctum(p);
      if(uScene==6)return scForest(p);
      if(uScene==7)return scWinter(p);
      if(uScene==8)return scVolcanic(p);
      if(uScene==9)return scArena(p);
      if(uScene==10)return scSpace(p);
      return scTunnel(p);
    }

    vec3 norm(vec3 p){
      const float h=.003;const vec2 k=vec2(1.,-1.);
      return normalize(k.xyy*scene(p+k.xyy*h)+k.yyx*scene(p+k.yyx*h)+
                       k.yxy*scene(p+k.yxy*h)+k.xxx*scene(p+k.xxx*h));
    }

    void main(){
      vec2 p=(gl_FragCoord.xy-uRes*.5)/uRes.y;
      float ct=cos(uTime*.06),st2=sin(uTime*.06);
      vec3 eye=vec3(st2*3.5,1.8+sin(uTime*.1)*.4,ct*3.5);
      vec3 ta=vec3(0.,.3,0.);
      vec3 fwd=normalize(ta-eye),right=normalize(cross(fwd,vec3(0,1,0))),up=cross(right,fwd);
      vec3 rd=normalize(p.x*right+p.y*up+1.5*fwd);

      float t=0.;vec3 col=vec3(.02,.02,.04);
      for(int i=0;i<S;i++){
        vec3 pos=eye+rd*t;float d=scene(pos);
        if(d<E){
          vec3 n=norm(pos);
          float diff=max(dot(n,normalize(vec3(.5,.8,-.3))),0.);
          float spec=pow(max(dot(reflect(normalize(vec3(-.5,-.8,.3)),n),-rd),0.),16.);
          col=uAccent*(0.06+diff*0.45)+uAccent*spec*.25;
          if(uPulse>.01)col+=uAccent*sin(uTime*5.+pos.y*4.)*.15*uPulse;
          col=mix(vec3(.02,.02,.04),col,exp(-t*.15));
          break;
        }
        t+=d;if(t>FAR)break;
      }
      col*=1.-dot(p,p)*.3; // vignette
      col*=uDim;
      O=vec4(col,1.);
    }`;

    const gl2 = this.gl;
    const compile = (src, type) => {
      const s = gl2.createShader(type);
      gl2.shaderSource(s, src); gl2.compileShader(s);
      if (!gl2.getShaderParameter(s, gl2.COMPILE_STATUS)) {
        console.error('RayBG shader:', gl2.getShaderInfoLog(s));
        return null;
      }
      return s;
    };

    const vShader = compile(vs, gl2.VERTEX_SHADER);
    const fShader = compile(fs, gl2.FRAGMENT_SHADER);
    if (!vShader || !fShader) { this.enabled = false; return; }

    this.prog = gl2.createProgram();
    gl2.attachShader(this.prog, vShader);
    gl2.attachShader(this.prog, fShader);
    gl2.linkProgram(this.prog);

    const buf = gl2.createBuffer();
    gl2.bindBuffer(gl2.ARRAY_BUFFER, buf);
    gl2.bufferData(gl2.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl2.STATIC_DRAW);
    gl2.useProgram(this.prog);
    const a = gl2.getAttribLocation(this.prog, 'a');
    gl2.enableVertexAttribArray(a);
    gl2.vertexAttribPointer(a, 2, gl2.FLOAT, false, 0, 0);

    this.u = {};
    ['uRes','uTime','uWarp','uPulse','uShake','uDim','uScene','uAccent'].forEach(n => {
      this.u[n] = gl2.getUniformLocation(this.prog, n);
    });
  }

  // ── Public API ──

  setScene(name) {
    this.scene = name;
    this.sceneIdx = this._sceneIndex(name);
  }

  setAccent(r, g, b) {
    this.accent = [r, g, b];
  }

  pulse(amount = 0.5) {
    this.pulseLevel = Math.min(1, this.pulseLevel + amount);
  }

  warp(amount = 1.0) {
    this.warpLevel = Math.min(1, amount);
  }

  shake(amount = 0.3) {
    this.shakeLevel = Math.min(1, this.shakeLevel + amount);
  }

  render(timeMs) {
    if (!this.enabled) return;

    const gl = this.gl;
    const t = (timeMs || performance.now()) * 0.001 * this.speed;

    this._resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);

    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.uTime, t);
    gl.uniform1f(this.u.uWarp, this.warpLevel);
    gl.uniform1f(this.u.uPulse, this.pulseLevel);
    gl.uniform1f(this.u.uShake, this.shakeLevel);
    gl.uniform1f(this.u.uDim, this.dim);
    gl.uniform1i(this.u.uScene, this.sceneIdx);
    gl.uniform3f(this.u.uAccent, this.accent[0], this.accent[1], this.accent[2]);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Decay effects
    this.warpLevel = Math.max(0, this.warpLevel - 0.012);
    this.pulseLevel = Math.max(0, this.pulseLevel - 0.02);
    this.shakeLevel = Math.max(0, this.shakeLevel - 0.008);
  }
}

// Auto-expose
if (typeof window !== 'undefined') window.RayBG = RayBG;
