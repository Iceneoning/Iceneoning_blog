/**
 * Frostbound Journey hero controller.
 *
 * A single persistent controller lives outside #swup-container and recreates
 * per-page listeners after Swup page:view. No animation blocks navigation.
 * Without JavaScript, scene 0 remains visible and controls stay hidden.
 */
type JourneyRuntime = { dispose: () => void };
type JourneyWindow = Window & typeof globalThis & {
  __fuwariJourneyRuntime?: JourneyRuntime;
};

const appWindow = window as JourneyWindow;
appWindow.__fuwariJourneyRuntime?.dispose();

let releaseScene: () => void = () => {};
const media = window.matchMedia("(prefers-reduced-motion: reduce)");
let removeSwupHook: (() => void) | undefined;
let isAlive = true;

function initJourneyHero() {
  releaseScene();
  releaseScene = () => {};

  const cover = document.querySelector<HTMLElement>(".journey-front-cover");
  if (!cover) return;

  const scenes = Array.from(cover.querySelectorAll<HTMLElement>("[data-journey-scene]"));
  const buttons = Array.from(cover.querySelectorAll<HTMLButtonElement>("[data-journey-tab]"));
  if (scenes.length < 2 || buttons.length !== scenes.length) return;

  let active = 0;
  let timer: number | undefined;
  let hovered = false;
  let focused = false;

  function clearTimer() {
    if (timer !== undefined) window.clearInterval(timer);
    timer = undefined;
    cover?.classList.remove("journey-front--playing");
  }

  function select(next: number) {
    active = (next + scenes.length) % scenes.length;
    scenes.forEach((scene, index) => {
      scene.hidden = index !== active;
    });
    buttons.forEach((button, index) => {
      button.setAttribute("aria-pressed", String(index === active));
    });
    cover?.setAttribute("data-journey-active", String(active));
  }

  function schedule() {
    clearTimer();
    if (media.matches || document.hidden || hovered || focused) return;
    cover?.classList.add("journey-front--playing");
    timer = window.setInterval(() => select(active + 1), 8200);
  }

  const onEnter = () => { hovered = true; clearTimer(); };
  const onLeave = () => { hovered = false; schedule(); };
  const onFocusIn = () => { focused = true; clearTimer(); };
  const onFocusOut = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && cover.contains(event.relatedTarget)) return;
    focused = false;
    schedule();
  };
  const onVisibility = () => document.hidden ? clearTimer() : schedule();
  const onPreference = () => schedule();

  const clickHandlers = buttons.map((button, index) => {
    const onClick = () => { select(index); schedule(); };
    button.addEventListener("click", onClick);
    return { button, onClick };
  });

  cover.addEventListener("pointerenter", onEnter);
  cover.addEventListener("pointerleave", onLeave);
  cover.addEventListener("focusin", onFocusIn);
  cover.addEventListener("focusout", onFocusOut);
  document.addEventListener("visibilitychange", onVisibility);
  media.addEventListener("change", onPreference);

  select(0);
  cover.classList.add("journey-front--ready");
  schedule();

  releaseScene = () => {
    clearTimer();
    for (const { button, onClick } of clickHandlers) button.removeEventListener("click", onClick);
    cover.removeEventListener("pointerenter", onEnter);
    cover.removeEventListener("pointerleave", onLeave);
    cover.removeEventListener("focusin", onFocusIn);
    cover.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("visibilitychange", onVisibility);
    media.removeEventListener("change", onPreference);
    cover.classList.remove("journey-front--ready");
  };
}

function onPageView() {
  if (isAlive) initJourneyHero();
}

function attachSwup() {
  const swup = window.swup;
  if (!swup?.hooks) return;
  removeSwupHook?.();
  removeSwupHook = swup.hooks.on("page:view", onPageView);
}

const onSwupEnable = () => attachSwup();
document.addEventListener("swup:enable", onSwupEnable);
attachSwup();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", onPageView, { once: true });
} else {
  onPageView();
}

function dispose() {
  isAlive = false;
  releaseScene();
  removeSwupHook?.();
  document.removeEventListener("swup:enable", onSwupEnable);
  document.removeEventListener("DOMContentLoaded", onPageView);
  if (appWindow.__fuwariJourneyRuntime?.dispose === dispose) {
    appWindow.__fuwariJourneyRuntime = undefined;
  }
}
appWindow.__fuwariJourneyRuntime = { dispose };
if (import.meta.hot) import.meta.hot.dispose(dispose);
