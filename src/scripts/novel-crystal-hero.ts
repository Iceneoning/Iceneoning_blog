/* Starfall Library: discreet icy-blue 2D stardust and bounded pointer response.
 * No Shader/GPU context: the site video is already the atmospheric background.
 * Swup re-entry disposes listeners, observers and RAF before reattaching.
 */
import { isIntroCoveringPage } from "./intro-lifecycle";

let cleanupNovelCrystal: (() => void) | undefined;

function mountNovelCrystal() {
  cleanupNovelCrystal?.();
  cleanupNovelCrystal = undefined;
  const root = document.querySelector<HTMLElement>("[data-novel-crystal-root]");
  const canvas = root?.querySelector<HTMLCanvasElement>("[data-novel-crystal-stars]");
  if (!root || !canvas) return;
  const context = canvas.getContext("2d", { alpha:true });
  if (!context) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const narrow = window.matchMedia("(max-width:640px)");
  let visible = true, disposed = false;
  let raf=0,lastPaint=0,width=1,height=1,dpr=1;
  let px=0,py=0,targetX=0,targetY=0;
  let pointer: {x:number,y:number} | undefined;
  let appliedX="",appliedY="";
  let seed=0x71cfe31;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const stars=Array.from({length:104},()=>({
    x:random(),y:random(),radius:.55+random()*1.05,
    speed:.4+random()*.95,phase:random()*Math.PI*2,
    opacity:.12+random()*.24,accent:random()>.78
  }));
  function resize() {
    const rect=root!.getBoundingClientRect();
    const nextWidth=Math.max(1,rect.width),nextHeight=Math.max(1,rect.height);
    const nextDpr=Math.min(devicePixelRatio||1,1.3,Math.sqrt(650000/(nextWidth*nextHeight)));
    if(width===nextWidth&&height===nextHeight&&dpr===nextDpr)return;
    width=nextWidth;height=nextHeight;dpr=nextDpr;
    canvas!.width=Math.round(width*dpr);canvas!.height=Math.round(height*dpr);
    context!.setTransform(dpr,0,0,dpr,0,0);
    paint(0);
  }
  function paint(seconds:number) {
    context!.clearRect(0,0,width,height);
    for (const star of stars) {
      // Keep the reading title clear; distribute glints along the orbit and the edges.
      const x=star.x*width,y=star.y*height;
      if (star.x>.07&&star.x<.48&&star.y>.28&&star.y<.72) continue;
      const twinkle=.58+.42*Math.sin(seconds*star.speed+star.phase);
      const alpha=star.opacity*twinkle;
      context!.fillStyle=star.accent?`rgba(182,219,255,${alpha})`:`rgba(231,246,255,${alpha})`;
      context!.beginPath();context!.arc(x,y,star.radius,0,Math.PI*2);context!.fill();
      if(star.accent&&twinkle>.86&&star.radius>1.1) {
        const arm=star.radius*2.9;
        context!.strokeStyle=`rgba(217,238,255,${alpha*.45})`;
        context!.lineWidth=.7;
        context!.beginPath();
        context!.moveTo(x-arm,y);context!.lineTo(x+arm,y);
        context!.moveTo(x,y-arm);context!.lineTo(x,y+arm);
        context!.stroke();
      }
    }
  }
  function frame(now:number) {
    raf=0;
    if(disposed||document.hidden||!visible||reduced.matches||isIntroCoveringPage())return;
    // Measure the latest pointer once before writing styles, even on high-Hz mice.
    if(pointer){
      const b=root!.getBoundingClientRect();
      targetX=((pointer.x-b.left)/Math.max(b.width,1)-.5)*10;
      targetY=((pointer.y-b.top)/Math.max(b.height,1)-.5)*7;
      pointer=undefined;
    }
    px+=(targetX-px)*.09;py+=(targetY-py)*.09;
    const x=`${px.toFixed(1)}px`,y=`${py.toFixed(1)}px`;
    if(x!==appliedX){root!.style.setProperty("--crystal-move-x",x);appliedX=x;}
    if(y!==appliedY){root!.style.setProperty("--crystal-move-y",y);appliedY=y;}
    if(now-lastPaint>40){lastPaint=now;paint(now*.001);}
    raf=requestAnimationFrame(frame);
  }
  function start(){if(disposed||raf||document.hidden||!visible||reduced.matches||isIntroCoveringPage())return;raf=requestAnimationFrame(frame);}
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;}
  function onMove(event:PointerEvent){
    if(reduced.matches||narrow.matches)return;
    pointer={x:event.clientX,y:event.clientY};
  }
  function onLeave(){pointer=undefined;targetX=0;targetY=0;}
  function onVisibility(){document.hidden?stop():start();}
  function onMotion(){if(reduced.matches){stop();pointer=undefined;appliedX=appliedY="";root!.style.removeProperty("--crystal-move-x");root!.style.removeProperty("--crystal-move-y");paint(0);} else start();}
  const observer=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);visible?start():stop();},{threshold:.02});
  const resizeObserver=new ResizeObserver(resize);
  observer.observe(root);resizeObserver.observe(root);
  root.addEventListener("pointermove",onMove,{passive:true});
  root.addEventListener("pointerleave",onLeave);
  document.addEventListener("visibilitychange",onVisibility);
  document.addEventListener("site:intro-prepare",start);
  reduced.addEventListener("change",onMotion);
  resize();start();
  cleanupNovelCrystal=()=>{
    disposed=true;stop();observer.disconnect();resizeObserver.disconnect();
    root.removeEventListener("pointermove",onMove);
    root.removeEventListener("pointerleave",onLeave);
    document.removeEventListener("visibilitychange",onVisibility);
    document.removeEventListener("site:intro-prepare",start);
    reduced.removeEventListener("change",onMotion);
    root.style.removeProperty("--crystal-move-x");
    root.style.removeProperty("--crystal-move-y");
  };
}

if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",mountNovelCrystal,{once:true});
else mountNovelCrystal();
function bindNovelCrystalSwup() {
  window.swup?.hooks.on("content:replace",()=>{cleanupNovelCrystal?.();cleanupNovelCrystal=undefined;},{before:true});
  window.swup?.hooks.on("page:view",mountNovelCrystal);
}
if(window.swup?.hooks)bindNovelCrystalSwup();
else document.addEventListener("swup:enable",bindNovelCrystalSwup,{once:true});
export {};
