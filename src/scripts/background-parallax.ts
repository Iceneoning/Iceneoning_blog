/**
 * Pointer parallax for the shared MP4 wallpaper and its static fallback.
 * No edge glow, canvas, shader or backdrop blur is involved.
 * Runs only when the pointer actually moves; Swup does not rebuild the wallpaper.
 */
type ParallaxWindow = Window & { __siteBackgroundParallaxDispose?: () => void };
const runtime = window as ParallaxWindow;
runtime.__siteBackgroundParallaxDispose?.();

const image = document.getElementById("site-bg-image");
const video = document.getElementById("site-bg-video");
const layers = [image, video].filter((layer): layer is HTMLElement => layer instanceof HTMLElement);

if (layers.length > 0) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const enabled = () => window.innerWidth > 900 && finePointer.matches && !reducedMotion.matches;

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let frame: number | null = null;

  const apply = () => {
    for (const layer of layers) {
      layer.style.setProperty("--site-bg-parallax-x", `${currentX.toFixed(2)}px`);
      layer.style.setProperty("--site-bg-parallax-y", `${currentY.toFixed(2)}px`);
    }
  };

  const cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };

  const reset = () => {
    cancel();
    targetX = targetY = currentX = currentY = 0;
    apply();
  };

  const tick = () => {
    frame = null;
    if (!enabled() || document.hidden) {
      reset();
      return;
    }
    currentX += (targetX - currentX) * 0.075;
    currentY += (targetY - currentY) * 0.075;
    if (Math.abs(targetX - currentX) < 0.08) currentX = targetX;
    if (Math.abs(targetY - currentY) < 0.08) currentY = targetY;
    apply();
    if (currentX !== targetX || currentY !== targetY) {
      frame = requestAnimationFrame(tick);
    }
  };

  const schedule = () => {
    if (frame === null && !document.hidden) frame = requestAnimationFrame(tick);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!enabled() || document.hidden) return;
    targetX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * -16;
    targetY = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * -10;
    schedule();
  };

  const onPreferenceChange = () => {
    if (!enabled()) reset();
  };
  const onVisibilityChange = () => {
    if (document.hidden) reset();
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("resize", onPreferenceChange, { passive: true });
  finePointer.addEventListener("change", onPreferenceChange);
  reducedMotion.addEventListener("change", onPreferenceChange);
  document.addEventListener("visibilitychange", onVisibilityChange);

  runtime.__siteBackgroundParallaxDispose = () => {
    reset();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("resize", onPreferenceChange);
    finePointer.removeEventListener("change", onPreferenceChange);
    reducedMotion.removeEventListener("change", onPreferenceChange);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    delete runtime.__siteBackgroundParallaxDispose;
  };
  import.meta.hot?.dispose(() => runtime.__siteBackgroundParallaxDispose?.());
}
