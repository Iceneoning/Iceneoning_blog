/* V3 isolated preview: original poster/MP4 stays visible; Canvas2D adds only
 * sparse stardust; WebGL1 highlights existing artwork light ribbons and arcs.
 * On intro completion the same Shader keeps running at reduced intensity.
 * All controls are local to this preview; production blog files are untouched. */
(() => {
  "use strict";
  const mode = document.body.dataset.scene;
  if (!["weave", "meteor", "ripple"].includes(mode)) return;

  const sky = document.getElementById("sky-layer");
  const fx = document.getElementById("fx-layer");
  const caption = document.getElementById("intro-copy");
  const video = document.getElementById("background-video");
  const progress = document.getElementById("progress-bar");
  const status = document.getElementById("status-label");
  const replay = document.getElementById("replay");
  const skip = document.getElementById("skip");
  const pause = document.getElementById("pause");
  const toggle = document.getElementById("shader-toggle");
  const intensityInput = document.getElementById("shader-intensity");
  const intensityValue = document.getElementById("shader-value");
  const solo = document.getElementById("shader-solo");
  const shaderState = document.getElementById("shader-state");
  if (!(sky instanceof HTMLCanvasElement) || !(fx instanceof HTMLCanvasElement)) return;

  const context = sky.getContext("2d", {alpha:true});
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const staticLayout = window.matchMedia("(max-width:900px), (pointer:coarse)");
  const allowVideo = window.matchMedia("(min-width:901px) and (pointer:fine) and (prefers-reduced-motion:no-preference)");
  const DURATION = 3300;
  const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
  const smooth = (a,b,x) => {const p=clamp((x-a)/(b-a));return p*p*(3-2*p);};
  let gl=null, program=null, attribBuffer=null, locations=null;
  let frame=0, prev=0, clock=0, introTime=0, ambient=false;
  let paused=false, shaderOn=true, shaderSolo=false;
  let shaderIntensity=1.15, shaderAvailable=false;
  let width=0,height=0, scale=1, cover=[0,0,1,1];
  const points = [];
  let seed=718193;
  function rand() { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296; }
  for(let i=0;i<115;i++) {
    points.push({x:rand(),y:rand(),r:.35+rand()*.85,depth:.35+rand()*.65,
      twinkle:rand()*6.283,rate:.6+rand()*1.6,amp:.24+rand()*.42});
  }

  const vertexSource = `
    attribute vec2 a_position;
    void main(){ gl_Position=vec4(a_position,0.,1.); }
  `;
  const fragmentSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform vec4 u_cover;
    uniform float u_time, u_progress, u_ambient, u_scene, u_strength;

    float soft(float x,float a,float b){return smoothstep(a,b,x);}
    float glow(float delta,float width){return exp(-pow(delta/width,2.));}
    float spark(vec2 q,vec2 center,float size){
      vec2 d=(q-center)/size;
      float core=exp(-dot(d,d)*2.4);
      float cross=exp(-abs(d.x)*3.1)*exp(-abs(d.y)*.22)
                +exp(-abs(d.y)*3.1)*exp(-abs(d.x)*.22);
      return core*.78+cross*.15;
    }
    // Align effects in artwork UV: normalized original 16:9 poster/video space.
    // Bottom-up GL pixel positions are converted to top-down artwork positions.
    void main(){
      vec2 screen=vec2(gl_FragCoord.x/u_resolution.x,1.-gl_FragCoord.y/u_resolution.y);
      vec2 q=(screen-u_cover.xy)/u_cover.zw;
      if(q.x<-.06||q.x>1.06||q.y<-.06||q.y>1.06){
        gl_FragColor=vec4(0.);return;
      }
      float t=u_time;
      float intro=1.-u_ambient;
      float swell=soft(.08,.4,u_progress)*(1.-soft(.76,.98,u_progress));
      float base=mix(.34,1.05,intro);
      float energy=base + intro*swell*1.05;
      float left=0.,right=0.,orbit=0.,wave=0.,stars=0.;

      // The source artwork already has two vertical luminous strands near
      // image x=.285 and x=.655, so brighten rather than replace them.
      float ly=.277 + .012*sin(q.y*11.+.45)+.009*sin(q.y*24.-.6);
      float ry=.652 + .016*sin(q.y*10.+2.1)-.007*sin(q.y*23.);
      float leftMask=soft(.02,.13,q.y)*(1.-soft(.89,.98,q.y));
      float rightMask=soft(.05,.15,q.y)*(1.-soft(.92,.99,q.y));
      float scrollL=pow(.5+.5*sin(q.y*70.-t*3.15),7.);
      float scrollR=pow(.5+.5*sin(q.y*68.+t*2.75),7.);
      left=(glow(q.x-ly,.0023)*.56+glow(q.x-ly,.014)*.19+glow(q.x-ly-.015,.0025)*.18)*leftMask*(.44+.56*scrollL);
      right=(glow(q.x-ry,.0024)*.62+glow(q.x-ry,.015)*.22+glow(q.x-ry+.017,.0025)*.17)*rightMask*(.44+.56*scrollR);
      vec2 handL=vec2(.285,.51), handR=vec2(.650,.52);
      float handSpark=spark(q,handL,.023)*(.10+.13*pow(.5+.5*sin(t*3.2),3.))
                     +spark(q,handR,.020)*(.12+.12*pow(.5+.5*sin(t*2.8+1.),3.));

      // Thin right-hand sky trails follow the poster's existing constellation arcs.
      float band=soft(.62,.73,q.x)*(1.-soft(1.0,1.07,q.x));
      float arcY=.39-.23*(q.x-.66)+.011*sin((q.x-.65)*11.);
      float arcY2=.34-.20*(q.x-.66)+.009*sin((q.x-.65)*13.+1.);
      float travelling=pow(.5+.5*sin(q.x*37.-t*1.6),6.);
      orbit=(glow(q.y-arcY,.0032)*.49+glow(q.y-arcY2,.0025)*.28)*band*(.48+.52*travelling);

      // Ripple is a low-opacity arc projected through artwork space.
      // One opening pulse, then a much subtler slow periodic background cycle.
      vec2 center=vec2(.52,.51);
      float angle=atan((q.y-center.y), (q.x-center.x)*1.12);
      float dist=length((q-center)*vec2(1.02,1.32));
      float phase=fract(t*.092);
      float radius=mix(.055,.62, mix(soft(.15,.85,u_progress),phase,u_ambient));
      float waviness=.011*sin(angle*6.+t*.35)+.009*sin(angle*13.-t*.17);
      float ring=glow(dist-radius-waviness,.008)+glow(dist-radius-.060-waviness*.4,.012)*.4;
      float sector=.58+.42*sin(angle*4.5+t*.33);
      wave=ring*sector*(1.-soft(.77,.94,dist));
      float waveGain= mix(.67,.10,u_ambient); // Ambient ripple should rarely compete with the source.
      wave*=waveGain;

      // Extra star accents are sparse and anchored mostly away from the face.
      stars=spark(q,vec2(.18,.09),.011)*.35
           +spark(q,vec2(.86,.19),.010)*.27
           +spark(q,vec2(.80,.70),.010)*.24
           +spark(q,vec2(.10,.61),.012)*.32;
      stars*=.60+.4*pow(.5+.5*sin(t*1.8),4.);

      float l=left*.70+right*.85+handSpark*.65+orbit*.56;
      if(u_scene<.5){l+=stars*.60+wave*.55;}
      else if(u_scene<1.5){
        // Short meteor streak travels along the existing arc rather than crossing the face.
        float travel=fract(t*.18+.07);
        vec2 tip=vec2(.66+travel*.48,.42-travel*.20);
        vec2 d=q-tip;
        float along=dot(d,normalize(vec2(-1.,.43)));
        float across=abs(d.x*.395+d.y*.919);
        float trail=exp(-pow(across/.006,2.))*soft(0.,.04,along)*(1.-soft(.26,.57,along));
        l+=(trail*.60+glow(length(d),.014)*.48)*mix(.48,.22,u_ambient);
        l+=stars*.32+wave*.24;
      }else{l+=wave*1.8+stars*.35;}
      l*=energy*u_strength;
      // Additive-looking lavender/gold alpha over the true wallpaper.
      vec3 pale=vec3(.90,.80,1.0);
      vec3 gold=vec3(1.,.92,.72);
      vec3 color=mix(pale,gold,clamp(scrollL*.23+scrollR*.28,0.,.46));
      float alpha=clamp(l,0.,.80);
      gl_FragColor=vec4(color,alpha);
    }
  `;

  function compile(type,text){
    const shader=gl.createShader(type);
    if(!shader)throw Error("WebGL shader allocation failed");
    gl.shaderSource(shader,text);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
      const log=gl.getShaderInfoLog(shader)||"GLSL compilation failed";
      gl.deleteShader(shader);throw Error(log);
    }
    return shader;
  }
  function initShader(){
    try{
      gl=fx.getContext("webgl",{alpha:true,premultipliedAlpha:false,
        depth:false,antialias:false,stencil:false,preserveDrawingBuffer:false});
      if(!gl)throw Error("WebGL unavailable");
      const vert=compile(gl.VERTEX_SHADER,vertexSource);
      const frag=compile(gl.FRAGMENT_SHADER,fragmentSource);
      program=gl.createProgram();
      if(!program)throw Error("Program allocation failed");
      gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);
      gl.deleteShader(vert);gl.deleteShader(frag);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(program)||"GLSL link failed");
      attribBuffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,attribBuffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      gl.useProgram(program);
      const attribute=gl.getAttribLocation(program,"a_position");
      gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
      locations={
        resolution:gl.getUniformLocation(program,"u_resolution"),
        cover:gl.getUniformLocation(program,"u_cover"),
        time:gl.getUniformLocation(program,"u_time"),
        progress:gl.getUniformLocation(program,"u_progress"),
        ambient:gl.getUniformLocation(program,"u_ambient"),
        scene:gl.getUniformLocation(program,"u_scene"),
        strength:gl.getUniformLocation(program,"u_strength")
      };
      // An alpha WebGL canvas is composited by the browser over the MP4.
      // There is no independent dark background and no full-screen color layer.
      gl.disable(gl.BLEND);
      shaderAvailable=true;
      shaderState.textContent="WebGL Shader 正常";
      return true;
    }catch(e){
      shaderState.textContent="Shader 不可用 · 仅 JS 星尘";
      console.error("[star intro V3] Shader:",e);
      gl=null;shaderAvailable=false;
      return false;
    }
  }
  function updateCover(){
    // CSS object-fit:cover. Preserve alignment of shader with poster/video.
    const w=innerWidth,h=innerHeight;
    const fitting=Math.max(w/1920,h/1080);
    const actualW=1920*fitting,actualH=1080*fitting;
    cover=[(w-actualW)/(2*w),(h-actualH)/(2*h),actualW/w,actualH/h];
  }
  function resize(){
    const maxPixels=2050000;
    scale=Math.min(devicePixelRatio||1,innerWidth<900?1:1.2,
      Math.sqrt(maxPixels/Math.max(1,innerWidth*innerHeight)));
    width=Math.max(1,Math.floor(innerWidth*scale));
    height=Math.max(1,Math.floor(innerHeight*scale));
    for(const canvas of [sky,fx]) {
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    }
    if(gl)gl.viewport(0,0,width,height);
    updateCover();
  }
  function drawParticles(time,phase){
    if(!context)return;
    context.clearRect(0,0,width,height); // transparency is essential
    if(shaderSolo)return;
    const gain=phase? .32 : .75;
    const ratioX=cover[2],ratioY=cover[3];
    const posX=cover[0],posY=cover[1];
    // Particle UV coordinates are anchored to the artwork rather than a different star sky.
    for(const p of points){
      const px=((p.x+time*.0015*p.depth)%1)*ratioX+posX;
      const py=((p.y-time*.0008*p.depth+1)%1)*ratioY+posY;
      if(px<0||px>1||py<0||py>1)continue;
      const a=gain*p.amp*(.55+.45*Math.sin(time*p.rate+p.twinkle));
      const x=px*width,y=py*height;
      context.beginPath();
      context.fillStyle="rgba(237,223,255,"+Math.max(.03,a).toFixed(3)+")";
      context.arc(x,y,Math.max(.4,p.r*scale),0,Math.PI*2);context.fill();
    }
  }
  function drawShader(time,p,phase){
    if(!gl||!shaderOn||!shaderAvailable)return;
    gl.viewport(0,0,width,height);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(locations.resolution,width,height);
    gl.uniform4f(locations.cover,...cover);
    gl.uniform1f(locations.time,time);
    gl.uniform1f(locations.progress,p);
    gl.uniform1f(locations.ambient,phase?1:0);
    gl.uniform1f(locations.scene,mode==="weave"?0:mode==="meteor"?1:2);
    gl.uniform1f(locations.strength,shaderIntensity);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }
  function setStatus(){
    if(reduceMotion.matches||staticLayout.matches){status.textContent="静态背景回退 · 动画已关闭";return;}
    if(paused){status.textContent="已暂停 · 可继续或重播";return;}
    status.textContent=ambient?"常驻装饰 · Shader 持续低强度运行":"开场演出 · 星丝与涟漪共鸣";
  }
  function setAmbient(){
    ambient=true;introTime=DURATION;document.body.classList.add("is-complete");
    progress.style.transform="scaleX(1)";
    caption.style.opacity="0";
    skip.disabled=true;
    setStatus();
  }
  function stopFrame(){if(frame)cancelAnimationFrame(frame);frame=0;}
  function animate(now){
    frame=0;
    if(document.hidden||paused)return;
    const delta=prev?Math.min(75,Math.max(0,now-prev)):0;
    prev=now;clock+=delta;
    if(!ambient){
      introTime+=delta;
      if(introTime>=DURATION)setAmbient();
    }
    const p=clamp(introTime/DURATION);
    const t=clock/1000;
    if(!ambient){
      caption.style.opacity=String(smooth(.12,.3,p)*(1-smooth(.72,.96,p)));
      progress.style.transform="scaleX("+p+")";
    }
    // 60 Hz animation -> ~24 Hz ambient, retaining gentle motion at low cost.
    if(ambient && now-lastDraw<42){frame=requestAnimationFrame(animate);return;}
    lastDraw=now;
    drawParticles(t,ambient);
    drawShader(t,p,ambient);
    frame=requestAnimationFrame(animate);
  }
  let lastDraw=-Infinity;
  function start(){
    stopFrame();ambient=false;introTime=0;prev=0;clock=0;lastDraw=-Infinity;
    document.body.classList.remove("is-complete");
    caption.style.opacity="0";progress.style.transform="scaleX(0)";
    skip.disabled=false;pause.disabled=false;pause.textContent="暂停";paused=false;
    if(reduceMotion.matches||staticLayout.matches||!context){
      sky.style.display="none";fx.style.display="none";setAmbient();
      pause.disabled=true;return;
    }
    sky.style.display="block";fx.style.display=shaderAvailable?"block":"none";
    setStatus();
    drawParticles(0,false);drawShader(0,0,false);
    frame=requestAnimationFrame(animate);
  }
  function setPause(){
    if(reduceMotion.matches||staticLayout.matches)return;
    paused=!paused;
    pause.textContent=paused?"继续":"暂停";
    setStatus();
    if(paused){stopFrame();prev=0;}
    else{prev=0;frame=requestAnimationFrame(animate);}
  }
  function setShaderState(value){
    shaderOn=value;
    toggle.classList.toggle("is-active",value);
    toggle.setAttribute("aria-pressed",String(value));
    toggle.textContent=value?"Shader 开":"Shader 关";
    fx.style.visibility=value&&shaderAvailable?"visible":"hidden";
  }
  function syncVideo(){
    if(!(video instanceof HTMLVideoElement))return;
    const saveData=navigator.connection?.saveData;
    if(!allowVideo.matches||saveData){
      video.pause();
      video.classList.remove("is-ready");
      if(video.hasAttribute("src")){video.removeAttribute("src");video.load();}
      return;
    }
    if(!video.hasAttribute("src"))video.src=video.dataset.src||"";
    if(!document.hidden)void video.play().catch(()=>video.classList.remove("is-ready"));
  }
  if(video instanceof HTMLVideoElement){
    video.addEventListener("playing",()=>video.classList.add("is-ready"));
    video.addEventListener("pause",()=>video.classList.remove("is-ready"));
    video.addEventListener("error",()=>video.classList.remove("is-ready"));
  }
  replay.addEventListener("click",start);
  skip.addEventListener("click",()=>{setAmbient();prev=0;});
  pause.addEventListener("click",setPause);
  toggle.addEventListener("click",()=>setShaderState(!shaderOn));
  solo.addEventListener("click",()=>{
    shaderSolo=!shaderSolo;
    solo.classList.toggle("is-active",shaderSolo);
    solo.setAttribute("aria-pressed",String(shaderSolo));
    document.body.classList.toggle("is-debug",shaderSolo);
  });
  intensityInput.addEventListener("input",()=>{
    shaderIntensity=Number(intensityInput.value)/100;
    intensityValue.textContent=intensityInput.value+"%";
  });
  window.addEventListener("resize",resize,{passive:true});
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){stopFrame();prev=0;if(video instanceof HTMLVideoElement)video.pause();}
    else{syncVideo();prev=0;if(!paused&&!reduceMotion.matches&&!staticLayout.matches)frame=requestAnimationFrame(animate);}
  });
  allowVideo.addEventListener("change",syncVideo);
  reduceMotion.addEventListener("change",()=>{syncVideo();start();});
  staticLayout.addEventListener("change",()=>{syncVideo();start();});
  fx.addEventListener("webglcontextlost",(event)=>{
    event.preventDefault();shaderAvailable=false;gl=null;
    shaderState.textContent="Shader 上下文丢失 · 仅 JS 星尘";
    fx.style.display="none";
  });
  fx.addEventListener("webglcontextrestored",()=>{
    if(initShader()){resize();fx.style.display="block";setShaderState(shaderOn);}
  });
  // Force reduced-motion to show the base artwork even if JS initialization fails.
  syncVideo();
  resize();
  if(!reduceMotion.matches)initShader();
  setShaderState(true);
  start();
})();
