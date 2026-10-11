// Production preview audit. Uses an existing Playwright installation; no download.
// PLAYWRIGHT_MODULE may point to a bundled Playwright package.
// Run: node scripts/performance-audit.mjs baseline
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const label = process.argv[2] || "audit";
const base = process.env.AUDIT_URL || "http://127.0.0.1:4321";
const output = resolve(".codex-fps-frames", "performance", label);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
	headless: true,
	channel: process.env.AUDIT_BROWSER || "msedge",
});
const results = [];
try {
	for (const route of ["/", "/novels/", "/novels/yaoxing/001/"]) {
		const runs = [];
		for (let run = 0; run < 3; run++) {
			const context = await browser.newContext({
				viewport: { width: 1440, height: 900 },
			});
			await context.addInitScript(() => {
				sessionStorage.setItem("iceneoning-star-intro-v45-seen", "1");
				window.__audit = {
					writes: {},
					reads: {},
					clearArea: 0,
					clears: 0,
					longTasks: [],
				};
				const setProperty = CSSStyleDeclaration.prototype.setProperty;
				CSSStyleDeclaration.prototype.setProperty = function (name, ...args) {
					window.__audit.writes[name] = (window.__audit.writes[name] || 0) + 1;
					return setProperty.call(this, name, ...args);
				};
				const bounds = Element.prototype.getBoundingClientRect;
				Element.prototype.getBoundingClientRect = function () {
					const key = this.hasAttribute("data-novel-crystal-root")
						? "crystal"
						: this.hasAttribute("data-novel-prose")
							? "prose"
							: this.id || this.tagName;
					window.__audit.reads[key] = (window.__audit.reads[key] || 0) + 1;
					return bounds.call(this);
				};
				const clear = CanvasRenderingContext2D.prototype.clearRect;
				CanvasRenderingContext2D.prototype.clearRect = function (x, y, w, h) {
					if (this.canvas.id === "fuwari-mouse-spark-canvas") {
						// Record actual canvas pixels, clipping the transformed clear to its bounds.
						const transform = this.getTransform();
						const left = Math.max(0, x * transform.a),
							top = Math.max(0, y * transform.d);
						const right = Math.min(this.canvas.width, (x + w) * transform.a);
						const bottom = Math.min(this.canvas.height, (y + h) * transform.d);
						window.__audit.clearArea +=
							Math.max(0, right - left) * Math.max(0, bottom - top);
						window.__audit.clears++;
					}
					return clear.call(this, x, y, w, h);
				};
				new PerformanceObserver((list) =>
					window.__audit.longTasks.push(
						...list.getEntries().map((e) => e.duration),
					),
				).observe({ type: "longtask", buffered: true });
			});
			const page = await context.newPage();
			const errors = [];
			page.on("pageerror", (error) => errors.push(error.message));
			await page.goto(base + route, { waitUntil: "networkidle" });
			await page.waitForTimeout(1000);
			const cdp = await context.newCDPSession(page);
			await cdp.send("Performance.enable");
			const before = await cdp.send("Performance.getMetrics");
			await page.evaluate(() => {
				window.__audit.writes = {};
				window.__audit.reads = {};
			});
			await page.waitForTimeout(3000);
			const idle = await page.evaluate(() =>
				JSON.parse(JSON.stringify(window.__audit)),
			);
			const after = await cdp.send("Performance.getMetrics");
			await page.evaluate(() => {
				window.__audit.clearArea = 0;
				window.__audit.clears = 0;
				window.__audit.reads = {};
			});
			const crystal = page.locator("[data-novel-crystal-root]");
			const box = (await crystal.count()) ? await crystal.boundingBox() : null;
			const x = box ? box.x + box.width * 0.75 : 700;
			const y = box ? box.y + box.height * 0.5 : 450;
			await page.mouse.move(x, y);
			await page.mouse.click(x, y);
			for (let i = 0; i < 90; i++) {
				await page.mouse.move(
					x + Math.sin(i / 10) * 80,
					y + Math.cos(i / 10) * 45,
				);
				await page.waitForTimeout(8);
			}
			await page.waitForTimeout(1000);
			const interaction = await page.evaluate(() =>
				JSON.parse(JSON.stringify(window.__audit)),
			);
			const metricDelta = Object.fromEntries(
				[
					"TaskDuration",
					"ScriptDuration",
					"RecalcStyleDuration",
					"LayoutDuration",
					"RecalcStyleCount",
				].map((name) => [
					name,
					after.metrics.find((m) => m.name === name).value -
						before.metrics.find((m) => m.name === name).value,
				]),
			);
			const resources = await page.evaluate(() =>
				performance
					.getEntriesByType("resource")
					.map((r) => ({
						name: new URL(r.name).pathname,
						bytes: r.transferSize,
						duration: r.duration,
					}))
					.sort((a, b) => b.bytes - a.bytes)
					.slice(0, 8),
			);
			runs.push({ idle, interaction, metricDelta, resources, errors });
			if (run === 0)
				await page.screenshot({
					path: resolve(output, route.replaceAll("/", "_") + ".png"),
				});
			await context.close();
		}
		results.push({ route, runs });
	}
	// Keep the source alongside the baseline for deterministic canvas comparison.
	await writeFile(
		resolve(output, "mouse-source.astro"),
		await readFile("src/components/effects/MouseSparkEffect.astro"),
	);
	await writeFile(
		resolve(output, "results.json"),
		JSON.stringify(results, null, 2),
	);
	console.log(
		JSON.stringify(
			results.map(({ route, runs }) => ({
				route,
				runs: runs.map((r) => ({
					idleWrites: r.idle.writes,
					idleMetrics: r.metricDelta,
					interactionReads: r.interaction.reads,
					clears: r.interaction.clears,
					clearMegapixels: Math.round(r.interaction.clearArea / 1e6),
					errors: r.errors,
				})),
				largestResources: runs[0].resources,
			})),
			null,
			2,
		),
	);
} finally {
	await browser.close();
}
