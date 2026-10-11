/**
 * Optional video wallpaper. The existing #site-bg-image remains the fallback.
 * Do not request video on narrow/coarse-pointer or reduced-motion devices.
 * The wallpaper lives outside #swup-container, so route changes cannot restart it.
 */
type BackgroundVideoWindow = Window & {
  __siteBackgroundVideoDispose?: () => void;
};
const runtime = window as BackgroundVideoWindow;
runtime.__siteBackgroundVideoDispose?.();

const video = document.getElementById("site-bg-video");
if (video instanceof HTMLVideoElement) {
  const allowed = window.matchMedia(
    "(min-width: 901px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
  );
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;

  const player: HTMLVideoElement = video;
  const hide = () => player.classList.remove("is-ready");

  function synchronize() {
    // No source attribute means no request for the MP4 on excluded devices.
    if (!allowed.matches || connection?.saveData) {
      player.pause();
      hide();
      if (player.hasAttribute("src")) {
        player.removeAttribute("src");
        player.load();
      }
      return;
    }
    if (document.hidden) {
      player.pause();
      hide();
      return;
    }
    if (!player.hasAttribute("src")) {
      const source = player.dataset.src;
      if (!source) return;
      player.src = source;
    }
    void player.play().catch(hide);
  }

  const onPlaying = () => {
    if (allowed.matches && !connection?.saveData && !document.hidden)
      video.classList.add("is-ready");
  };
  const onVisibility = () => synchronize();

  video.addEventListener("playing", onPlaying);
  video.addEventListener("pause", hide);
  video.addEventListener("error", hide);
  allowed.addEventListener("change", synchronize);
  document.addEventListener("visibilitychange", onVisibility);
  synchronize();

  runtime.__siteBackgroundVideoDispose = () => {
    video.pause();
    hide();
    video.removeEventListener("playing", onPlaying);
    video.removeEventListener("pause", hide);
    video.removeEventListener("error", hide);
    allowed.removeEventListener("change", synchronize);
    document.removeEventListener("visibilitychange", onVisibility);
    delete runtime.__siteBackgroundVideoDispose;
  };
  if (import.meta.hot)
    import.meta.hot.dispose(() => runtime.__siteBackgroundVideoDispose?.());
}
