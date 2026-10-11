/*
 * V2 standalone motion study:
 * Canvas2D = animated sky and deep-space particles.
 * WebGL1 fragment shader = transient constellation, meteor and ripple highlights.
 * Original blog MP4/poster is always underneath both layers; reveal is by
 * compositing opacity, never by waiting for video or replacing the wallpaper.
 */
(() => {
  "use strict";
  const scene = document.body.dataset.scene;
  if (!["weave", "meteor", "ripple"].includes(scene)) return;

  const sky = document.getElementById("sky-layer");
  const fx = document.getElementById("fx-layer");
  const caption = document.getElementById("intro-copy");
  const progressBar = document.getElementById("stage-progress-bar");
  const stageLabel = document.getElementById("stage-label");
  const replay = document.getElementById("replay");
  const skip = document.getElementById("skip");
  const video = document.getElementById("background-video");
  if (!(sky instanceof HTMLCanvasElement) || !(fx instanceof HTMLCanvasElement)) return;

  const duration = scene === "ripple" ? 3200 : 3000;
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const videoAllowed = window.matchMedia("(min-width:901px) and (pointer:fine) and (prefers-reduced-motion:no-preference)");
  const ctx = sky.getContext("2d", { alpha: true });
  let gl = null;
  let program = null;
  let positionBuffer = null;
  let uniform = null;
  let raf = 0;
  let elapsed = 0;
  let previousTime = 0;
  let done = false;
  let rendererLost = false;

  const clamp01 = n => Math.min(1, Math.max(0, n));
  const smooth = (a, b, n) => {
    const t = clamp01((n - a) / (b - a));
    return t * t * (3 - 2 * t);
  };

  // Fixed seed makes screenshot and replay comparisons stable.
  let seed = 203677;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const stars = Array.from({ length: 170 }, (_, i) => ({
    x: random(), y: random(), z: 0.4 + random() * 1.6,
    phase: random() * 6.2832, size: 0.35 + random() * 1.15,
    pale: random() > 0.78, drift: (random() - 0.5) * 0.002,
    index: i
  }));

  function setupVideo() {
    if (!(video instanceof HTMLVideoElement)) return;
    const lowData = navigator.connection && navigator.connection.saveData;
    if (!videoAllowed.matches || lowData) return;
    const src = video.dataset.src;
    if (!src) return;
    video.src = src;
    video.addEventListener("playing", () => video.classList.add("is-ready"));
    video.addEventListener("pause", () => video.classList.remove("is-ready"));
    video.addEventListener("error", () => video.classList.remove("is-ready"));
    void video.play().catch(() => {});
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) video.pause();
      else if (videoAllowed.matches && !lowData) void video.play().catch(() => {});
    });
  }

  function resize() {
    const budgetRatio = Math.sqrt(2300000 / Math.max(1, innerWidth * innerHeight));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, innerWidth < 900 ? 1 : 1.25, budgetRatio);
    const width = Math.max(1, Math.floor(innerWidth * pixelRatio));
    const height = Math.max(1, Math.floor(innerHeight * pixelRatio));
    if (sky.width !== width || sky.height !== height) {
      sky.width = width;
      sky.height = height;
    }
    if (fx.width !== width || fx.height !== height) {
      fx.width = width;
      fx.height = height;
    }
    if (gl) gl.viewport(0, 0, fx.width, fx.height);
  }

  function renderSky(time, progress) {
    if (!ctx) return;
    const w = sky.width;
    const h = sky.height;
    const back = ctx.createLinearGradient(0, 0, w, h);
    back.addColorStop(0, "#100c2a");
    back.addColorStop(.5, "#1b123b");
    back.addColorStop(1, "#12112d");
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, w, h);

    // Very faint nebula; no strong blur or fog over the final video.
    const hue = ctx.createRadialGradient(w * .62, h * .35, h * .04, w * .55, h * .42, h * .8);
    hue.addColorStop(0, "rgba(118,78,173,.13)");
    hue.addColorStop(.5, "rgba(72,53,122,.05)");
    hue.addColorStop(1, "rgba(25,16,56,0)");
    ctx.fillStyle = hue;
    ctx.fillRect(0, 0, w, h);

    // JS star field is deliberately subtle. Shader handles the spectacular accents.
    for (const star of stars) {
      const x = ((star.x + time * star.drift + 1) % 1) * w;
      const y = ((star.y + time * .00023 / star.z + 1) % 1) * h;
      const blink = .6 + .4 * Math.sin(time * (.7 + star.z * .25) + star.phase);
      const appear = smooth(.025, .35, progress);
      const alpha = (0.16 + blink * .45) * appear;
      ctx.beginPath();
      ctx.fillStyle = star.pale ? "rgba(232,204,255," + alpha + ")" : "rgba(217,226,255," + alpha + ")";
      ctx.arc(x, y, star.size * star.z, 0, Math.PI * 2);
      ctx.fill();
    }

    if (scene === "weave") {
      const reveal = smooth(.11, .35, progress) * (1 - smooth(.57, .86, progress));
      ctx.strokeStyle = "rgba(207,185,255," + (.19 * reveal) + ")";
      ctx.lineWidth = Math.max(.5, w / 1800);
      const groups = [
        [[.07,.23],[.16,.17],[.23,.25],[.29,.15]],
        [[.81,.71],[.88,.62],[.94,.69]]
      ];
      for (const group of groups) {
        ctx.beginPath();
        group.forEach(([x, y], i) => {
          const pointX = x * w;
          const pointY = y * h;
          if (i === 0) ctx.moveTo(pointX, pointY);
          else ctx.lineTo(pointX, pointY);
        });
        ctx.stroke();
      }
    }
    if (scene === "meteor") {
      // Small nearby dust flows toward the direction of the shader light trails.
      const energy = smooth(.19,.36,progress) * (1 - smooth(.63,.88,progress));
      for (let i = 0; i < 18; i++) {
        const s = stars[i * 4];
        const x = (s.x + time * .028 * s.z) % 1 * w;
        const y = ((s.y - time * .011 + 1) % 1) * h;
        ctx.fillStyle = "rgba(221,203,255," + energy * .23 + ")";
        ctx.fillRect(x,y, Math.max(.6,s.size), Math.max(.6,s.size));
      }
    }
    if (scene === "ripple") {
      // The field itself gently reacts to the wave, without shifting the caption.
      const flash = smooth(.25,.42,progress) * (1 - smooth(.67,.86,progress));
      const cx = w * .5, cy = h * .5;
      const radius = Math.min(w,h) * (.05 + progress * .72);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(207,178,255," + flash * .09 + ")";
      ctx.beginPath();
      ctx.arc(cx,cy,radius,0,2*Math.PI);
      ctx.stroke();
    }
  }

  const vertexSource = `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0., 1.); }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_progress;
    uniform float u_scene;
    float hash2(vec2 p) {
      p = fract(p*vec2(123.3,345.4));
      p += dot(p,p+34.4);
      return fract(p.x*p.y);
    }
    float point(vec2 p, vec2 pos, float r) {
      vec2 v=(p-pos)/max(r,.00001);
      return exp(-dot(v,v));
    }
    float line(vec2 p, vec2 a, vec2 b, float thickness) {
      vec2 ab=b-a;
      float t=clamp(dot(p-a,ab)/max(dot(ab,ab),.0001),0.,1.);
      float d=length(p-a-ab*t);
      return 1. - smoothstep(thickness,thickness*2.5,d);
    }
    float rise(float a,float b,float p){return smoothstep(a,b,p);}
    float meteor(vec2 p, vec2 start, vec2 finish, float t, float size) {
      vec2 tip=mix(start,finish,clamp(t,0.,1.));
      vec2 dir=normalize(finish-start);
      vec2 back=tip-p;
      float dist=dot(back,dir);
      float normal=abs(back.x*dir.y-back.y*dir.x);
      float tail=exp(-pow(normal/(size+.012*clamp(dist/.5,0.,1.)),2.))
         *smoothstep(0.,.028,dist)*(1.-smoothstep(.33,.75,dist));
      return tail*.45 + point(p,tip,size*4.)*.5;
    }
    void main(){
      vec2 uv=(gl_FragCoord.xy-.5*u_resolution)/u_resolution.y;
      float p=u_progress;
      float l=0.;
      vec3 tint=vec3(.79,.72,1.);
      if(u_scene<.5){
        float a=rise(.14,.37,p)*(1.-rise(.64,.93,p));
        float beams=line(uv,vec2(-.76,.24),vec2(-.52,.39),.0015)
          +line(uv,vec2(-.52,.39),vec2(-.34,.26),.0015)
          +line(uv,vec2(.52,-.25),vec2(.69,-.12),.0015);
        float sparks=point(uv,vec2(-.52,.39),.016)
          +point(uv,vec2(.69,-.12),.016)
          +point(uv,vec2(-.34,.26),.013);
        l=(beams*.20+sparks*.26)*a;
      } else if(u_scene<1.5){
        float a=rise(.11,.28,p)*(1.-rise(.72,.92,p));
        l=meteor(uv,vec2(-1.3,.67),vec2(1.3,-.41),rise(.12,.80,p),.0025)
         +meteor(uv,vec2(-1.15,.35),vec2(1.13,-.59),rise(.34,.94,p),.0016)*.55;
        l*=a;
      } else {
        float a=rise(.14,.30,p)*(1.-rise(.65,.94,p));
        float dist=length(uv);
        float r1=mix(.03,.91,rise(.16,.85,p));
        float r2=mix(.01,.64,rise(.28,.91,p));
        float arc=.7+.3*sin(atan(uv.y,uv.x)*7.+u_time);
        l=((1.-smoothstep(.002,.012,abs(dist-r1)))*.3*arc
          +(1.-smoothstep(.002,.016,abs(dist-r2)))*.12
          +point(uv,vec2(0.,0.),.046)*.13*(1.-rise(.34,.57,p)))*a;
      }
      // A few faint drifting glints; the drawn sky provides most of the stars.
      vec2 tile=floor((uv+vec2(.17,-.08))*31.);
      vec2 cell=fract((uv+vec2(.17,-.08))*31.);
      vec2 center=vec2(hash2(tile+.17),hash2(tile+8.6));
      float glint=step(.91,hash2(tile+2.5))*point(cell,center,.075);
      l += glint*.16*rise(.06,.32,p)*(1.-rise(.67,.95,p));
      l=clamp(l,0.,1.);
      gl_FragColor=vec4(tint, min(.65,l));
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Cannot allocate shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message || "Shader compilation failed");
    }
    return shader;
  }

  function initGL() {
    try {
      gl = fx.getContext("webgl", {
        alpha: true, premultipliedAlpha: false, depth: false,
        stencil: false, antialias: false
      });
      if (!gl) return false;
      const vert = compile(gl.VERTEX_SHADER, vertexSource);
      const frag = compile(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      if (!program) throw new Error("Cannot allocate program");
      gl.attachShader(program, vert);
      gl.attachShader(program, frag);
      gl.linkProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      gl.useProgram(program);
      const attr = gl.getAttribLocation(program,"a_position");
      gl.enableVertexAttribArray(attr);
      gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
      uniform = {
        resolution:gl.getUniformLocation(program,"u_resolution"),
        time:gl.getUniformLocation(program,"u_time"),
        progress:gl.getUniformLocation(program,"u_progress"),
        scene:gl.getUniformLocation(program,"u_scene")
      };
      gl.disable(gl.BLEND);
      return true;
    } catch (err) {
      console.warn("[intro v2] Shader disabled, Canvas2D preview remains available:", err);
      gl = null;
      return false;
    }
  }

  function renderShader(time, progress) {
    if (!gl || rendererLost) return;
    gl.viewport(0,0,fx.width,fx.height);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(uniform.resolution,fx.width,fx.height);
    gl.uniform1f(uniform.time,time);
    gl.uniform1f(uniform.progress,progress);
    gl.uniform1f(uniform.scene,scene==="weave"?0:scene==="meteor"?1:2);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }

  function finish() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    done = true;
    sky.style.opacity = "0";
    fx.style.opacity = "0";
    sky.style.display = "none";
    fx.style.display = "none";
    caption.style.opacity = "0";
    progressBar.style.transform = "scaleX(1)";
    stageLabel.textContent = "预览完成 · 原有背景视频 / 海报";
    document.body.classList.add("is-complete");
    skip.disabled = true;
  }

  function tick(now) {
    if (done || document.hidden) {
      raf = 0;
      previousTime = 0;
      return;
    }
    if (previousTime) elapsed += Math.min(65, Math.max(0, now-previousTime));
    previousTime = now;
    const progress = clamp01(elapsed / duration);
    const t = elapsed / 1000;
    renderSky(t,progress);
    renderShader(t,progress);
    const dissolve = 1-smooth(.57,.97,progress);
    sky.style.opacity = String(dissolve);
    fx.style.opacity = String(1-smooth(.70,.97,progress));
    caption.style.opacity = String(smooth(.13,.28,progress)*(1-smooth(.70,.93,progress)));
    progressBar.style.transform = "scaleX("+progress+")";
    if (progress>=1) finish();
    else raf = requestAnimationFrame(tick);
  }

  function begin() {
    if (raf) cancelAnimationFrame(raf);
    elapsed = 0;
    previousTime = 0;
    done = false;
    sky.style.display = "block";
    fx.style.display = gl && !rendererLost ? "block" : "none";
    sky.style.opacity = "1";
    fx.style.opacity = "1";
    caption.style.opacity = "0";
    stageLabel.textContent = "JS 星空 → Shader 高光 → 视频衔接";
    progressBar.style.transform = "scaleX(0)";
    skip.disabled = false;
    document.body.classList.remove("is-complete");
    if (motionPreference.matches || !ctx) {
      finish();
    } else if (!document.hidden) {
      // Draw the first frame synchronously so the HTML background never flashes through.
      renderSky(0, 0);
      renderShader(0, 0);
      raf = requestAnimationFrame(tick);
    }
  }

  replay.addEventListener("click", begin);
  skip.addEventListener("click", finish);
  window.addEventListener("resize", resize, {passive:true});
  document.addEventListener("visibilitychange",() => {
    if (!document.hidden && !done && !raf) {
      previousTime=0;
      raf=requestAnimationFrame(tick);
    }
  });
  motionPreference.addEventListener?.("change",e=>{ if(e.matches) finish(); });
  fx.addEventListener("webglcontextlost",e=>{
    e.preventDefault();
    rendererLost=true;
    fx.style.display="none";
    gl=null;
  });

  setupVideo();
  resize();
  if (!motionPreference.matches && ctx) initGL();
  begin();
})();
