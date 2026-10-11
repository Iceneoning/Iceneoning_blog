import { DARK_MODE } from "@constants/constants.ts";
import { expressiveCodeConfig, siteConfig } from "@/config";
import type { LIGHT_DARK_MODE } from "@/types/config";

type ThemeColorPreset = {
	hue: number;
	hex: string;
	chromaScale: number;
	label: string;
};

export const THEME_COLOR_PRESETS: ThemeColorPreset[] = [
	{ hue: 34, hex: "#a59d9b", chromaScale: 0.08, label: "浅灰" },
	{ hue: 298, hex: "#a18ccf", chromaScale: 0.85, label: "明亮紫" },
	{ hue: 250, hex: "#2f8fff", chromaScale: 1, label: "湛蓝" },
];

function getCircularDistance(from: number, to: number): number {
	const diff = Math.abs(from - to) % 360;
	return Math.min(diff, 360 - diff);
}

function getClosestPreset(hue: number): ThemeColorPreset {
	const normalizedHue = ((hue % 360) + 360) % 360;
	return THEME_COLOR_PRESETS.reduce((closest, current) =>
		getCircularDistance(normalizedHue, current.hue) <
		getCircularDistance(normalizedHue, closest.hue)
			? current
			: closest,
	);
}

export function getDefaultHue(): number {
	const fallback = String(siteConfig.themeColor.hue);
	if (typeof document === "undefined") return getClosestPreset(Number(fallback)).hue;
	const configCarrier = document.getElementById("config-carrier");
	const defaultHue = Number.parseInt(configCarrier?.dataset.hue || fallback, 10);
	return getClosestPreset(defaultHue).hue;
}

export function getHue(): number {
	if (typeof localStorage === "undefined") return getDefaultHue();
	const stored = localStorage.getItem("hue");
	const hue = stored ? Number.parseInt(stored, 10) : getDefaultHue();
	return getClosestPreset(hue).hue;
}

export function setHue(hue: number): void {
	const preset = getClosestPreset(hue);
	if (typeof document === "undefined" || typeof localStorage === "undefined") return;
	localStorage.setItem("hue", String(preset.hue));
	const r = document.querySelector(":root") as HTMLElement;
	if (!r) {
		return;
	}
	r.style.setProperty("--hue", String(preset.hue));
	r.style.setProperty("--primary", preset.hex);
	r.style.setProperty("--theme-chroma-scale", String(preset.chromaScale));
}

export function applyThemeToDocument(_theme: LIGHT_DARK_MODE) {
	// The site now has one intentional night theme; retain the public API for callers.
	document.documentElement.classList.add("dark");

	// Set the theme for Expressive Code
	document.documentElement.setAttribute(
		"data-theme",
		expressiveCodeConfig.theme,
	);
}

export function setTheme(_theme: LIGHT_DARK_MODE): void {
	localStorage.setItem("theme", DARK_MODE);
	applyThemeToDocument(DARK_MODE);
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	return DARK_MODE;
}
