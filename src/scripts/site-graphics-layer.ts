/**
 * 全站轻量视觉交互层。
 *
 * 保留：
 * - Background Pointer Parallax：只移动背景图，不移动 Navbar / Sidebar / 正文。
 * - Mouse Edge Light：仅高亮鼠标附近的卡片边缘。
 *
 * 已移除：
 * - 全屏 WebGL / Volumetric Fog / Atmospheric Fog。
 *
 * 目标是让背景插画保持原始色彩与高光，不再用全屏 Shader 改写画面。
 */

type SiteGraphicsRuntime = {
	version: string;
	dispose: () => void;
};

type SiteGraphicsWindow = Window &
	typeof globalThis & {
		__fuwariSiteGraphicsInit?: boolean;
		__fuwariSiteGraphicsRuntime?: SiteGraphicsRuntime;
	};

const GRAPHICS_VERSION = "lightweight-interactions-v1";
const globalWindow = window as SiteGraphicsWindow;

const hasLegacyRuntime =
	globalWindow.__fuwariSiteGraphicsInit === true &&
	!globalWindow.__fuwariSiteGraphicsRuntime;

if (hasLegacyRuntime && import.meta.hot) {
	globalWindow.__fuwariSiteGraphicsInit = false;
	window.location.reload();
}

globalWindow.__fuwariSiteGraphicsRuntime?.dispose();
globalWindow.__fuwariSiteGraphicsRuntime = undefined;
globalWindow.__fuwariSiteGraphicsInit = false;

if (!globalWindow.__fuwariSiteGraphicsInit) {
	globalWindow.__fuwariSiteGraphicsInit = true;

	const background = document.getElementById("site-bg-image");
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	const coarsePointer = window.matchMedia("(pointer: coarse)");

	let pointerX = 0;
	let pointerY = 0;
	let targetParallaxX = 0;
	let targetParallaxY = 0;
	let currentParallaxX = 0;
	let currentParallaxY = 0;
	let frameId: number | null = null;
	let isVisible = !document.hidden;
	let activeEdgeCard: HTMLElement | null = null;
	let activeEdgeCardPositionPatched = false;
	let edgeLightElement: HTMLSpanElement | null = null;

	const graphicsEnabled = () => !coarsePointer.matches && window.innerWidth > 900;
	const dynamicEnabled = () => graphicsEnabled() && !reducedMotion.matches;

	const resetParallax = () => {
		targetParallaxX = 0;
		targetParallaxY = 0;
		currentParallaxX = 0;
		currentParallaxY = 0;

		if (background instanceof HTMLElement) {
			background.style.setProperty("--site-bg-parallax-x", "0px");
			background.style.setProperty("--site-bg-parallax-y", "0px");
		}
	};

	const updateParallax = () => {
		if (!(background instanceof HTMLElement) || !dynamicEnabled()) {
			resetParallax();
			return;
		}

		currentParallaxX += (targetParallaxX - currentParallaxX) * 0.075;
		currentParallaxY += (targetParallaxY - currentParallaxY) * 0.075;

		background.style.setProperty(
			"--site-bg-parallax-x",
			`${currentParallaxX.toFixed(2)}px`,
		);
		background.style.setProperty(
			"--site-bg-parallax-y",
			`${currentParallaxY.toFixed(2)}px`,
		);
	};

	const drawFrame = () => {
		frameId = null;
		if (!isVisible) return;

		updateParallax();

		if (dynamicEnabled()) {
			frameId = requestAnimationFrame(drawFrame);
		}
	};

	const requestFrame = () => {
		if (frameId === null && isVisible) {
			frameId = requestAnimationFrame(drawFrame);
		}
	};

	const getEdgeLightElement = () => {
		if (edgeLightElement) return edgeLightElement;

		edgeLightElement = document.createElement("span");
		edgeLightElement.className = "site-card-edge-light";
		edgeLightElement.setAttribute("aria-hidden", "true");
		return edgeLightElement;
	};

	const clearEdgeLight = () => {
		edgeLightElement?.remove();

		if (activeEdgeCard && activeEdgeCardPositionPatched) {
			activeEdgeCard.style.removeProperty("position");
		}

		activeEdgeCard = null;
		activeEdgeCardPositionPatched = false;
	};

	const updateEdgeLight = (event: PointerEvent) => {
		if (!graphicsEnabled()) {
			clearEdgeLight();
			return;
		}

		const target =
			event.target instanceof Element
				? event.target.closest<HTMLElement>(".card-base")
				: null;

		const nextCard =
			target?.matches(".novel-library-hero, .novel-hero, .novel-reader-card")
				? null
				: target;

		if (nextCard !== activeEdgeCard) {
			clearEdgeLight();
			activeEdgeCard = nextCard;

			if (activeEdgeCard) {
				activeEdgeCardPositionPatched =
					getComputedStyle(activeEdgeCard).position === "static";

				if (activeEdgeCardPositionPatched) {
					activeEdgeCard.style.position = "relative";
				}

				activeEdgeCard.append(getEdgeLightElement());
			}
		}

		if (!activeEdgeCard || !edgeLightElement) return;

		const rect = activeEdgeCard.getBoundingClientRect();
		edgeLightElement.style.setProperty(
			"--site-edge-light-x",
			`${(event.clientX - rect.left).toFixed(1)}px`,
		);
		edgeLightElement.style.setProperty(
			"--site-edge-light-y",
			`${(event.clientY - rect.top).toFixed(1)}px`,
		);
	};

	const handlePointerMove = (event: PointerEvent) => {
		updateEdgeLight(event);
		if (!dynamicEnabled()) return;

		pointerX = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
		pointerY = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
		targetParallaxX = pointerX * -16;
		targetParallaxY = pointerY * -10;
		requestFrame();
	};

	const handleResize = () => {
		if (!graphicsEnabled()) clearEdgeLight();

		if (dynamicEnabled()) {
			requestFrame();
		} else {
			resetParallax();
		}
	};

	const handleMotionPreference = () => {
		if (!graphicsEnabled()) clearEdgeLight();

		if (dynamicEnabled()) {
			requestFrame();
		} else {
			if (frameId !== null) {
				cancelAnimationFrame(frameId);
				frameId = null;
			}
			resetParallax();
		}
	};

	const handleVisibility = () => {
		isVisible = !document.hidden;

		if (!isVisible) {
			if (frameId !== null) cancelAnimationFrame(frameId);
			frameId = null;
			return;
		}

		if (dynamicEnabled()) requestFrame();
		else resetParallax();
	};


	window.addEventListener("pointermove", handlePointerMove, { passive: true });
	document.documentElement.addEventListener("pointerleave", clearEdgeLight, {
		passive: true,
	});
	window.addEventListener("blur", clearEdgeLight);
	window.addEventListener("resize", handleResize, { passive: true });
	document.addEventListener("visibilitychange", handleVisibility);
	reducedMotion.addEventListener("change", handleMotionPreference);
	coarsePointer.addEventListener("change", handleMotionPreference);

	if (dynamicEnabled()) requestFrame();
	else resetParallax();

	const dispose = () => {
		if (frameId !== null) {
			cancelAnimationFrame(frameId);
			frameId = null;
		}

		clearEdgeLight();
		resetParallax();

		window.removeEventListener("pointermove", handlePointerMove);
		document.documentElement.removeEventListener("pointerleave", clearEdgeLight);
		window.removeEventListener("blur", clearEdgeLight);
		window.removeEventListener("resize", handleResize);
		document.removeEventListener("visibilitychange", handleVisibility);
		reducedMotion.removeEventListener("change", handleMotionPreference);
		coarsePointer.removeEventListener("change", handleMotionPreference);

		if (globalWindow.__fuwariSiteGraphicsRuntime?.version === GRAPHICS_VERSION) {
			globalWindow.__fuwariSiteGraphicsRuntime = undefined;
			globalWindow.__fuwariSiteGraphicsInit = false;
		}
	};

	globalWindow.__fuwariSiteGraphicsRuntime = {
		version: GRAPHICS_VERSION,
		dispose,
	};

	if (import.meta.hot) {
		import.meta.hot.dispose(() => {
			dispose();
		});
	}
}
