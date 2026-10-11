/*
 * V4 / standalone cinematic intro
 * JS Canvas2D builds a real starfield. WebGL1 samples that canvas as a texture,
 * refracts it, adds visible accents and dissolves pixels to reveal the blog MP4.
 * No hooks into production Astro, Swup or the existing wallpaper scripts.
 */
(() => {
  "use strict";
  const mode = document.body.dataset.scene;
  if (!["ripple","stream","veil"].includes(mode)) return;
  const $ = id => document.getElementById(id);
  const canvas = $("star-shader");
  const fallback = $("sky-fallback");
  const caption = $("intro-copy");
  const video = $("background-video");
  const replay = $("replay"), pause = $("pause"), skip = $("skip");
  const effectButton = $("fx-toggle"), slider = $("fx-strength");
  const strengthOutput = $("fx-output"), status = $("shader-status");
  const progressLabel = $("stage-label"), progressBar = $("progress-bar");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const allowVideo = matchMedia("(min-width:901px) and (pointer:fine) and (prefers-reduced-motion:no-preference)");
  if (!(canvas instanceof HTMLCanvasElement) || !(fallback instanceof HTMLCanvasElement)) return;

  const total = 3600;
  const clamp = (x,a=0,b=1) => Math.min(b,Math.max(a,x));
  const smooth = (a,b,x) => {const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  let gl=null, shaderProgram=null, samplerTexture=null, loc=null;
  let graphicReady=false, paused=false, finished=false;
  let raf=0, last=0, elapsed=0, strength=1.10, enabled=true, frame=0;
  let width=1,height=1;
  const skySource = document.createElement("canvas");
  const baseSource = document.createElement("canvas");
  const ctx=skySource.getContext("2d",{alpha:false});
  const base=baseSource.getContext("2d",{alpha:false});
  const fb=fallback.getContext("2d",{alpha:true});

  let seed = 774113;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const stars=Array.from({length:235},()=>({
    x:rand(),y:rand(),depth:.38+rand()*1.5,size:.35+rand()*1.25,
    phase:rand()*Math.PI*2,speed:.38+rand()*1.1,cold:rand()>.73
  }));
  const sparkle=Array.from({length:28},()=>({
    x:rand(),y:rand(),radius:1.5+rand()*1.7,phase:rand()*Math.PI*2
  }));
  const vertex=`
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main(){
      v_uv=(a_pos+1.)*.5;
      gl_Position=vec4(a_pos,0.,1.);
    }
  `;
  const fragment=`
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_sky;
    uniform vec2 u_resolution;
    uniform float u_time,u_progress,u_style,u_intensity;
    float hash21(vec2 p) {
      p=fract(p*vec2(127.1,311.7));
      p+=dot(p,p+19.19);
      return fract(p.x*p.y);
    }
    float noise(vec2 p) {
      vec2 i=floor(p),f=fract(p);
      f=f*f*(3.-2.*f);
      return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),
                 mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);
    }
    float gauss(float x,float w){return exp(-pow(x/max(w,.0001),2.));}
    float rise(float a,float b,float x){return smoothstep(a,b,x);}
    float beam(vec2 p,vec2 a,vec2 b,float w) {
      vec2 ab=b-a;
      float t=clamp(dot(p-a,ab)/dot(ab,ab),0.,1.);
      return gauss(length(p-a-ab*t),w);
    }
    void main(){
      vec2 uv=v_uv;
      float p=u_progress;
      float aspect=u_resolution.x/u_resolution.y;
      vec2 q=(uv-.5)*vec2(aspect,1.);
      float scene=rise(.15,.33,p)*(1.-rise(.70,.88,p));
      float time=u_time;
      float power=u_intensity;
      vec2 shift=vec2(0.);
      float light=0.;
      vec3 tint=vec3(.69,.50,.98);

      if(u_style<.5) {
        // Refractive waves actually displace the sampled JS sky texture.
        float d=length(q*vec2(1.,1.04));
        float radius=mix(.07,.84,rise(.12,.81,p));
        float envelope=gauss(d-radius,.11);
        float phase=65.*(d-radius)-time*4.0;
        float displacement=sin(phase)*.023*envelope*scene*power;
        shift=normalize(q+vec2(.0001))*(displacement/vec2(aspect,1.));
        light=(gauss(d-radius,.018)*.58
             +gauss(d-radius-.085,.023)*.25
             +gauss(d-radius+.12,.019)*.16)*scene*power;
        tint=vec3(.77,.63,1.);
      } else if(u_style<1.5) {
        // Galactic ribbons run diagonally with several luminous crossings.
        float y=uv.y;
        float curve=.39+.25*(uv.x-.5)+.022*sin(uv.x*10.-time*.85);
        float curve2=.61-.18*(uv.x-.5)+.017*sin(uv.x*14.+time*.55);
        float moving=pow(.5+.5*sin(uv.x*29.-time*4.),8.);
        float ribbon=gauss(y-curve,.014)*(.5+.5*moving)
                    +gauss(y-curve2,.010)*(.30+.7*moving);
        shift.y=(sin(uv.x*14.-time*1.1)*.013*
          (gauss(y-curve,.10)+gauss(y-curve2,.10)))*scene*power;
        light=ribbon*.72*scene*power;
        // Small traveling meteors in the same direction as the ribbons.
        vec2 head=mix(vec2(-.12,.34),vec2(1.12,.69),rise(.12,.83,p));
        light+=gauss(length((uv-head)*vec2(aspect,1.)),.022)*.68*scene*power;
        tint=vec3(.64,.81,1.);
      } else {
        // Celestial veil: curling pale ribbons, visible before the dissolve.
        float angle=atan(q.y,q.x);
        float d=length(q);
        float spiral=d-(.19+.13*angle+time*.032);
        float spiral2=d-(.28-.085*angle-time*.022);
        float ribbon=gauss(sin(spiral*11.),.13)*gauss(d-.44,.38)
                    +gauss(sin(spiral2*13.),.13)*gauss(d-.49,.34);
        light=ribbon*.43*scene*power;
        shift=vec2(sin(angle*3.+time),cos(angle*2.-time))*
          .013*gauss(d-.45,.22)*scene*power;
        tint=vec3(.94,.74,.98);
      }
      vec3 sky=texture2D(u_sky,clamp(uv+shift,0.,1.)).rgb;
      // A small complementary highlight, not full-screen whitening.
      vec3 color=mix(sky,vec3(1.,.95,1.),clamp(light*.45,0.,.40));
      color+=tint*light*.42;

      // Fragment-level reveal, not CSS fading: the true video is always behind.
      float reveal=rise(.61,.985,p);
      float d=length(q);
      float turbulence=(noise(uv*8.+time*.11)-.5)*.068
                      +(noise(uv*27.-time*.05)-.5)*.022;
      float r=mix(-.18,1.24,reveal);
      float edgeDist=d+turbulence-r;
      float skyAlpha=rise(-.035,.038,edgeDist);
      float edge=gauss(edgeDist,.023)*rise(.015,.14,reveal)*(1.-rise(.91,1.,reveal));
      vec3 edgeTint=mix(vec3(.55,.69,1.),vec3(1.,.78,.99),noise(uv*12.));
      color+=edgeTint*edge*(.54+.34*power);
      // Tiny star chips sparkle on the dissolve frontier.
      float chips=step(.91,noise(uv*93.+vec2(time*.09,time*.06)));
      color+=chips*edgeTint*edge*.38*power;
      float alpha=clamp(skyAlpha+edge*.37,0.,1.);
      alpha*=1.-rise(.972,1.,p);
      gl_FragColor=vec4(min(color,vec3(1.)),alpha);
    }
  `;

  function createShader(type,source){
    const obj=gl.createShader(type);
    if(!obj)throw Error("Unable to allocate shader");
    gl.shaderSource(obj,source);
    gl.compileShader(obj);
    if(!gl.getShaderParameter(obj,gl.COMPILE_STATUS)){
      const why=gl.getShaderInfoLog(obj)||"Shader compilation failed";
      gl.deleteShader(obj);throw Error(why);
    }
    return obj;
  }
  function initializeShader(){
    gl=canvas.getContext("webgl",{alpha:true,premultipliedAlpha:false,
      depth:false,stencil:false,antialias:false,preserveDrawingBuffer:false});
    if(!gl)throw Error("WebGL not available");
    const v=createShader(gl.VERTEX_SHADER,vertex);
    const f=createShader(gl.FRAGMENT_SHADER,fragment);
    shaderProgram=gl.createProgram();
    if(!shaderProgram)throw Error("WebGL program allocation failed");
    gl.attachShader(shaderProgram,v);gl.attachShader(shaderProgram,f);
    gl.linkProgram(shaderProgram);
    gl.deleteShader(v);gl.deleteShader(f);
    if(!gl.getProgramParameter(shaderProgram,gl.LINK_STATUS))
      throw Error(gl.getProgramInfoLog(shaderProgram)||"WebGL shader link failed");
    gl.useProgram(shaderProgram);
    const buf=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const att=gl.getAttribLocation(shaderProgram,"a_pos");
    gl.enableVertexAttribArray(att);
    gl.vertexAttribPointer(att,2,gl.FLOAT,false,0,0);
    samplerTexture=gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,samplerTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    loc={
      resolution:gl.getUniformLocation(shaderProgram,"u_resolution"),
      time:gl.getUniformLocation(shaderProgram,"u_time"),
      progress:gl.getUniformLocation(shaderProgram,"u_progress"),
      style:gl.getUniformLocation(shaderProgram,"u_style"),
      intensity:gl.getUniformLocation(shaderProgram,"u_intensity"),
      sky:gl.getUniformLocation(shaderProgram,"u_sky")
    };
    gl.uniform1i(loc.sky,0);
    gl.disable(gl.BLEND);
    graphicReady=true;
    status.textContent="WebGL · 像素级星幕";
  }
  function rebuildSky(){
    if(!base)return;
    const w=width,h=height;
    const bg=base.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,"#0a0c25");bg.addColorStop(.38,"#1a123d");
    bg.addColorStop(.73,"#211444");bg.addColorStop(1,"#100b2c");
    base.fillStyle=bg;base.fillRect(0,0,w,h);
    // Subtle diagonal galactic concentrations, not heavy fog.
    for(const [x,y,r,c] of [
      [.34,.44,.53,"rgba(126,87,183,.19)"],
      [.62,.38,.47,"rgba(91,73,161,.17)"],
      [.75,.68,.38,"rgba(79,58,153,.13)"],
      [.18,.81,.36,"rgba(74,54,138,.12)"]
    ]){
      const grd=base.createRadialGradient(x*w,y*h,0,x*w,y*h,r*Math.max(w,h));
      grd.addColorStop(0,c);grd.addColorStop(1,"rgba(14,9,43,0)");
      base.fillStyle=grd;base.fillRect(0,0,w,h);
    }
    let local=3811;
    const staticRand=()=>{local=(Math.imul(local,1664525)+1013904223)>>>0;return local/4294967296;};
    for(let i=0;i<420;i++){
      const x=staticRand()*w,y=staticRand()*h;
      const op=.07+staticRand()*.20;
      base.fillStyle="rgba(212,201,247,"+op+")";
      base.fillRect(x,y,Math.max(.7,w/2200),Math.max(.7,w/2200));
    }
  }
  function resize(){
    // Canvas texture upload cost is capped to avoid huge per-frame bandwidth.
    const ratio=Math.min(devicePixelRatio||1,innerWidth<900?1:1.15,
      Math.sqrt(1250000/Math.max(1,innerWidth*innerHeight)));
    width=Math.max(1,Math.floor(innerWidth*ratio));
    height=Math.max(1,Math.floor(innerHeight*ratio));
    for(const item of [canvas,fallback,skySource,baseSource]){
      if(item.width!==width||item.height!==height){
        item.width=width;item.height=height;
      }
    }
    rebuildSky();
    if(gl)gl.viewport(0,0,width,height);
  }
  function renderJS(time){
    if(!ctx)return;
    const w=width,h=height;
    ctx.drawImage(baseSource,0,0);
    // Three distances, four-point starlights, and a slowly drifting field.
    for(const star of stars){
      const x=((star.x+time*.00025/star.depth)%1)*w;
      const y=((star.y-time*.00012/star.depth+1)%1)*h;
      const brightness=.45+.55*Math.sin(star.phase+time*star.speed);
      const a=(.25+.5*brightness)*Math.min(1,1/star.depth);
      ctx.fillStyle=star.cold?"rgba(195,216,255,"+a+")":"rgba(240,218,255,"+a+")";
      ctx.beginPath();
      ctx.arc(x,y,star.size*(.65+.45/star.depth),0,Math.PI*2);
      ctx.fill();
    }
    for(const s of sparkle){
      const brightness=Math.pow(Math.max(0,Math.sin(time*.83+s.phase)),11);
      if(brightness<.10)continue;
      const x=s.x*w,y=s.y*h,r=s.radius*(w/1500);
      ctx.strokeStyle="rgba(241,218,255,"+(brightness*.48)+")";
      ctx.lineWidth=Math.max(.6,w/2000);
      ctx.beginPath();ctx.moveTo(x-r*3,y);ctx.lineTo(x+r*3,y);
      ctx.moveTo(x,y-r*3);ctx.lineTo(x,y+r*3);ctx.stroke();
    }
  }
  function renderWebGL(time,p,upload){
    if(!graphicReady||!gl)return;
    gl.viewport(0,0,width,height);
    gl.useProgram(shaderProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,samplerTexture);
    if(upload)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,skySource);
    gl.uniform2f(loc.resolution,width,height);
    gl.uniform1f(loc.time,time);
    gl.uniform1f(loc.progress,p);
    gl.uniform1f(loc.style,mode==="ripple"?0:mode==="stream"?1:2);
    gl.uniform1f(loc.intensity,enabled?strength:0);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }
  function videoSetup(){
    if(!(video instanceof HTMLVideoElement))return;
    const lowData=navigator.connection?.saveData;
    const sync=()=>{
      if(!allowVideo.matches||lowData){
        video.pause();video.classList.remove("is-ready");
        if(video.hasAttribute("src")){video.removeAttribute("src");video.load();}
        return;
      }
      if(!video.hasAttribute("src"))video.src=video.dataset.src||"";
      if(!document.hidden)void video.play().catch(()=>video.classList.remove("is-ready"));
    };
    video.addEventListener("playing",()=>video.classList.add("is-ready"));
    video.addEventListener("pause",()=>video.classList.remove("is-ready"));
    video.addEventListener("error",()=>video.classList.remove("is-ready"));
    allowVideo.addEventListener("change",sync);
    document.addEventListener("visibilitychange",()=>document.hidden?video.pause():sync());
    sync();
  }
  function finish(){
    if(raf)cancelAnimationFrame(raf);raf=0;finished=true;
    document.body.classList.add("is-complete");
    canvas.style.display="none";fallback.style.display="none";
    caption.style.opacity="0";progressBar.style.transform="scaleX(1)";
    progressLabel.textContent="星幕揭晓完成 · 博客背景";
    skip.disabled=true;pause.disabled=true;
  }
  function tick(now){
    raf=0;
    if(finished||paused||document.hidden){last=0;return;}
    const delta=last?Math.min(70,Math.max(0,now-last)):0;
    last=now;elapsed+=delta;
    const p=clamp(elapsed/total), t=elapsed/1000;
    const upload=(frame++ % 2===0);
    if(upload||!graphicReady)renderJS(t);
    if(graphicReady)renderWebGL(t,p,upload);
    else if(fb){
      fb.clearRect(0,0,width,height);
      fb.drawImage(skySource,0,0);
      fallback.style.opacity=String(1-smooth(.62,.98,p));
    }
    caption.style.opacity=String(smooth(.10,.30,p)*(1-smooth(.69,.93,p)));
    progressBar.style.transform="scaleX("+p+")";
    if(p>=1)finish();
    else raf=requestAnimationFrame(tick);
  }
  function begin(){
    if(raf)cancelAnimationFrame(raf);raf=0;
    elapsed=0;last=0;frame=0;finished=false;paused=false;
    document.body.classList.remove("is-complete","ready-stage");
    canvas.style.display=graphicReady?"block":"none";
    fallback.style.display=graphicReady?"none":"block";
    fallback.style.opacity="1";caption.style.opacity="0";
    progressBar.style.transform="scaleX(0)";
    progressLabel.textContent="星光苏醒 → Shader 演出 → 星幕揭晓";
    skip.disabled=false;pause.disabled=false;pause.textContent="暂停";
    if(reduce.matches||!ctx){finish();return;}
    renderJS(0);
    if(graphicReady){
      renderWebGL(0,0,true);
      // Remove the loading-color only once the first opaque GPU frame is drawn.
      document.body.classList.add("ready-stage");
    }else if(fb)fb.drawImage(skySource,0,0);
    if(!document.hidden)raf=requestAnimationFrame(tick);
  }
  function setPause(){
    if(finished)return;
    paused=!paused;pause.textContent=paused?"继续":"暂停";
    if(paused){if(raf)cancelAnimationFrame(raf);raf=0;last=0;}
    else{last=0;if(!document.hidden)raf=requestAnimationFrame(tick);}
  }
  replay.addEventListener("click",begin);
  skip.addEventListener("click",finish);
  pause.addEventListener("click",setPause);
  effectButton.addEventListener("click",()=>{
    enabled=!enabled;
    effectButton.classList.toggle("is-active",enabled);
    effectButton.textContent=enabled?"光效开":"光效关";
    effectButton.setAttribute("aria-pressed",String(enabled));
    // Shader still handles the dissolve when the artistic highlights are off.
  });
  slider.addEventListener("input",()=>{
    strength=Number(slider.value)/100;
    strengthOutput.textContent=slider.value+"%";
  });
  window.addEventListener("resize",()=>{
    resize();
    if(!finished&&!reduce.matches){
      renderJS(elapsed/1000);
      if(graphicReady)renderWebGL(elapsed/1000,clamp(elapsed/total),true);
      else if(fb)fb.drawImage(skySource,0,0);
    }
  },{passive:true});
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;last=0;}
    else if(!finished&&!paused&&!raf){last=0;raf=requestAnimationFrame(tick);}
  });
  reduce.addEventListener("change",()=>reduce.matches?finish():begin());
  canvas.addEventListener("webglcontextlost",event=>{
    event.preventDefault();graphicReady=false;gl=null;
    status.textContent="WebGL 丢失，CSS 过渡回退";
    if(!finished){
      document.body.classList.add("fallback");
      canvas.style.display="none";
      fallback.style.display="block";
    }
  });
  // The original poster/video is already below the canvas before playback.
  videoSetup();
  resize();
  if(!reduce.matches&&ctx){
    try{initializeShader();}catch(e){
      console.warn("[star-intro V4] Canvas fallback:",e);
      document.body.classList.add("fallback");
      status.textContent="WebGL 不可用 · JS 星空回退";
      graphicReady=false;
    }
  }
  begin();
})();
