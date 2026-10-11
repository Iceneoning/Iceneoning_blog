type ParticleKind = "glow" | "dust" | "shard" | "streak";

interface HeroParticle {
	kind: ParticleKind;
	offset: number;
	speed: number;
	band: number;
	amplitude: number;
	phase: number;
	size: number;
	alpha: number;
	rotation: number;
	spin: number;
}

let disposeNovelHeroEffects: (() => void) | undefined;

function seededRandom(seed: number) {
	let value = seed >>> 0;
	return () => {
		value = (value * 1664525 + 1013904223) >>> 0;
		return value / 0x100000000;
	};
}

function createParticles(count: number): HeroParticle[] {
	const random = seededRandom(0x46555741);

	return Array.from({ length: count }, (_, index) => {
		const selector = index % 12;
		const kind: ParticleKind =
			selector === 0 || selector === 6
				? "shard"
				: selector === 3 || selector === 9
					? "streak"
					: selector === 2 || selector === 7 || selector === 10
						? "dust"
						: "glow";

		return {
			kind,
			offset: random(),
			speed:
				kind === "streak"
					? 0.055 + random() * 0.045
					: 0.022 + random() * 0.046,
			band: (random() - 0.5) * 0.42,
			amplitude: 0.035 + random() * 0.095,
			phase: random() * Math.PI * 2,
			size:
				kind === "shard"
					? 5 + random() * 8
					: kind === "streak"
						? 2.2 + random() * 3.6
						: kind === "dust"
							? 0.8 + random() * 1.8
							: 1.8 + random() * 4.2,
			alpha: 0.38 + random() * 0.58,
			rotation: random() * Math.PI * 2,
			spin: (random() - 0.5) * 0.42,
		};
	});
}

function initNovelHeroEffects() {
	disposeNovelHeroEffects?.();
	disposeNovelHeroEffects = undefined;

	const root = document.querySelector<HTMLElement>("[data-novel-hero-graphics]");
	const canvas = root?.querySelector<HTMLCanvasElement>(
		"[data-novel-hero-particles]",
	);
	if (!root || !canvas) return;

	const narrowViewport = window.matchMedia("(max-width: 900px)");
	if (narrowViewport.matches) return;

	const context = canvas.getContext("2d");
	if (!context) return;

	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	const layers = Array.from(
		root.querySelectorAll<HTMLElement>("[data-hero-depth]"),
	);

	const readPrimaryColor = () =>
		getComputedStyle(document.documentElement)
			.getPropertyValue("--primary")
			.trim() || "rgba(155, 218, 255, 1)";
	let primaryColor = readPrimaryColor();

	let width = 0;
	let height = 0;
	let dpr = 1;
	let animationFrame = 0;
	let lastFrame = 0;
	let running = true;
	let visible = true;
	let pointerTargetX = 0;
	let pointerTargetY = 0;
	let pointerX = 0;
	let pointerY = 0;
	let particles: HeroParticle[] = [];

	const rebuildParticles = () => {
		const targetCount = Math.max(42, Math.min(82, Math.round(width / 18)));
		particles = createParticles(targetCount);
	};

	const resize = () => {
		const rect = root.getBoundingClientRect();
		width = Math.max(1, rect.width);
		height = Math.max(1, rect.height);
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		context.setTransform(dpr, 0, 0, dpr, 0, 0);
		rebuildParticles();
	};

	const setLayerParallax = () => {
		for (const layer of layers) {
			const depth = Number(layer.dataset.heroDepth ?? 0);
			layer.style.setProperty(
				"--hero-parallax-x",
				`${(pointerX * depth).toFixed(2)}px`,
			);
			layer.style.setProperty(
				"--hero-parallax-y",
				`${(pointerY * depth).toFixed(2)}px`,
			);
		}
	};

	const drawGlow = (
		x: number,
		y: number,
		radius: number,
		alpha: number,
	) => {
		context.save();
		context.globalAlpha = alpha;
		context.fillStyle = "#fbfeff";
		context.shadowColor = primaryColor;
		context.shadowBlur = radius * 6;
		context.beginPath();
		context.arc(x, y, radius, 0, Math.PI * 2);
		context.fill();
		context.restore();
	};

	const drawShard = (
		x: number,
		y: number,
		size: number,
		alpha: number,
		rotation: number,
	) => {
		context.save();
		context.translate(x, y);
		context.rotate(rotation);
		context.globalAlpha = alpha;

		const gradient = context.createLinearGradient(-size, -size, size, size);
		gradient.addColorStop(0, "rgba(255,255,255,0.92)");
		gradient.addColorStop(0.45, "rgba(180,232,255,0.62)");
		gradient.addColorStop(1, "rgba(190,170,255,0.3)");

		context.fillStyle = gradient;
		context.strokeStyle = "rgba(255,255,255,0.68)";
		context.lineWidth = 0.9;
		context.shadowColor = primaryColor;
		context.shadowBlur = 16;
		context.beginPath();
		context.moveTo(0, -size);
		context.lineTo(size * 0.72, size * 0.7);
		context.lineTo(0, size * 0.32);
		context.lineTo(-size * 0.55, size * 0.48);
		context.closePath();
		context.fill();
		context.stroke();
		context.restore();
	};

	const drawStreak = (
		x: number,
		y: number,
		size: number,
		alpha: number,
		phase: number,
	) => {
		const length = size * 9;
		const angle = -0.24 + Math.sin(phase) * 0.08;
		const dx = Math.cos(angle) * length;
		const dy = Math.sin(angle) * length;
		const gradient = context.createLinearGradient(x - dx, y - dy, x, y);
		gradient.addColorStop(0, "rgba(255,255,255,0)");
		gradient.addColorStop(0.7, "rgba(205,242,255,0.42)");
		gradient.addColorStop(1, "rgba(255,255,255,0.96)");

		context.save();
		context.globalAlpha = alpha;
		context.strokeStyle = gradient;
		context.lineWidth = Math.max(1, size * 0.5);
		context.lineCap = "round";
		context.shadowColor = primaryColor;
		context.shadowBlur = 10;
		context.beginPath();
		context.moveTo(x - dx, y - dy);
		context.lineTo(x, y);
		context.stroke();
		context.restore();
	};

	const drawParticles = (timeSeconds: number) => {
		context.clearRect(0, 0, width, height);
		context.save();
		context.globalCompositeOperation = "lighter";

		for (const particle of particles) {
			const progress =
				(particle.offset + timeSeconds * particle.speed) % 1;
			const envelope = Math.sin(Math.PI * progress);
			const flowX = 0.27 + progress * 0.66;
			const wave =
				Math.sin(progress * Math.PI * 2.1 + particle.phase) *
				particle.amplitude;
			const flowY = 0.5 + particle.band + wave;
			const x = width * flowX;
			const y = height * flowY;
			const twinkle = 0.72 + 0.28 * Math.sin(timeSeconds * 1.8 + particle.phase);
			const alpha = particle.alpha * Math.max(0, envelope) * twinkle;

			if (particle.kind === "shard") {
				drawShard(
					x,
					y,
					particle.size,
					alpha * 0.82,
					particle.rotation + timeSeconds * particle.spin,
				);
				continue;
			}

			if (particle.kind === "streak") {
				drawStreak(
					x,
					y,
					particle.size,
					alpha * 0.9,
					timeSeconds + particle.phase,
				);
				continue;
			}

			if (particle.kind === "dust") {
				context.save();
				context.globalAlpha = alpha * 0.72;
				context.fillStyle = "rgba(242, 252, 255, 0.96)";
				context.shadowColor = primaryColor;
				context.shadowBlur = 5;
				context.beginPath();
				context.arc(x, y, particle.size, 0, Math.PI * 2);
				context.fill();
				context.restore();
				continue;
			}

			drawGlow(x, y, particle.size, alpha);
		}

		context.restore();
	};

	const render = (timestamp: number) => {
		if (!running) return;

		pointerX += (pointerTargetX - pointerX) * 0.07;
		pointerY += (pointerTargetY - pointerY) * 0.07;
		setLayerParallax();

		if (visible) {
			if (reducedMotion.matches) {
				if (lastFrame === 0) drawParticles(12);
			} else {
				drawParticles(timestamp * 0.001);
			}
		}

		lastFrame = timestamp;
		animationFrame = window.requestAnimationFrame(render);
	};

	const onPointerMove = (event: PointerEvent) => {
		if (reducedMotion.matches) return;

		const rect = root.getBoundingClientRect();
		const normalizedX =
			(event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
		const normalizedY =
			(event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;

		pointerTargetX = normalizedX * 26;
		pointerTargetY = normalizedY * 16;
	};

	const onPointerLeave = () => {
		pointerTargetX = 0;
		pointerTargetY = 0;
	};

	const resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(root);

	const themeObserver = new MutationObserver(() => {
		primaryColor = readPrimaryColor();
	});
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "style"],
	});

	const intersectionObserver = new IntersectionObserver(
		(entries) => {
			visible = entries.some((entry) => entry.isIntersecting);
		},
		{ threshold: 0.05 },
	);
	intersectionObserver.observe(root);

	root.addEventListener("pointermove", onPointerMove, { passive: true });
	root.addEventListener("pointerleave", onPointerLeave);

	resize();
	animationFrame = window.requestAnimationFrame(render);

	disposeNovelHeroEffects = () => {
		running = false;
		window.cancelAnimationFrame(animationFrame);
		resizeObserver.disconnect();
		themeObserver.disconnect();
		intersectionObserver.disconnect();
		root.removeEventListener("pointermove", onPointerMove);
		root.removeEventListener("pointerleave", onPointerLeave);

		for (const layer of layers) {
			layer.style.removeProperty("--hero-parallax-x");
			layer.style.removeProperty("--hero-parallax-y");
		}
	};
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initNovelHeroEffects, {
		once: true,
	});
} else {
	initNovelHeroEffects();
}

function setupNovelHeroSwup() {
	window.swup.hooks.on("page:view", initNovelHeroEffects);
}

if (window.swup?.hooks) setupNovelHeroSwup();
else document.addEventListener("swup:enable", setupNovelHeroSwup, { once: true });
