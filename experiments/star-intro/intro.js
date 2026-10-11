/*
 * Standalone, zero-dependency WebGL1 intro lab.
 * No Astro imports, no global listeners outside this demo, and no page transition hooks.
 */
(() => {
  "use strict";

  const scene = document.body.dataset.scene;
  if (!scene) return;

  const canvas = document.getElementById("star-shader");
  const replayButton = document.getElementById("replay");
  const skipButton = document.getElementById("skip");
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const duration = { veil: 3000, meteor: 2800, ripple: 3200 }[scene] ?? 3000;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const vertexShader = `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
  `;

  const fragmentCommon = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_progress;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }
    float softPoint(vec2 p, vec2 center, float size) {
      float dist = length(p - center);
      return exp(-dist * dist / (size * size));
    }
    float stars(vec2 q, float scale) {
      vec2 p = q * scale;
      vec2 tile = floor(p);
      vec2 local = fract(p);
      vec2 location = vec2(hash21(tile + 0.27), hash21(tile + 7.13));
      float chance = step(0.79, hash21(tile + 17.33));
      float radius = mix(0.020, 0.067, hash21(tile + 4.15));
      float glow = softPoint(local, location, radius);
      float twinkle = 0.67 + 0.33 * sin(u_time * 2.7 + hash21(tile + 9.19) * 6.283);
      return chance * glow * twinkle;
    }
    float segment(vec2 p, vec2 a, vec2 b, float width) {
      vec2 dir = b - a;
      float fraction = clamp(dot(p - a, dir) / max(dot(dir, dir), .00001), 0.0, 1.0);
      float distanceToSegment = length(p - a - dir * fraction);
      return 1.0 - smoothstep(width, width * 2.3, distanceToSegment);
    }
    float smoothRise(float a, float b, float t) { return smoothstep(a, b, t); }
  `;

  const fragments = {
    veil: `
      void main() {
        vec2 q = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
        float p = u_progress;
        float expansion = smoothRise(.27, .91, p);
        float aperture = mix(-.12, 1.55, expansion);
        float curtain = 1.0 - smoothstep(aperture - .12, aperture + .07, length(q));
        float darkness = .87 * (1.0 - curtain) * (1.0 - smoothRise(.87, 1.0, p));
        float appear = smoothRise(.08, .35, p) * (1.0 - smoothRise(.62, .95, p));

        // Constellations are placed toward the edges, away from the heroine.
        vec2 a = vec2(-.74, .31), b = vec2(-.51, .43), c = vec2(-.32, .29);
        vec2 d = vec2(.47, -.29), e = vec2(.68, -.18), f = vec2(.81, -.35);
        float lines = segment(q,a,b,.0012) + segment(q,b,c,.0012)
                    + segment(q,d,e,.0012) + segment(q,e,f,.0012);
        float nodes = softPoint(q,a,.008) + softPoint(q,b,.008)
                    + softPoint(q,c,.008) + softPoint(q,d,.008)
                    + softPoint(q,e,.008) + softPoint(q,f,.008);
        float pinpricks = stars(q + vec2(.04, .07), 29.0) * .52;
        float edge = (1.0 - smoothstep(.002, .018, abs(length(q) - aperture)))
                   * smoothRise(.32, .44, p) * (1.0 - smoothRise(.87, 1.0, p));
        float light = (lines * .27 + nodes * .58 + pinpricks * .55) * appear
                    + edge * .21;
        vec3 color = mix(vec3(.016,.011,.048), vec3(.77,.74,1.0), clamp(light * 2.0,0.0,1.0));
        gl_FragColor = vec4(color, clamp(darkness + light, 0.0, .94));
      }
    `,
    meteor: `
      float streak(vec2 q, vec2 tip, vec2 dir, float len) {
        vec2 back = tip - q;
        float along = dot(back, dir);
        float transverse = abs(back.x * dir.y - back.y * dir.x);
        float width = .0026 + .009 * clamp(along / len, 0.0, 1.0);
        float thinTrail = exp(-pow(transverse / width, 2.0))
                        * smoothstep(-.01, .025, along)
                        * (1.0 - smoothstep(len * .52, len, along));
        float head = softPoint(q, tip, .012);
        return thinTrail * .56 + head * .82;
      }
      void main() {
        vec2 q = (gl_FragCoord.xy - .5*u_resolution)/u_resolution.y;
        float p = u_progress;
        float present = smoothRise(.06,.24,p) * (1.0 - smoothRise(.72,.98,p));
        float darkness = .75 * (1.0 - smoothRise(.18,.96,p));
        vec2 velocity = normalize(vec2(1.0,-.39));
        vec2 one = mix(vec2(-1.25,.66),vec2(1.36,-.36), smoothRise(.09,.80,p));
        vec2 two = mix(vec2(-1.42,.31),vec2(1.20,-.70), smoothRise(.26,.90,p));
        vec2 three = mix(vec2(-1.36,.93),vec2(.82,.08), smoothRise(.33,.92,p));
        float trails = streak(q,one,velocity,.48)
                     + streak(q,two,velocity,.35)*.61
                     + streak(q,three,velocity,.28)*.39;
        float dust = stars(q + vec2(u_time*.018,-u_time*.006),31.0)*.24;
        float light = (trails + dust)*present;
        vec3 color = mix(vec3(.014,.010,.043),vec3(.78,.72,1.0),clamp(light*2.0,0.0,1.0));
        gl_FragColor = vec4(color,clamp(darkness + light,0.0,.91));
      }
    `,
    ripple: `
      void main() {
        vec2 q = (gl_FragCoord.xy - .5*u_resolution)/u_resolution.y;
        float p = u_progress;
        float active = smoothRise(.07,.25,p) * (1.0 - smoothRise(.68,.97,p));
        float darkness = .76 * (1.0 - smoothRise(.18,.96,p));
        // The circle is slightly off-center to avoid holding light over the face.
        vec2 v = q - vec2(-.10,.045);
        float radius = length(v * vec2(1.0,1.025));
        float angle = atan(v.y,v.x);
        float spread = smoothRise(.13,.86,p);
        float r1 = mix(.06,.88,spread);
        float r2 = mix(.025,.62,smoothRise(.24,.90,p));
        float circular = 1.0 - smoothstep(.002,.012,abs(radius-r1));
        float secondary = 1.0 - smoothstep(.001,.011,abs(radius-r2));
        float brokenArc = .55 + .45 * sin(angle*6.0 - u_time*1.35);
        float ring = circular*(.19+.25*brokenArc) + secondary*.19;
        float flare = softPoint(v,vec2(0.0),.052)*.18*(1.0-smoothRise(.34,.69,p));
        float dust = stars(q+vec2(.07,.05),25.0) * .33;
        float light = (ring + flare + dust)*active;
        vec3 color = mix(vec3(.017,.010,.049),vec3(.82,.74,1.0),clamp(light*2.2,0.0,1.0));
        gl_FragColor = vec4(color,clamp(darkness+light,0.0,.91));
      }
    `
  };

  let gl = null;
  let program = null;
  let uniforms = null;
  let frameId = 0;
  let elapsed = 0;
  let previousFrameTime = 0;
  let finished = false;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Unable to allocate WebGL shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || "Shader compile error";
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function initialize() {
    gl = canvas.getContext("webgl", {
      alpha: true, antialias: false, premultipliedAlpha: false,
      depth: false, stencil: false, preserveDrawingBuffer: false
    });
    if (!gl) return false;

    const v = compileShader(gl.VERTEX_SHADER, vertexShader);
    const f = compileShader(gl.FRAGMENT_SHADER, fragmentCommon + fragments[scene]);
    program = gl.createProgram();
    if (!program) throw new Error("Unable to allocate WebGL program");
    gl.attachShader(program, v);
    gl.attachShader(program, f);
    gl.linkProgram(program);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "WebGL link error");
    }

    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "a_position");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      progress: gl.getUniformLocation(program, "u_progress")
    };
    // Opaque fullscreen quad writes RGBA directly; blending would square opacity.
    gl.disable(gl.BLEND);
    resize();
    return true;
  }

  function resize() {
    if (!gl) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.35);
    const width = Math.max(1, Math.floor(window.innerWidth * ratio));
    const height = Math.max(1, Math.floor(window.innerHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
  }

  function finish() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    finished = true;
    document.body.classList.add("is-complete");
    canvas.style.display = "none";
    skipButton.disabled = true;
    replayButton.disabled = false;
  }

  function frame(now) {
    if (finished || document.hidden) {
      frameId = 0;
      previousFrameTime = 0;
      return;
    }

    if (previousFrameTime !== 0) elapsed += Math.min(64, now - previousFrameTime);
    previousFrameTime = now;
    const progress = Math.min(1, elapsed / duration);
    resize();

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, elapsed / 1000);
    gl.uniform1f(uniforms.progress, progress);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (progress >= 1) finish();
    else frameId = requestAnimationFrame(frame);
  }

  function play() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    elapsed = 0;
    previousFrameTime = 0;
    finished = false;
    document.body.classList.remove("is-complete");
    canvas.style.display = "block";
    skipButton.disabled = false;
    // Replay the intro caption too; animation shorthand is reset with a reflow.
    const caption = document.querySelector(".intro-copy");
    if (caption) {
      caption.style.animation = "none";
      void caption.offsetWidth;
      caption.style.animation = "";
    }
    if (reducedMotion.matches || !gl) {
      finish();
    } else if (!document.hidden) {
      frameId = requestAnimationFrame(frame);
    }
  }

  replayButton.addEventListener("click", play);
  skipButton.addEventListener("click", finish);
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !finished && !frameId) {
      previousFrameTime = 0;
      frameId = requestAnimationFrame(frame);
    }
  });
  reducedMotion.addEventListener?.("change", (event) => {
    if (event.matches) finish();
  });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    finish();
  });

  try {
    if (!reducedMotion.matches && initialize()) {
      play();
    } else {
      finish();
    }
  } catch (error) {
    console.error("[star-intro preview] WebGL unavailable:", error);
    finish();
  }
})();
