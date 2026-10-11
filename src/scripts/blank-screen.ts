/**
 * Immersive wallpaper/blank-screen view. The original navbar is reused, while
 * the Swup content and persistent sidebars are simply hidden from interaction.
 * This deliberately does not persist to storage so a reload cannot trap anyone.
 */
let active = false;
let revealTimer: number | undefined;
let originalInert = new Map<HTMLElement, boolean>();
const root = document.documentElement;
const bar = () => document.getElementById("top-row");
const button = () => document.getElementById("blank-screen-switch") as HTMLButtonElement | null;

function showNavbar(show: boolean) {
  if (!active) return;
  root.toggleAttribute("data-blank-nav-visible", show);
}

function applyBlankScreen(next: boolean) {
  if (active === next) return;
  active = next;
  if (revealTimer !== undefined) window.clearTimeout(revealTimer);
  const control = button();
  if (next) {
    root.removeAttribute("data-blank-screen-revealing");
    originalInert = new Map();
    document.querySelectorAll<HTMLElement>("#site-content > :not(#top-row)").forEach(element => {
      originalInert.set(element, element.inert);
      element.inert = true;
    });
    root.setAttribute("data-blank-screen", "");
    // Keep the navigation present for a moment so the user sees where it went.
    // It slides out after the pointer leaves the navbar region.
    showNavbar(false);
  } else {
    // Preserve the lateral transition while the panels slide back from
    // left/right, then remove the temporary CSS animation scope.
    root.setAttribute("data-blank-screen-revealing", "");
    root.removeAttribute("data-blank-screen");
    root.removeAttribute("data-blank-nav-visible");
    originalInert.forEach((wasInert, element) => { element.inert = wasInert; });
    originalInert.clear();
    revealTimer = window.setTimeout(() => {
      if (!active) root.removeAttribute("data-blank-screen-revealing");
      revealTimer = undefined;
    }, 1000);
  }
  if (control) {
    control.setAttribute("aria-pressed", String(next));
    control.setAttribute("aria-label", next ? "退出空屏模式" : "进入空屏模式");
    control.title = next ? "退出空屏模式" : "仅查看星空背景";
  }
}

function onPointerMove(event: PointerEvent) {
  if (!active || event.pointerType === "touch") return;
  const headerHeight = bar()?.getBoundingClientRect().height || 90;
  // Use the original navbar strip as the reveal zone, with a small tolerance.
  showNavbar(event.clientY <= Math.max(headerHeight, 88) + 10);
}
function onPointerDown(event: PointerEvent) {
  if (!active || event.pointerType !== "touch") return;
  if (event.clientY < 36) showNavbar(true);
  else if (!bar()?.contains(event.target as Node)) showNavbar(false);
}
function onFocus(event: FocusEvent) {
  if (active && event.target instanceof Node && bar()?.contains(event.target)) showNavbar(true);
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && active) {
    applyBlankScreen(false);
    button()?.focus();
  }
}
function onClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (button()?.contains(target)) applyBlankScreen(!active);
}
function onSwupView() {
  // The navigation is persistent under Swup; hide any newly replaced content
  // if a page is changed while blank mode remains active.
  if (!active) return;
  document.querySelectorAll<HTMLElement>("#site-content > :not(#top-row)").forEach(element => {
    if (!originalInert.has(element)) originalInert.set(element, element.inert);
    element.inert = true;
  });
}
document.addEventListener("click", onClick);
document.addEventListener("pointermove", onPointerMove, { passive: true });
document.addEventListener("pointerdown", onPointerDown, { passive: true });
document.addEventListener("focusin", onFocus);
document.addEventListener("keydown", onKeydown);
function attachSwup() { window.swup?.hooks.on("page:view", onSwupView); }
if (window.swup?.hooks) attachSwup();
else document.addEventListener("swup:enable", attachSwup, {once:true});
window.addEventListener("pagehide", () => {
  if (active) applyBlankScreen(false);
}, {once:true});
export {};
