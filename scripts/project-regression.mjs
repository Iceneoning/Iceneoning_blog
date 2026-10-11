// Production regression for CSS cleanup and intro resource coordination.
// Uses an existing Playwright installation; never downloads dependencies.

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ts = require("typescript");
const base = process.env.AUDIT_URL || "http://127.0.0.1:4322";
const output = resolve(".codex-fps-frames/performance/project");
const baselineMode = process.argv.includes("--baseline");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
	headless: true,
	channel: process.env.AUDIT_BROWSER || "msedge",
});
const checks = [];
try {
	const styles = [];
	for (const width of [1440, 390]) {
		const context = await browser.newContext({
			viewport: { width, height: 900 },
			reducedMotion: "reduce",
		});
		const page = await context.newPage();
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		for (const route of [
			"/",
			"/archive/",
			"/archive/?category=代码",
			"/intro/",
			"/friends/",
			"/novels/",
			"/novels/yaoxing/",
			"/novels/yaoxing/001/",
			"/posts/最开始的样子/",
		]) {
			await page.goto(base + route, { waitUntil: "networkidle" });
			await page.evaluate(() => document.fonts.ready);
			const snapshot = await page.evaluate(() => {
				const properties = [
					"display",
					"position",
					"width",
					"height",
					"padding",
					"margin",
					"font-family",
					"font-size",
					"line-height",
					"color",
					"background-color",
					"border",
					"transform",
					"opacity",
					"z-index",
					"grid-template-columns",
					"gap",
					"visibility",
				];
				return [
					...document.querySelectorAll(
						"#navbar, #main-grid, #sidebar, #swup-container, [class*='journey-'], [class*='novel-']",
					),
				]
					.filter(
						(el) =>
							!el.closest("date-time-panel") &&
							!el.matches("canvas, svg, svg *"),
					)
					.map((el) => ({
						tag: el.tagName,
						classes: el.className,
						style: Object.fromEntries(
							properties.map((name) => [
								name,
								getComputedStyle(el).getPropertyValue(name),
							]),
						),
					}));
			});
			styles.push({ width, route, snapshot });
			assert.equal(
				await page.evaluate(
					() => document.documentElement.scrollWidth > innerWidth,
				),
				false,
				`${width}: overflow at ${route}`,
			);
		}
		assert.deepEqual(errors, []);
		await context.close();
	}
	const baselinePath = resolve(output, "styles-baseline.json");
	if (baselineMode) {
		await writeFile(baselinePath, JSON.stringify(styles));
		console.log("Saved computed styles for 18 desktop/mobile route cases");
		process.exitCode = 0;
	} else {
		const before = JSON.parse(await readFile(baselinePath, "utf8"));
		assert.deepEqual(styles, before, "Computed styles changed after cleanup");
		checks.push(
			"18 desktop/mobile route cases: computed styles identical, no horizontal overflow or page errors",
		);
		for (const route of ["/", "/novels/"]) {
			const context = await browser.newContext({
				viewport: { width: 1440, height: 900 },
			});
			await context.addInitScript(() => {
				window.__introEvents = [];
				document.addEventListener("site:intro-prepare", () =>
					window.__introEvents.push(performance.now()),
				);
				window.__earlyVideoPlays = 0;
				const play = HTMLMediaElement.prototype.play;
				HTMLMediaElement.prototype.play = function (...args) {
					if (
						document.documentElement.hasAttribute("data-site-intro-pending") &&
						!document.documentElement.hasAttribute("data-site-intro-preparing")
					)
						window.__earlyVideoPlays++;
					return play.apply(this, args);
				};
			});
			const page = await context.newPage();
			const errors = [];
			page.on("pageerror", (error) => errors.push(error.message));
			await page.goto(`${base + route}?intro=1`, {
				waitUntil: "domcontentloaded",
			});
			await page.waitForFunction(() => window.__siteStarIntroDestroy);
			assert.equal(
				await page.evaluate(
					() => !!document.getElementById("site-bg-video")?.getAttribute("src"),
				),
				false,
			);
			await page.waitForFunction(
				() => !document.getElementById("star-intro-overlay"),
			);
			assert.equal(await page.evaluate(() => window.__earlyVideoPlays), 0);
			assert.equal(await page.evaluate(() => window.__introEvents.length), 1);
			await page.waitForFunction(() =>
				document
					.getElementById("site-bg-video")
					?.classList.contains("is-ready"),
			);
			await page.waitForFunction(
				() =>
					!document.documentElement.hasAttribute("data-site-intro-revealing"),
			);
			assert.equal(
				await page.evaluate(() =>
					document.documentElement.hasAttribute("data-site-intro-preparing"),
				),
				false,
			);
			assert.deepEqual(errors, []);
			checks.push(
				`${route}: video waits for intro preparation, starts normally, markers and overlay cleaned`,
			);
			await context.close();
		}
		const context = await browser.newContext({
			viewport: { width: 1440, height: 900 },
		});
		const page = await context.newPage();
		await page.goto(`${base}/?intro=1`, { waitUntil: "domcontentloaded" });
		await page.waitForFunction(() => window.__siteStarIntroDestroy);
		await page.locator("#star-intro-skip").click();
		await page.waitForFunction(
			() => !document.getElementById("star-intro-overlay"),
		);
		await page.waitForFunction(() =>
			document.getElementById("site-bg-video")?.classList.contains("is-ready"),
		);
		checks.push("Early skip resumes wallpaper and releases the intro");
		await context.close();

		// Request failure and a stalled chunk must both release the initial gate.
		for (const stalled of [false, true]) {
			const recoveryContext = await browser.newContext();
			if (stalled)
				await recoveryContext.addInitScript(() => {
					const timeout = window.setTimeout;
					window.setTimeout = (callback, delay, ...args) =>
						timeout(callback, delay === 9000 ? 1200 : delay, ...args);
				});
			const recovery = await recoveryContext.newPage();
			let rendererRequested = false;
			await recovery.route("**/_astro/star-intro*.js", async (route) => {
				rendererRequested = true;
				if (stalled) await new Promise((resolve) => setTimeout(resolve, 2400));
				await route.abort();
			});
			await recovery.goto(`${base}/?intro=1`, {
				waitUntil: "domcontentloaded",
			});
			await recovery.waitForFunction(
				() => !document.documentElement.hasAttribute("data-site-intro-pending"),
			);
			assert.equal(rendererRequested, true);
			assert.equal(await recovery.locator("#star-intro-overlay").count(), 0);
			await recovery.waitForFunction(() =>
				document.getElementById("site-bg-video")?.hasAttribute("src"),
			);
			await recoveryContext.close();
			checks.push(
				stalled
					? "Stalled renderer request: early watchdog releases page and wallpaper"
					: "Renderer request failure: page and wallpaper recover",
			);
		}

		const searchContext = await browser.newContext({ reducedMotion: "reduce" });
		const searchPage = await searchContext.newPage();
		await searchPage.goto(base, { waitUntil: "networkidle" });
		await searchPage.evaluate(() => {
			window.__pendingSearches = {};
			window.pagefind = {
				search: (keyword) =>
					new Promise((resolve) => {
						window.__pendingSearches[keyword] = resolve;
					}),
			};
			document.dispatchEvent(new Event("pagefindready"));
		});
		const input = searchPage.locator("#search-bar input");
		await input.fill("old");
		await searchPage.waitForFunction(() => window.__pendingSearches.old);
		await input.fill("new");
		await searchPage.evaluate(() =>
			window.__pendingSearches.old({
				results: [
					{
						data: async () => ({
							url: "/",
							meta: { title: "obsolete result" },
							excerpt: "old",
						}),
					},
				],
			}),
		);
		await searchPage.waitForTimeout(50);
		assert.equal(
			await searchPage.locator("#search-panel a").count(),
			0,
			"Stale search displayed during debounce",
		);
		await searchPage.waitForFunction(() => window.__pendingSearches.new);
		await searchPage.evaluate(() =>
			window.__pendingSearches.new({
				results: [
					{
						data: async () => ({
							url: "/",
							meta: { title: "current result" },
							excerpt: "new",
						}),
					},
				],
			}),
		);
		await searchPage.waitForFunction(() =>
			document
				.querySelector("#search-panel")
				?.textContent.includes("current result"),
		);
		checks.push(
			"Search: stale response discarded during debounce; newest response displayed",
		);
		await searchContext.close();

		// Exercise a real TOC class against absent headings and rapid DOM removal.
		const tocSource = await readFile("src/components/widget/TOC.astro", "utf8");
		const tocCode = ts.transpileModule(
			tocSource.match(/<script>([\s\S]*?)<\/script>/)[1],
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } },
		).outputText;
		const tocContext = await browser.newContext();
		const tocPage = await tocContext.newPage();
		const tocErrors = [];
		tocPage.on("pageerror", (error) => tocErrors.push(error.message));
		await tocPage.route(`${base}/toc-regression`, (route) =>
			route.fulfill({
				contentType: "text/html",
				body: '<div id="toc-inner-wrapper"><div id="toc"><table-of-contents><a href="#missing">missing</a><a href="#present">present</a></table-of-contents></div></div><div id="active-indicator"></div><section><h2 id="present">heading</h2>content</section>',
			}),
		);
		await tocPage.goto(`${base}/toc-regression`);
		// Remove in the same task that connects it, before its first rAF runs.
		await tocPage.addScriptTag({
			content:
				tocCode +
				'\nwindow.__toc = document.querySelector("table-of-contents"); window.__toc.remove();',
		});
		await tocPage.waitForTimeout(50);
		assert.equal(await tocPage.evaluate(() => window.__toc.sections.length), 0);
		await tocPage.evaluate(() =>
			document.getElementById("toc").append(window.__toc),
		);
		await tocPage.waitForFunction(() => window.__toc.sections.length === 1);
		assert.equal(
			await tocPage.evaluate(() => window.__toc.tocEntries[0].hash),
			"#present",
		);
		await tocPage.evaluate(() => {
			window.__toc.remove();
			window.__toc.anchorNavTarget = null;
			document.querySelector("#toc a")?.remove();
			document.getElementById("toc-inner-wrapper").append(
				Object.assign(document.createElement("a"), {
					href: "#present",
					textContent: "detached-listener test",
				}),
			);
		});
		await tocPage.locator("#toc-inner-wrapper > a").click();
		assert.equal(
			await tocPage.evaluate(() => window.__toc.anchorNavTarget),
			null,
		);
		assert.deepEqual(tocErrors, []);
		checks.push(
			"TOC: canceled deferred init, valid headings only, capture listener removed on disconnect",
		);
		await tocContext.close();

		await writeFile(
			resolve(output, "checks.json"),
			JSON.stringify(checks, null, 2),
		);
		console.log(checks.join("\n"));
	}
} finally {
	await browser.close();
}
