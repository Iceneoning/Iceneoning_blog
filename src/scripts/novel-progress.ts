interface NovelProgress {
	version: 1;
	lastReadSlug: string;
	readThroughOrder: number;
	updatedAt: string;
}

interface NovelReaderSettings {
	version: 1;
	fontStep: number;
	lineHeightStep: number;
}

const STORAGE_PREFIX = "fuwari:novel";
const STORAGE_VERSION = 1;
const READER_SETTINGS_KEY = "fuwari:novel:reader-settings:v1";
const FONT_SIZES = ["1rem", "1.075rem", "1.15rem", "1.225rem"];
const LINE_HEIGHTS = ["1.8", "2", "2.2"];
let scrollFrame: number | null = null;
let toolbarHideTimer: number | undefined;

function storageKey(novelId: string) {
	return `${STORAGE_PREFIX}:${novelId}:progress:v${STORAGE_VERSION}`;
}

function readProgress(novelId: string): NovelProgress | undefined {
	try {
		const raw = window.localStorage.getItem(storageKey(novelId));
		if (!raw) return undefined;
		const parsed = JSON.parse(raw) as Partial<NovelProgress>;
		if (
			parsed.version !== STORAGE_VERSION ||
			typeof parsed.lastReadSlug !== "string" ||
			typeof parsed.readThroughOrder !== "number"
		) {
			window.localStorage.removeItem(storageKey(novelId));
			return undefined;
		}
		return parsed as NovelProgress;
	} catch {
		return undefined;
	}
}

function readReaderSettings(): NovelReaderSettings {
	try {
		const raw = window.localStorage.getItem(READER_SETTINGS_KEY);
		if (!raw) return { version: 1, fontStep: 1, lineHeightStep: 1 };
		const parsed = JSON.parse(raw) as Partial<NovelReaderSettings>;
		return {
			version: 1,
			fontStep: Math.min(
				FONT_SIZES.length - 1,
				Math.max(0, Number(parsed.fontStep ?? 1)),
			),
			lineHeightStep: Math.min(
				LINE_HEIGHTS.length - 1,
				Math.max(0, Number(parsed.lineHeightStep ?? 1)),
			),
		};
	} catch {
		return { version: 1, fontStep: 1, lineHeightStep: 1 };
	}
}

function saveReaderSettings(settings: NovelReaderSettings) {
	try {
		window.localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(settings));
	} catch {
		// Reader controls stay usable even when storage is unavailable.
	}
}

function applyReaderSettings(settings = readReaderSettings()) {
	const root = document.querySelector<HTMLElement>("[data-reader-settings-root]");
	if (!root) return;

	root.style.setProperty(
		"--novel-reader-font-size",
		FONT_SIZES[settings.fontStep],
	);
	root.style.setProperty(
		"--novel-reader-line-height",
		LINE_HEIGHTS[settings.lineHeightStep],
	);
}

function setupReaderControls() {
	const root = document.querySelector<HTMLElement>("[data-reader-settings-root]");
	if (!root) return;

	let settings = readReaderSettings();
	applyReaderSettings(settings);

	const decrease = root.querySelector<HTMLButtonElement>(
		'[data-reader-font="decrease"]',
	);
	const increase = root.querySelector<HTMLButtonElement>(
		'[data-reader-font="increase"]',
	);
	const lineHeight = root.querySelector<HTMLButtonElement>(
		"[data-reader-line-height]",
	);
	const toTop = root.querySelector<HTMLButtonElement>("[data-reader-top]");

	if (decrease) {
		decrease.onclick = () => {
			settings.fontStep = Math.max(0, settings.fontStep - 1);
			saveReaderSettings(settings);
			applyReaderSettings(settings);
		};
	}

	if (increase) {
		increase.onclick = () => {
			settings.fontStep = Math.min(
				FONT_SIZES.length - 1,
				settings.fontStep + 1,
			);
			saveReaderSettings(settings);
			applyReaderSettings(settings);
		};
	}

	if (lineHeight) {
		lineHeight.onclick = () => {
			settings.lineHeightStep =
				(settings.lineHeightStep + 1) % LINE_HEIGHTS.length;
			saveReaderSettings(settings);
			applyReaderSettings(settings);
		};
	}

	if (toTop) {
		toTop.onclick = () => {
			const reader = document.querySelector<HTMLElement>("[data-novel-reader]");
			reader?.scrollIntoView({ behavior: "smooth", block: "start" });
		};
	}
}

function updateReaderToolbarFromPointer(event: PointerEvent) {
	const toolbar = document.querySelector<HTMLElement>("[data-reader-toolbar]");
	if (!toolbar || window.matchMedia("(hover: none), (pointer: coarse)").matches) {
		return;
	}

	const inBottomHotZone = event.clientY >= window.innerHeight - 120;
	if (inBottomHotZone || toolbar.matches(":hover")) {
		if (toolbarHideTimer !== undefined) {
			window.clearTimeout(toolbarHideTimer);
			toolbarHideTimer = undefined;
		}
		toolbar.classList.add("is-visible");
		return;
	}

	if (toolbarHideTimer !== undefined) return;
	toolbarHideTimer = window.setTimeout(() => {
		toolbar.classList.remove("is-visible");
		toolbarHideTimer = undefined;
	}, 560);
}

function saveCurrentChapter() {
	const reader = document.querySelector<HTMLElement>("[data-novel-reader]");
	if (!reader) return;

	const novelId = reader.dataset.novelId;
	const chapterId = reader.dataset.chapterId;
	const order = Number(reader.dataset.chapterOrder);
	if (!novelId || !chapterId || !Number.isFinite(order)) return;

	const previous = readProgress(novelId);
	const progress: NovelProgress = {
		version: 1,
		lastReadSlug: chapterId,
		readThroughOrder: Math.max(previous?.readThroughOrder ?? 0, order),
		updatedAt: new Date().toISOString(),
	};

	try {
		window.localStorage.setItem(storageKey(novelId), JSON.stringify(progress));
	} catch {
		// Reading must remain fully usable when storage is unavailable.
	}
}

function updateChapterList() {
	const rows = document.querySelectorAll<HTMLElement>("[data-novel-chapter]");
	for (const row of rows) {
		const novelId = row.dataset.novelId;
		const order = Number(row.dataset.chapterOrder);
		if (!novelId || !Number.isFinite(order)) continue;
		const progress = readProgress(novelId);
		const isRead = !!progress && order <= progress.readThroughOrder;
		row.classList.toggle("is-read", isRead);
		if (isRead) row.dataset.read = "true";
		else delete row.dataset.read;
	}
}

function updateContinueLinks() {
	const links = document.querySelectorAll<HTMLAnchorElement>(
		"[data-novel-continue]",
	);
	for (const link of links) {
		const novelId = link.dataset.novelId;
		if (!novelId) continue;
		const progress = readProgress(novelId);
		if (!progress) {
			link.hidden = true;
			link.classList.add("hidden");
			continue;
		}

		const chapterLinks = document.querySelectorAll<HTMLAnchorElement>(
			`[data-novel-chapter][data-novel-id="${CSS.escape(novelId)}"]`,
		);
		const target = Array.from(chapterLinks).find(
			(chapter) => chapter.dataset.chapterId === progress.lastReadSlug,
		);
		if (!target?.href) {
			link.hidden = true;
			link.classList.add("hidden");
			continue;
		}

		link.href = target.href;
		link.hidden = false;
		link.classList.remove("hidden");
	}
}

function updateReadingBar() {
	scrollFrame = null;
	const bar = document.querySelector<HTMLElement>("[data-reading-progress]");
	const percent = document.querySelector<HTMLElement>("[data-reading-percent]");
	const article = document.querySelector<HTMLElement>("[data-novel-prose]");
	if (!bar || !article) return;

	const rect = article.getBoundingClientRect();
	const articleTop = window.scrollY + rect.top;
	const readableDistance = Math.max(
		article.offsetHeight - window.innerHeight,
		1,
	);
	const progress = Math.min(
		1,
		Math.max(0, (window.scrollY - articleTop) / readableDistance),
	);
	const percentage = Math.round(progress * 100);
	bar.style.transform = `scaleX(${progress})`;
	bar.setAttribute("aria-valuenow", String(percentage));
	if (percent) percent.textContent = `${percentage}%`;
}

function scheduleReadingBarUpdate() {
	if (scrollFrame !== null) return;
	scrollFrame = window.requestAnimationFrame(updateReadingBar);
}

function initNovelPage() {
	saveCurrentChapter();
	updateChapterList();
	updateContinueLinks();
	setupReaderControls();
	scheduleReadingBarUpdate();
}

window.addEventListener("scroll", scheduleReadingBarUpdate, { passive: true });
window.addEventListener("resize", scheduleReadingBarUpdate, { passive: true });
window.addEventListener("pointermove", updateReaderToolbarFromPointer, {
	passive: true,
});

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initNovelPage, { once: true });
} else {
	initNovelPage();
}

function setupSwup() {
	window.swup.hooks.on("page:view", initNovelPage);
}

if (window.swup?.hooks) setupSwup();
else document.addEventListener("swup:enable", setupSwup, { once: true });
