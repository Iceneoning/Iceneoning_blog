/*
 * V4.5 / Stellar Tide: retain luminous star populations and add adjustable subtle water-like refraction; isolated demo only.
 * JS Canvas2D builds a real starfield. WebGL1 samples that canvas as a texture,
 * activates stars with two fragmented GLSL light fronts and dissolves pixels to reveal the blog MP4.
 * No hooks into production Astro, Swup or the existing wallpaper scripts.
 */
(() => {
  "use strict";
  const mode = document.body.dataset.scene;
  if (mode !== "stellar-ripple") return;
  const $ = id => document.getElementById(id);
  const canvas = $("star-shader");
  const fallback = $("sky-fallback");
  const caption = $("intro-copy");
  const video = $("background-video");
  const replay = $("replay"), pause = $("pause"), skip = $("skip");
  const effectButton = $("fx-toggle"), slider = $("fx-strength");
  const waterSlider = $("water-strength"), waterOutput = $("water-output");
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
  let raf=0, last=0, elapsed=0, strength=0.93, waterStrength=.40, enabled=true, frame=0;
  let width=1,height=1;
  const skySource = document.createElement("canvas");
  const baseSource = document.createElement("canvas");
  const ctx=skySource.getContext("2d",{alpha:false});
  const base=baseSource.getContext("2d",{alpha:false});
  const fb=fallback.getContext("2d",{alpha:true});

  // Four deterministic depth layers. All positions are normalized top-left,
  // matching the source canvas; the Shader's UV coordinates are bottom-left.
  let seed = 774113;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const farStars=Array.from({length:560},()=>({
    x:rand(),y:rand(),size:.30+rand()*.58,phase:rand()*6.283,
    speed:.27+rand()*.63,shade:rand()>.62
  }));
  // Mid stars concentrate around four cool-blue and violet clusters.
  // Keep the central heading area relatively sparse.
  const clusterZones=[
    [.14,.18,.11,.12], [.82,.20,.13,.12],
    [.19,.80,.16,.12], [.75,.62,.11,.16]
  ];
  const midStars=Array.from({length:220},(_,i)=>{
    let x=rand(), y=rand();
    if(i<126){
      const z=clusterZones[i%clusterZones.length];
      x=Math.max(.01,Math.min(.99,z[0]+(rand()+rand()+rand()-1.5)*z[2]*2.4));
      y=Math.max(.01,Math.min(.99,z[1]+(rand()+rand()+rand()-1.5)*z[3]*2.4));
    }
    return {x,y,size:.52+rand()*1.14,phase:rand()*6.283,
      speed:.55+rand()*1.0,depth:.5+rand()*.8,shade:rand()>.56,
      cluster:i<126};
  });
  const nearStars=Array.from({length:42},()=>({
    x:rand(),y:rand(),size:1.2+rand()*1.6,
    phase:rand()*6.283,speed:.6+rand()*1.1,shade:rand()>.5
  }));
  const dust=Array.from({length:260},(_,i)=>{
    const x=rand(),band=.78-.52*x+.045*Math.sin(x*8.4);
    return {x,y:Math.max(.01,Math.min(.99,band+(rand()-.5)*.35)),
      size:.22+rand()*.57,phase:rand()*6.283,speed:.35+rand()*.5,near:i%7===0};
  });
  // Side constellations match the etched static design and react to each pulse.
  const constellations=[
    [[.07,.21],[.14,.15],[.21,.20],[.27,.10]],
    [[.76,.67],[.84,.61],[.91,.69],[.96,.58]],
    [[.09,.83],[.17,.79],[.23,.89]]
  ];
  const accents=Array.from({length:110},()=>({
    x:rand(),y:rand(),phase:rand()*6.283,speed:.55+rand()*.55,
    radius:1.05+rand()*1.55,scarce:rand()>.81
  }));
  const starRay=(x,y,r,a)=> {
    ctx.strokeStyle="rgba(225,216,255,"+a.toFixed(3)+")";
    ctx.lineWidth=Math.max(.55,width/2300);
    ctx.beginPath();
    ctx.moveTo(x-r*3.1,y);ctx.lineTo(x+r*3.1,y);
    ctx.moveTo(x,y-r*3.8);ctx.lineTo(x,y+r*3.8);
    ctx.stroke();
  };
  // The expanding stellar pulse is shared with GLSL's first and second ring.
  // Use the same camera aspect ratio and radial pacing for coherent star response.
  function pulseAt(x,y,p){
    const aspect=width/Math.max(1,height);
    const radial=Math.hypot((x-.5)*aspect,y-.5);
    const smoothMain=smooth(.14,.82,p);
    const smoothEcho=smooth(.34,.87,p);
    const main=.045+.98*smoothMain;
    const echo=.035+.81*smoothEcho;
    const signed=radial-main, echoSigned=radial-echo;
    const peak=Math.exp(-Math.pow(signed/.048,2));
    const tail=signed<0 ? Math.exp(signed/.095)*.21 : 0;
    const echoPeak=Math.exp(-Math.pow(echoSigned/.041,2))*.56;
    const echoTail=echoSigned<0 ? Math.exp(echoSigned/.086)*.12 : 0;
    return Math.min(1,Math.max(peak+tail,echoPeak+echoTail))
      *smooth(.12,.31,p)*(1-smooth(.79,.95,p));
  }
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
    uniform float u_time,u_progress,u_style,u_intensity,u_water;
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

      // V4.3: celestial resonance propagates through discrete star clusters.
      // Very faint broken traces guide the eye; most energy comes from stars.
      vec2 topUV=vec2(uv.x,1.-uv.y);
      vec2 radial=(topUV-.5)*vec2(aspect,1.);
      float angleWave=atan(radial.y,radial.x);
      float radius=length(radial);
      // One leading wave and a trailing, quieter harmonic echo.
      float mainR=.035+1.04*rise(.14,.82,p);
      float echoR=.028+.79*rise(.37,.87,p);
      float wobble=.014*sin(angleWave*7.+time*.35)
                  +.006*sin(angleWave*19.-time*.25);
      float advance=rise(.13,.27,p)*(1.-rise(.76,.91,p));
      float firstDist=radius-mainR-wobble;
      float secondDist=radius-echoR+.42*wobble;
      float parts=rise(.48,.74,noise(topUV*vec2(24.,17.)+
                        vec2(.04*time,-.028*time)));
      float parts2=rise(.51,.77,noise(topUV*vec2(29.,19.)+
                          vec2(-.035*time,.031*time)));
      // Deliberately thinner and dimmer than V4.2: not a watery ring.
      float trace=(gauss(firstDist,.0036)*parts*.092+
                   gauss(secondDist,.0029)*parts2*.061)*advance;
      float vapor=(gauss(firstDist,.014)*parts*.031+
                   gauss(secondDist,.012)*parts2*.023)*advance;

      // Variable stellar magnitudes (one star per seeded cell).
      // The jagged front lights stars where it actually reaches each cell.
      vec2 grid=vec2(58.,34.);
      vec2 tile=floor(topUV*grid);
      vec2 cell=fract(topUV*grid);
      vec2 center=vec2(hash21(tile+vec2(2.21,7.11)),
                       hash21(tile+vec2(11.17,3.53)));
      vec2 offset=cell-center;
      vec2 starUV=(tile+center)/grid;
      vec2 starPosition=(starUV-.5)*vec2(aspect,1.);
      float starAngle=atan(starPosition.y,starPosition.x);
      float radialWobble=.014*sin(7.*starAngle+time*.35)
                        +.006*sin(19.*starAngle-time*.25);
      float starRadius=length(starPosition);
      float signed=starRadius-mainR-radialWobble;
      float signedEcho=starRadius-echoR+.42*radialWobble;
      float hit=gauss(signed,.046) +
                (1.-rise(-.004,.006,signed))*exp(signed/.085)*.19;
      float echo=gauss(signedEcho,.041) +
                 (1.-rise(-.004,.006,signedEcho))*exp(signedEcho/.08)*.13;
      float present=step(.60,hash21(tile+vec2(23.4,19.2)));
      float magnitude=.37+.63*hash21(tile+vec2(4.5,6.1));
      float flare=gauss(length(offset),.075)*1.10;
      flare+=gauss(offset.x,.021)*gauss(offset.y,.23)*.39;
      flare+=gauss(offset.y,.021)*gauss(offset.x,.23)*.47;
      float echoes=flare*present*magnitude*min(1.,max(hit,echo*.62))*advance;
      // One or two brighter guiding stars accent the burst in every sector.
      float pinprick=step(.955,hash21(tile+vec2(36.2,9.2)));
      echoes+=pinprick*flare*.45*hit*advance;

      // Text remains the focal element; darken even GPU-generated glints here.
      float titleSafe=1.-.72*
         (1.-rise(.20,.35,abs(topUV.x-.5)))*
         (1.-rise(.105,.22,abs(topUV.y-.42)));
      // Starlight is still the dominant signal (not a solid water ring).
      light=(trace+vapor+echoes*1.34)*titleSafe*power;

      // V4.5: a touch of water character, using the SAME expanding fronts.
      // Very low-amplitude radial UV refraction bends the real JS star texture;
      // the broad Gaussian fringe is translucent, with a small caustic shimmer.
      // The optional water slider controls only this optical sublayer.
      float water=u_water*power*advance*titleSafe;
      float surface=(gauss(firstDist,.022)*.13+
                     gauss(secondDist,.020)*.083);
      float caustic=.72+.28*sin(angleWave*9.-time*.9);
      float fluidGlow=surface*caustic*water;
      vec2 radialNormal=normalize(radial+vec2(.0001,.0001));
      float firstWave=sin(firstDist*73.-time*1.10)*gauss(firstDist,.061);
      float secondWave=sin(secondDist*79.+time*.96)*gauss(secondDist,.052);
      float distortion=(firstWave+secondWave*.56)*.0078*water;
      shift=radialNormal/vec2(aspect,1.)*distortion;
      light+=fluidGlow;
      tint=vec3(.77,.82,1.);
      vec3 sky=texture2D(u_sky,clamp(uv+shift,0.,1.)).rgb;
      // A small complementary highlight, not full-screen whitening.
      vec3 color=mix(sky,vec3(1.,.95,1.),clamp(light*.45,0.,.40));
      color+=tint*light*.42;
      color+=vec3(.69,.80,1.)*fluidGlow*.24;

      // Fractured luminous tear with three frequency layers of value noise.
      // The small angular waves use sin(N*atan(...)) with integer N;
      // unlike the old raw-angle spirals, these are periodic at +/-PI.
      float reveal=rise(.605,.987,p);
      float d=length(q*vec2(1.0,1.045));
      float angle=atan(q.y,q.x);
      float n1=noise(uv*6.8+vec2(time*.06,-time*.025))-.5;
      float n2=noise(uv*25.0+vec2(-time*.045,time*.045))-.5;
      float n3=noise(uv*73.0+vec2(time*.028,time*.017))-.5;
      float faceted=.016*sin(5.*angle+time*.25)
                   +.008*sin(11.*angle-time*.18);
      float turbulence=n1*.087+n2*.023+n3*.004+faceted;
      float tearRadius=mix(-.15,1.30,reveal);
      float edgeDist=d+turbulence-tearRadius;
      float mask=rise(-.024,.022,edgeDist);
      float tearActive=rise(.018,.12,reveal)*(1.-rise(.945,1.,reveal));
      float rimCore=gauss(edgeDist,.0065)*tearActive;
      float rimHalo=gauss(edgeDist,.038)*tearActive;
      // High-frequency, narrowly confined glints: no blocky 10-20 px noise patches.
      float chipped=noise(uv*205.+vec2(time*.08,-time*.035));
      float shatter=smoothstep(.86,.97,chipped)*gauss(edgeDist,.018)*tearActive;
      vec3 edgeTint=mix(vec3(.56,.69,1.),vec3(1.,.81,.98),
                        clamp(noise(uv*10.+.17),0.,1.));
      color+=edgeTint*(rimCore*.50+rimHalo*.15+shatter*.18)*
                     (.72+.22*power);
      // Keep the torn border luminous while ensuring the center is transparent.
      float alpha=clamp(mask+rimCore*.14+shatter*.08,0.,1.);
      alpha*=1.-rise(.985,1.,p);
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
      water:gl.getUniformLocation(shaderProgram,"u_water"),
      sky:gl.getUniformLocation(shaderProgram,"u_sky")
    };
    gl.uniform1i(loc.sky,0);
    gl.disable(gl.BLEND);
    graphicReady=true;
    status.textContent="WebGL · 星水涟漪 / 星空揭晓";
  }
  function rebuildSky(){
    if(!base)return;
    const w=width,h=height;
    const dark=base.createLinearGradient(0,0,w,h);
    dark.addColorStop(0,"#070a1a");
    dark.addColorStop(.30,"#0b1030");
    dark.addColorStop(.69,"#1c1240");
    dark.addColorStop(1,"#0a0b24");
    base.fillStyle=dark;base.fillRect(0,0,w,h);

    // A diagonal Milky Way with multiple smaller localized color clouds,
    // never one opaque gray or white fog sheet.
    const banks=[
      [.04,.81,.24,.24,.13], [.19,.71,.30,.26,.15],
      [.36,.63,.32,.26,.12], [.52,.52,.29,.29,.14],
      [.68,.40,.28,.27,.17], [.87,.26,.24,.28,.12],
      [.18,.20,.21,.20,.09], [.77,.77,.23,.17,.08]
    ];
    for(const [x,y,rx,ry,alpha] of banks){
      base.save();
      base.translate(x*w,y*h);
      base.scale(1,Math.max(.5,ry/rx));
      const radius=Math.max(w,h)*rx;
      const cloud=base.createRadialGradient(0,0,0,0,0,radius);
      const cool=(x>.54&&y<.55)||(x<.23&&y>.64);
      cloud.addColorStop(0,cool?
        "rgba(70,132,208,"+Math.min(.27,alpha*1.22)+")":
        "rgba(136,99,202,"+Math.min(.24,alpha*1.12)+")");
      cloud.addColorStop(.44,cool?
        "rgba(49,104,168,"+(alpha*.53)+")":
        "rgba(78,63,153,"+(alpha*.49)+")");
      cloud.addColorStop(1,"rgba(35,27,96,0)");
      base.fillStyle=cloud;
      base.fillRect(-radius,-radius,radius*2,radius*2);
      base.restore();
    }

    let local=3811;
    const staticRand=()=>{local=(Math.imul(local,1664525)+1013904223)>>>0;return local/4294967296;};
    // High density distant pinpricks clustered around a diagonal galactic lane.
    for(let i=0;i<1950;i++){
      let x=staticRand(), y=staticRand();
      if(i<1280){
        x=staticRand();
        const track=.81-.54*x+.06*Math.sin(x*6.5);
        y=Math.max(0,Math.min(1,track+(staticRand()+staticRand()+staticRand()-1.5)*.11));
      }
      const alpha=.052+staticRand()*.27;
      const size=(.30+staticRand()*.73)*Math.min(1.15,w/1450);
      base.fillStyle=i%11===0?
        "rgba(216,186,247,"+alpha+")":
        "rgba(192,215,255,"+alpha+")";
      base.fillRect(x*w,y*h,Math.max(.42,size),Math.max(.42,size));
    }
    // Tiny etched constellations near the sides, never behind the title.
    base.strokeStyle="rgba(185,180,244,.17)";
    base.fillStyle="rgba(220,215,255,.36)";
    base.lineWidth=Math.max(.55,w/2400);
    for(const chain of constellations){
      base.beginPath();
      chain.forEach(([x,y],i)=>{
        if(i===0)base.moveTo(x*w,y*h);
        else base.lineTo(x*w,y*h);
      });
      base.stroke();
      chain.forEach(([x,y])=>{
        base.beginPath();base.arc(x*w,y*h,Math.max(.7,w/1600),0,6.28318);base.fill();
      });
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
  function renderJS(time,p){
    if(!ctx)return;
    const w=width,h=height;
    ctx.drawImage(baseSource,0,0);
    const maxBrightness=Math.min(1.8,strength);
    const active=enabled ? maxBrightness : 0;
    const withinText=(x,y)=>Math.abs(x-.5)<.25&&y>.28&&y<.57;

    // Far: small and slow, gently breathing independently.
    for(const s of farStars){
      const x=(s.x+time*.000038)%1;
      const y=(s.y+time*.000013)%1;
      const breath=.72+.28*Math.sin(s.phase+time*s.speed);
      const pulse=pulseAt(x,y,p)*active;
      const a=(.10+.17*breath+.39*pulse)*(withinText(x,y)?.54:1);
      ctx.fillStyle=s.shade?"rgba(203,220,255,"+a.toFixed(3)+")":
                             "rgba(215,195,246,"+a.toFixed(3)+")";
      ctx.fillRect(x*w,y*h,Math.max(.55,s.size),Math.max(.55,s.size));
    }
    // Mid: pale violet and icy blue points, visible depth drift.
    for(const s of midStars){
      const x=(s.x+time*.00020*s.depth)%1;
      const y=(s.y-time*.000083*s.depth+1)%1;
      const breath=.54+.46*Math.sin(s.phase+time*s.speed);
      const pulse=pulseAt(x,y,p)*active;
      const glowA=(.18+.34*breath+.49*pulse)*(withinText(x,y)?.55:1);
      const size=s.size*(1+pulse*.36);
      ctx.fillStyle=s.shade?"rgba(188,212,255,"+glowA.toFixed(3)+")":
                             "rgba(238,216,255,"+glowA.toFixed(3)+")";
      ctx.beginPath();ctx.arc(x*w,y*h,size,0,6.28318);ctx.fill();
      if(pulse>.37&&s.size>.91)starRay(x*w,y*h,size,pulse*.24);
    }
    // Near: only a few luminous four-point stars that breathe, not glitter spam.
    for(const s of nearStars){
      const x=(s.x+time*.00039)%1,y=(s.y+time*.00014)%1;
      const breathe=Math.pow(Math.max(0,.5+.5*Math.sin(time*s.speed+s.phase)),5);
      const pulse=pulseAt(x,y,p)*active;
      const a=Math.min(.84,.12+.35*breathe+.51*pulse)*
              (withinText(x,y)?.36:1);
      if(a<.14)continue;
      const r=s.size*(.75+.15*breathe+.3*pulse);
      // Local radial point glow: much smaller than broad fog.
      const halo=ctx.createRadialGradient(x*w,y*h,0,x*w,y*h,r*6);
      halo.addColorStop(0,"rgba(230,218,255,"+Math.min(.40,a*.45).toFixed(3)+")");
      halo.addColorStop(1,"rgba(143,111,233,0)");
      ctx.fillStyle=halo;ctx.fillRect(x*w-r*6,y*h-r*6,r*12,r*12);
      starRay(x*w,y*h,r,a*.43);
      ctx.fillStyle="rgba(246,238,255,"+a.toFixed(3)+")";
      ctx.beginPath();ctx.arc(x*w,y*h,r*.42,0,6.28318);ctx.fill();
    }
    // Galactic dust: tiny particles near the luminous diagonal lane.
    for(const s of dust){
      const x=(s.x+time*(s.near?.00031:.000075))%1;
      const y=(s.y+time*.000036)%1;
      const pStar=pulseAt(x,y,p)*active;
      const twinkle=.56+.44*Math.sin(s.phase+time*s.speed);
      const a=Math.max(.05,Math.min(.46,.10+.13*twinkle+.27*pStar));
      ctx.fillStyle=s.near?"rgba(234,198,255,"+a.toFixed(3)+")":
                            "rgba(181,193,245,"+a.toFixed(3)+")";
      ctx.fillRect(x*w,y*h,Math.max(.45,s.size),Math.max(.45,s.size));
    }
    // Punctuated near-field glints: low density and asynchronously phased.
    for(const s of accents){
      const x=(s.x+time*.00018)%1;
      const y=(s.y-time*.00005+1)%1;
      const resonance=pulseAt(x,y,p)*active;
      const shimmer=Math.pow(Math.max(0,.5+.5*Math.sin(s.phase+time*s.speed)),14);
      const alpha=(.07+.22*shimmer+.28*resonance)*
                  (withinText(x,y)?.4:1);
      if(alpha<.14)continue;
      const px=x*w,py=y*h;
      if(s.scarce && alpha>.33)starRay(px,py,s.radius,alpha*.42);
      ctx.fillStyle="rgba(215,228,255,"+Math.min(.7,alpha).toFixed(3)+")";
      ctx.beginPath();ctx.arc(px,py,s.radius*.49,0,6.28318);ctx.fill();
    }
    // Quiet edge-only micro meteors. Short tails do not cross the center title.
    for(let i=0;i<2;i++){
      const cycle=((time*.095+i*.47)%1);
      const x=(i===0?.05:.81)+cycle*.13;
      const y=(i===0?.15:.80)-cycle*.04;
      const fade=Math.pow(Math.sin(Math.PI*cycle),5);
      if(fade<.045)continue;
      const px=x*w,py=y*h,len=(8+9*fade)*Math.min(1,w/1450);
      const trail=ctx.createLinearGradient(px-len,py+len*.32,px,py);
      trail.addColorStop(0,"rgba(188,207,255,0)");
      trail.addColorStop(1,"rgba(232,215,255,"+(fade*.36).toFixed(3)+")");
      ctx.strokeStyle=trail;ctx.lineWidth=.75;
      ctx.beginPath();ctx.moveTo(px-len,py+len*.32);ctx.lineTo(px,py);ctx.stroke();
    }
    // A constellation node briefly responds when the stellar echo reaches it.
    for(const chain of constellations){
      for(const [x,y] of chain){
        const resonance=pulseAt(x,y,p)*active;
        if(resonance<.10)continue;
        const px=x*w,py=y*h,alpha=Math.min(.65,resonance*.45);
        const halo=ctx.createRadialGradient(px,py,0,px,py,11);
        halo.addColorStop(0,"rgba(225,226,255,"+alpha.toFixed(3)+")");
        halo.addColorStop(1,"rgba(122,122,215,0)");
        ctx.fillStyle=halo;ctx.fillRect(px-11,py-11,22,22);
      }
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
    gl.uniform1f(loc.style,2);
    gl.uniform1f(loc.intensity,enabled?strength:0);
    gl.uniform1f(loc.water,waterStrength);
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
    if(upload||!graphicReady)renderJS(t,p);
    if(graphicReady)renderWebGL(t,p,upload);
    else if(fb){
      fb.clearRect(0,0,width,height);
      fb.drawImage(skySource,0,0);
      fallback.style.opacity=String(1-smooth(.62,.98,p));
    }
    caption.style.opacity=String(smooth(.11,.30,p)*(1-smooth(.50,.68,p)));
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
    progressLabel.textContent="繁星苏醒 → 星水涟漪 → 星幕揭晓";
    skip.disabled=false;pause.disabled=false;pause.textContent="暂停";
    if(reduce.matches||!ctx){finish();return;}
    renderJS(0,0);
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
  function refreshPausedFrame(){
    if(!paused||finished||document.hidden||reduce.matches)return;
    const p=clamp(elapsed/total), t=elapsed/1000;
    renderJS(t,p);
    if(graphicReady)renderWebGL(t,p,true);
    else if(fb){fb.clearRect(0,0,width,height);fb.drawImage(skySource,0,0);}
  }
  replay.addEventListener("click",begin);
  skip.addEventListener("click",finish);
  pause.addEventListener("click",setPause);
  effectButton.addEventListener("click",()=>{
    enabled=!enabled;
    effectButton.classList.toggle("is-active",enabled);
    effectButton.textContent=enabled?"星纹开":"星纹关";
    effectButton.setAttribute("aria-pressed",String(enabled));
    refreshPausedFrame();
    // Shader still handles the dissolve when the artistic highlights are off.
  });
  slider.addEventListener("input",()=>{
    strength=Number(slider.value)/100;
    strengthOutput.textContent=slider.value+"%";
    refreshPausedFrame();
  });
  waterSlider.addEventListener("input",()=>{
    waterStrength=Number(waterSlider.value)/100;
    waterOutput.textContent=waterSlider.value+"%";
    refreshPausedFrame();
  });
  window.addEventListener("resize",()=>{
    resize();
    if(!finished&&!reduce.matches){
      renderJS(elapsed/1000,clamp(elapsed/total));
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
