// Copyright (c) 2026 Iceneoning — original V4.5 intro lifecycle portions.
// License: LICENSES/STAR_INTRO_LICENSE.md (source-available, non-commercial).
// Existing Fuwari MIT / third-party rights remain unaffected.
// The star curtain is opaque until preparation starts. Wallpaper and ambient
// effects can wait for this event without changing the intro's render budget.
export function isIntroCoveringPage(): boolean {
	const root = document.documentElement;
	return (
		root.hasAttribute("data-site-intro-pending") &&
		!root.hasAttribute("data-site-intro-preparing")
	);
}

export function prepareIntroPage(): void {
	const root = document.documentElement;
	if (
		!root.hasAttribute("data-site-intro-pending") ||
		root.hasAttribute("data-site-intro-preparing")
	)
		return;
	root.setAttribute("data-site-intro-preparing", "");
	document.dispatchEvent(new Event("site:intro-prepare"));
}
