let showcaseTimer: number | undefined;

function stopShowcaseTimer() {
	if (showcaseTimer !== undefined) {
		window.clearInterval(showcaseTimer);
		showcaseTimer = undefined;
	}
}

function initNovelShowcase() {
	stopShowcaseTimer();

	const root = document.querySelector<HTMLElement>("[data-novel-showcase-root]");
	if (!root) return;

	const items = Array.from(
		root.querySelectorAll<HTMLElement>("[data-showcase-item]"),
	);
	if (items.length === 0) return;

	const cards = Array.from(
		document.querySelectorAll<HTMLElement>("[data-showcase-target]"),
	);
	let activeIndex = Math.max(
		0,
		items.findIndex((item) => item.classList.contains("is-active")),
	);

	const activateIndex = (index: number) => {
		activeIndex = (index + items.length) % items.length;
		items.forEach((item, itemIndex) => {
			item.classList.toggle("is-active", itemIndex === activeIndex);
		});
	};

	const activateId = (novelId: string) => {
		const index = items.findIndex(
			(item) => item.dataset.showcaseItem === novelId,
		);
		if (index >= 0) activateIndex(index);
	};

	const startAutoRotate = () => {
		stopShowcaseTimer();
		if (
			items.length < 2 ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
			return;
		}
		showcaseTimer = window.setInterval(() => {
			activateIndex(activeIndex + 1);
		}, 10000);
	};

	for (const card of cards) {
		const novelId = card.dataset.showcaseTarget;
		if (!novelId) continue;

		card.onpointerenter = () => {
			stopShowcaseTimer();
			activateId(novelId);
		};
		card.onpointerleave = () => startAutoRotate();
		card.addEventListener("focusin", () => {
			stopShowcaseTimer();
			activateId(novelId);
		});
		card.addEventListener("focusout", (event: FocusEvent) => {
			const nextTarget = event.relatedTarget;
			if (nextTarget instanceof Node && card.contains(nextTarget)) return;
			startAutoRotate();
		});
	}

	activateIndex(activeIndex);
	startAutoRotate();
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initNovelShowcase, { once: true });
} else {
	initNovelShowcase();
}

function setupShowcaseSwup() {
	window.swup.hooks.on("page:view", initNovelShowcase);
}

if (window.swup?.hooks) setupShowcaseSwup();
else document.addEventListener("swup:enable", setupShowcaseSwup, { once: true });
