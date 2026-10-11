// Compare Canvas output with the saved baseline, then check real route interactions.
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
	headless: true,
	channel: process.env.AUDIT_BROWSER || "msedge",
});
const base = process.env.AUDIT_URL || "http://127.0.0.1:4321";
const output = resolve(".codex-fps-frames/performance/regression");
await mkdir(output, { recursive: true });
const checks = [];

async function canvasFrames(source, settings, dpr) {
	const context = await browser.newContext({
		viewport: { width: 800, height: 600 },
		deviceScaleFactor: dpr,
	});
	const page = await context.newPage();
	await page.route(base + "/canvas-test", (route) =>
		route.fulfill({
			contentType: "text/html",
			body: "<html><body></body></html>",
		}),
	);
	await page.goto(base + "/canvas-test");
	await page.evaluate(() => {
		let seed = 12345;
		Math.random = () => {
			seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
			return seed / 4294967296;
		};
		window.__clock = 0;
		performance.now = () => window.__clock;
		window.requestAnimationFrame = () => 1;
	});
	await page.addScriptTag({
		content: source.match(/<script>([\s\S]*?)<\/script>/)[1],
	});
	const frames = await page.evaluate(async (settings) => {
		window.updateEffectSettings(...settings);
		const spark = window.spark;
		const hashes = [];
		for (let i = 0; i < 180; i++) {
			window.__clock = (i * 1000) / 60;
			if (i === 0 || i === 35 || i === 65)
				spark.boom(i === 0 ? 6 : 400, i === 0 ? 4 : 300);
			if (i < 75)
				window.externalMove(
					350 + Math.sin(i / 8) * 140,
					260 + Math.cos(i / 9) * 100,
				);
			// Include widely separated particles and viewport edges in the same frame.
			if (i === 40) spark.boom(794, 596);
			spark.loop(window.__clock + 1000 / 60);
			const bytes = spark.ctx.getImageData(
				0,
				0,
				spark.c.width,
				spark.c.height,
			).data;
			hashes.push(
				Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
					.map((v) => v.toString(16).padStart(2, "0"))
					.join(""),
			);
		}
		return hashes;
	}, settings);
	await context.close();
	return frames;
}

try {
	const oldSource = await readFile(
		".codex-fps-frames/performance/baseline/mouse-source.astro",
		"utf8",
	);
	const newSource = await readFile(
		"src/components/effects/MouseSparkEffect.astro",
		"utf8",
	);
	for (const dpr of [1, 2])
		for (const settings of [
			[1.5, 1, 1],
			[3, 0.6, 3],
			[0.5, 1, 0.2],
		]) {
			const expected = await canvasFrames(oldSource, settings, dpr);
			const actual = await canvasFrames(newSource, settings, dpr);
			assert.deepEqual(
				actual,
				expected,
				`Canvas differs at DPR ${dpr}, settings ${settings}`,
			);
			checks.push(
				`180 canvas frames identical: DPR ${dpr}, settings ${settings}`,
			);
			console.log(checks.at(-1));
		}

	for (const mobile of [false, true]) {
		const context = await browser.newContext({
			viewport: mobile
				? { width: 390, height: 844 }
				: { width: 1440, height: 900 },
			hasTouch: mobile,
			isMobile: mobile,
		});
		await context.addInitScript(() =>
			sessionStorage.setItem("iceneoning-star-intro-v45-seen", "1"),
		);
		const page = await context.newPage();
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.goto(base, { waitUntil: "networkidle" });
		await page.waitForFunction(
			() =>
				(!!window.swup?.hooks && !!window.spark) ||
				matchMedia("(pointer: coarse)").matches,
		);
		assert.equal(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
			true,
		);
		await page.screenshot({
			path: resolve(output, mobile ? "home-mobile.png" : "home-desktop.png"),
		});
		if (mobile) {
			assert.equal(
				await page.locator("#site-bg-video").getAttribute("src"),
				null,
			);
			const backgrounds = await page.evaluate(() =>
				performance
					.getEntriesByType("resource")
					.map((r) => new URL(r.name).pathname)
					.filter((p) => p.startsWith("/background/")),
			);
			assert.ok(backgrounds.includes("/background/mobile-background.jpg"));
			assert.ok(!backgrounds.includes("/background/star-sea-poster.webp"));
		}

		const navigate = async (route) => {
			await page.evaluate(async (route) => {
				await window.swup.navigate(route);
			}, route);
			await page.waitForURL(base + route);
			await page.waitForTimeout(400);
		};
		// Enter each feature from the blog, repeat after leaving to check lazy-import lifecycle.
		for (let visit = 0; visit < 2; visit++) {
			await navigate("/novels/");
			await page.waitForFunction(
				() => document.querySelector("[data-novel-crystal-stars]").width > 300,
			);
			await navigate("/novels/yaoxing/001/");
			await page.waitForFunction(() =>
				document
					.querySelector("[data-reading-progress]")
					.hasAttribute("aria-valuenow"),
			);
			const prose = page.locator("[data-novel-prose]");
			const before = await prose.evaluate(
				(el) => getComputedStyle(el).fontSize,
			);
			await page
				.locator('[data-reader-font="increase"]')
				.evaluate((el) => el.click());
			const after = await prose.evaluate((el) => getComputedStyle(el).fontSize);
			assert.ok(parseFloat(after) >= parseFloat(before));
			await page.evaluate(() =>
				scrollTo(0, document.documentElement.scrollHeight),
			);
			await page.waitForTimeout(300);
			assert.equal(
				await page
					.locator("[data-reading-progress]")
					.getAttribute("aria-valuenow"),
				"100",
			);
			await navigate("/");
		}
		await navigate("/archive/?category=" + encodeURIComponent("杂谈"));
		assert.equal(await page.locator("#archive-timeline").isVisible(), false);
		assert.equal(await page.locator("#archive-filter-view").isVisible(), true);
		assert.ok(
			(await page.locator(".archive-card-item:not(.hidden)").count()) > 0,
		);
		await navigate("/posts/" + encodeURIComponent("加勒比海盗的那些事") + "/");
		await page.locator(".custom-md img").first().click();
		await page.locator(".pswp--open").waitFor();
		// Placeholder decoding can add up to 250ms before the opening transition.
		// Wait for actual readiness instead of assuming a fixed delay suffices.
		await page.waitForFunction(() => window.pswp?.opener.isOpen);
		await page.keyboard.press("Escape");
		await page.locator(".pswp--open").waitFor({ state: "detached" });
		await navigate("/");
		await page.locator("#blank-screen-switch").evaluate((el) => el.click());
		assert.equal(
			await page.locator("html").getAttribute("data-blank-screen"),
			"",
		);
		await page.keyboard.press("Escape");
		assert.equal(
			await page.locator("html").getAttribute("data-blank-screen"),
			null,
		);
		assert.equal(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
			true,
		);
		assert.deepEqual(errors, []);
		checks.push(
			`${mobile ? "Mobile" : "Desktop"}: repeated Swup navigation, reader, archive filter, lightbox, blank screen; no page errors or horizontal overflow`,
		);
		await context.close();
	}

	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
	});
	await context.addInitScript(() =>
		sessionStorage.setItem("iceneoning-star-intro-v45-seen", "1"),
	);
	const page = await context.newPage();
	await page.goto(base, { waitUntil: "networkidle" });
	await page.evaluate(() => {
		window.__searchLoads = 0;
		window.pagefind = {
			search: async (keyword) => ({
				results: Array.from({ length: 100 }, (_, i) => ({
					data: async () => {
						window.__searchLoads++;
						return {
							url: "/",
							meta: { title: `${keyword} result ${i}` },
							excerpt: "test",
						};
					},
				})),
			}),
		};
		document.dispatchEvent(new Event("pagefindready"));
	});
	await page.locator("#search-bar input").fill("test");
	await page.waitForFunction(
		() => document.querySelectorAll("#search-panel a").length === 12,
	);
	assert.equal(await page.evaluate(() => window.__searchLoads), 12);
	checks.push(
		"Search with 100 matches: exactly 12 result fragments loaded and 12 rows displayed",
	);
	await context.close();

	const archiveContext = await browser.newContext();
	await archiveContext.addInitScript(() =>
		sessionStorage.setItem("iceneoning-star-intro-v45-seen", "1"),
	);
	const archive = await archiveContext.newPage();
	await archive.goto(base + "/archive/", { waitUntil: "networkidle" });
	assert.equal(
		await archive.evaluate(
			() =>
				performance
					.getEntriesByType("resource")
					.filter((r) => new URL(r.name).pathname.startsWith("/images/Posts/"))
					.length,
		),
		0,
	);
	checks.push("Unfiltered archive: hidden card covers make no image requests");
	await archiveContext.close();

	await writeFile(
		resolve(output, "checks.json"),
		JSON.stringify(checks, null, 2),
	);
	console.log(checks.join("\n"));
} finally {
	await browser.close();
}
