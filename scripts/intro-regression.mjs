// Pixel and lifecycle comparison against a saved pre-change intro source.
// Uses an existing Playwright installation and the local production preview.

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ts = require("typescript");
const output = resolve(
	process.env.INTRO_OUTPUT || ".codex-fps-frames/performance/intro",
);
await mkdir(output, { recursive: true });
const current = await readFile("src/scripts/star-intro.ts", "utf8");
const lifecycleSource = await readFile(
	"src/scripts/intro-lifecycle.ts",
	"utf8",
);
if (process.argv.includes("--save-baseline")) {
	await writeFile(resolve(output, "baseline.ts"), current);
	console.log("Saved intro baseline source");
	process.exit(0);
}
const baseline = await readFile(
	process.env.INTRO_BASELINE || resolve(output, "baseline.ts"),
	"utf8",
);
const browser = await chromium.launch({
	channel: process.env.AUDIT_BROWSER || "msedge",
	headless: true,
});
const url = process.env.AUDIT_URL || "http://127.0.0.1:4321";
const points = [
	0, 0.1, 0.25, 0.5, 0.6, 0.605, 0.606, 0.68, 0.8, 0.94, 0.985, 0.999,
];
const checks = [];

async function sample(source, viewport, noWebGL = false) {
	const context = await browser.newContext({ viewport });
	const page = await context.newPage();
	await page.route(`${url}/intro-test`, (route) =>
		route.fulfill({
			contentType: "text/html",
			body: '<html data-site-intro-pending><body><div id="star-intro-overlay"><canvas id="star-intro-canvas"></canvas><canvas id="star-intro-fallback"></canvas><div id="star-intro-copy"></div><button id="star-intro-skip">skip</button></div></body></html>',
		}),
	);
	await page.goto(`${url}/intro-test`);
	await page.evaluate((noWebGL) => {
		window.requestAnimationFrame = () => 1;
		window.setTimeout = () => 1;
		const original = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
			if (noWebGL && kind === "webgl") return null;
			return original.call(this, kind, ...args);
		};
		window.__calls = {
			define: 0,
			update: 0,
			uniform: 0,
			viewport: 0,
			program: 0,
			activeTexture: 0,
			bindTexture: 0,
			pulseDistances: 0,
		};
		const hypot = Math.hypot;
		Math.hypot = (...args) => {
			window.__calls.pulseDistances++;
			return hypot(...args);
		};
		for (const [name, key] of [
			["texImage2D", "define"],
			["texSubImage2D", "update"],
			["uniform1f", "uniform"],
			["uniform2f", "uniform"],
			["viewport", "viewport"],
			["useProgram", "program"],
			["activeTexture", "activeTexture"],
			["bindTexture", "bindTexture"],
		]) {
			const original = WebGLRenderingContext.prototype[name];
			WebGLRenderingContext.prototype[name] = function (...args) {
				window.__calls[key]++;
				return original.apply(this, args);
			};
		}
	}, noWebGL);
	const exposed = source.replace(
		"})();",
		"window.__introTest={renderJS,renderWebGL,resize,tick,onContextLost,skySource,fallback,canvas,getGL:()=>gl,getSize:()=>[width,height]};})();",
	);
	const code = ts
		.transpileModule(
			lifecycleSource.replace(/export /g, "") +
				"\n" +
				exposed.replace(/^import .*intro-lifecycle.*;\s*$/m, ""),
			{
				compilerOptions: {
					target: ts.ScriptTarget.ES2022,
					module: ts.ModuleKind.ES2022,
				},
			},
		)
		.outputText.replace(/export\s*\{\s*\};?\s*$/, "");
	await page.addScriptTag({ content: code });
	const data = await page.evaluate(async (points) => {
		const test = window.__introTest;
		const hash = async (bytes) =>
			Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
				.map((v) => v.toString(16).padStart(2, "0"))
				.join("");
		const samples = [];
		for (const p of points) {
			test.renderJS(3.6 * p, p);
			const [w, h] = test.getSize();
			const sourceHash = await hash(
				test.skySource.getContext("2d").getImageData(0, 0, w, h).data,
			);
			let gpuHash = null;
			let fallbackHash = null;
			const gl = test.getGL();
			if (gl) {
				test.renderWebGL(3.6 * p, p, true);
				const pixels = new Uint8Array(w * h * 4);
				gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
				gpuHash = await hash(pixels);
				if (gl.getError() !== gl.NO_ERROR)
					throw Error(`WebGL error at progress ${p}`);
			} else {
				const fb = test.fallback.getContext("2d");
				fb.clearRect(0, 0, w, h);
				fb.drawImage(test.skySource, 0, 0);
				fallbackHash = await hash(fb.getImageData(0, 0, w, h).data);
			}
			samples.push({ p, sourceHash, gpuHash, fallbackHash });
		}
		// Rendering benchmarks exclude the readback/hash verification above.
		const renderTimes = [];
		for (let run = 0; run < 3; run++) {
			const start = performance.now();
			for (let i = 0; i < 90; i++) test.renderJS((3.6 * i) / 90, i / 90);
			renderTimes.push(performance.now() - start);
		}
		return {
			samples,
			calls: window.__calls,
			renderTimes,
			fallbackSize: [test.fallback.width, test.fallback.height],
		};
	}, points);
	// Canvas/texture size changes must also preserve output and upload validity.
	await page.setViewportSize({
		width: viewport.width + 37,
		height: viewport.height + 19,
	});
	await page.evaluate(() => window.__introTest.resize());
	const resized = await page.evaluate(async () => {
		const test = window.__introTest;
		test.renderJS(2.52, 0.7);
		const gl = test.getGL();
		if (!gl) return null;
		test.renderWebGL(2.52, 0.7, true);
		const [w, h] = test.getSize();
		const pixels = new Uint8Array(w * h * 4);
		gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		if (gl.getError() !== gl.NO_ERROR) throw Error("WebGL error after resize");
		return Array.from(
			new Uint8Array(await crypto.subtle.digest("SHA-256", pixels)),
		)
			.map((v) => v.toString(16).padStart(2, "0"))
			.join("");
	});
	let lifecycle;
	if (
		source.includes('canvas.addEventListener("webglcontextlost",onContextLost)')
	) {
		lifecycle = await page.evaluate(() => {
			const test = window.__introTest;
			const event = new Event("webglcontextlost", { cancelable: true });
			test.canvas.dispatchEvent(event);
			test.tick(16);
			const fallbackReady =
				event.defaultPrevented &&
				test.fallback.style.display === "block" &&
				test.fallback.width === test.getSize()[0] &&
				test.fallback.height === test.getSize()[1];
			window.__siteStarIntroDestroy();
			return {
				fallbackReady,
				cleaned:
					!document.getElementById("star-intro-overlay") &&
					test.canvas.width === 1 &&
					test.fallback.width === 1,
			};
		});
		assert.deepEqual(lifecycle, { fallbackReady: true, cleaned: true });
	}
	await context.close();
	return { ...data, resized, lifecycle };
}

try {
	const records = [];
	for (const viewport of [
		{ width: 640, height: 360 },
		{ width: 390, height: 844 },
		{ width: 1440, height: 900 },
	]) {
		const before = await sample(baseline, viewport);
		const after = await sample(current, viewport);
		assert.deepEqual(
			after.samples,
			before.samples,
			`Intro pixels differ at ${viewport.width}x${viewport.height}`,
		);
		assert.equal(after.resized, before.resized, "Resized intro pixels differ");
		records.push({ viewport, before, after });
		checks.push(
			`${viewport.width}x${viewport.height}: 12 source/GPU frame pairs and resized frame identical`,
		);
		console.log(checks.at(-1));
	}
	const fallbackBefore = await sample(
		baseline,
		{ width: 390, height: 844 },
		true,
	);
	const fallbackAfter = await sample(
		current,
		{ width: 390, height: 844 },
		true,
	);
	assert.deepEqual(fallbackAfter.samples, fallbackBefore.samples);
	checks.push("WebGL unavailable: identical 2D starfield");
	await writeFile(
		resolve(output, "results.json"),
		JSON.stringify({ checks, records }, null, 2),
	);
	console.log(
		JSON.stringify(
			records.map((r) => ({
				viewport: r.viewport,
				beforeCalls: r.before.calls,
				afterCalls: r.after.calls,
				beforeRenderMs: r.before.renderTimes,
				afterRenderMs: r.after.renderTimes,
			})),
			null,
			2,
		),
	);
} finally {
	await browser.close();
}
