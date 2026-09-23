import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";

export const siteConfig: SiteConfig = {
	title: "冰霓の梦之旅",
	subtitle: "",
	description: "分享生活趣事，学习技术，做好游戏",
	lang: "zh_CN", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
	themeColor: {
		hue: 250, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
		fixed: false, // Hide the theme color picker for visitors
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 2, // Maximum heading depth to show in the table, from 1 to 3
	},
	favicon: [
		// Leave this array empty to use the default favicon
		// {
		//   src: '/favicon/icon.png',    // Path of the favicon, relative to the /public directory
		//   theme: 'light',              // (Optional) Either 'light' or 'dark', set only if you have different favicons for light and dark mode
		//   sizes: '32x32',              // (Optional) Size of the favicon, set only if you have favicons of different sizes
		// }
	],
};

export const backgroundConfig = {
	enable: true,
	src: "/background/site-bg.webp", // Path relative to /public when it starts with '/'
	
	blur: 0, // Blur radius in px for frosted effect
	overlayLight: 0.42, // Light mode overlay opacity
	overlayDark: 0.5, // Dark mode overlay opacity
	scale: 1.08, // Slight scale to avoid blur edge clipping
};

export const navBarConfig: NavBarConfig = {
	links: [
		{
			name: "启航",
			url: "/",
		},
		{
			name: "介绍",
			url: "/intro/",
		},
		{
			name: "目录",
			url: "/archive/",
		},
		{
			name: "小说",
			url: "/novels/",
		},
		{
			name: "杂谈",
			url: "/archive/?category=杂谈",
		},
		{
			name: "代码",
			url: "/archive/?category=代码",
		},
		{
			name: "友之屋",
			url: "/friends/",
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "/Portrait/Iceneoning.webp",
	name: "冰霓Iceneon",
	bio: "你好啊，很高心认识你。",
	links: [
		{
			name: "Email",
			icon: "fa6-regular:envelope", // Visit https://icones.js.org/ for icon codes
			// You will need to install the corresponding icon set if it's not already included
			// `pnpm add @iconify-json/<icon-set-name>`
			url: "mailto:woshisos@foxmail.com",
		},
		{
			name: "Steam",
			icon: "fa6-brands:steam",
			url: "https://steamcommunity.com/profiles/76561199133691668/",
		},
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/Iceneoning",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
	// Please select a dark theme, as this blog theme currently only supports dark background color
	theme: "github-dark",
};
