<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { url } from "@utils/url-utils.ts";
import { onMount } from "svelte";
import type { SearchResult } from "@/global";

let keywordDesktop = "";
let keywordMobile = "";
let result: SearchResult[] = [];
let isSearching = false;
let pagefindLoaded = false;
let initialized = false;
let desktopSearchTimer: ReturnType<typeof setTimeout> | undefined;
let mobileSearchTimer: ReturnType<typeof setTimeout> | undefined;
let desktopRequestId = 0;
let mobileRequestId = 0;

const fakeResult: SearchResult[] = [
	{
		url: url("/"),
		meta: {
			title: "这是一个模拟搜索结果",
		},
		excerpt: "因为搜索功能在 <mark>dev</mark> 环境下不可用。",
	},
	{
		url: url("/"),
		meta: {
			title: "如果你想测试搜索功能",
		},
		excerpt: "请改用 <mark>npm build && npm preview</mark> 进行测试。",
	},
];

const togglePanel = () => {
	const panel = document.getElementById("search-panel");
	panel?.classList.toggle("float-panel-closed");
	requestPagefind();
};

const requestPagefind = () => {
	if (import.meta.env.PROD && !pagefindLoaded) {
		document.dispatchEvent(new CustomEvent("pagefind:request"));
	}
};

const setPanelVisibility = (show: boolean, isDesktop: boolean): void => {
	const panel = document.getElementById("search-panel");
	if (!panel || !isDesktop) return;

	if (show) {
		panel.classList.remove("float-panel-closed");
	} else {
		panel.classList.add("float-panel-closed");
	}
};

const search = async (keyword: string, isDesktop: boolean): Promise<void> => {
	const requestId = isDesktop ? ++desktopRequestId : ++mobileRequestId;
	if (!keyword) {
		setPanelVisibility(false, isDesktop);
		result = [];
		isSearching = false;
		return;
	}

	if (!initialized) {
		return;
	}
	if (import.meta.env.PROD && !pagefindLoaded) {
		requestPagefind();
		return;
	}

	isSearching = true;

	try {
		let searchResults: SearchResult[] = [];

		if (import.meta.env.PROD && pagefindLoaded && window.pagefind) {
			const response = await window.pagefind.search(keyword);
			if (isDesktop ? requestId !== desktopRequestId : requestId !== mobileRequestId) return;
			searchResults = await Promise.all(
				response.results.slice(0, 12).map((item) => item.data()),
			);
		} else if (import.meta.env.DEV) {
			searchResults = fakeResult;
		} else {
			searchResults = [];
			console.error("Pagefind is not available in production environment.");
		}

		const isLatestRequest = isDesktop
			? requestId === desktopRequestId
			: requestId === mobileRequestId;
		if (!isLatestRequest) return;

		result = searchResults.slice(0, 12);
		setPanelVisibility(result.length > 0, isDesktop);
	} catch (error) {
		if (isDesktop ? requestId !== desktopRequestId : requestId !== mobileRequestId) return;
		console.error("Search error:", error);
		result = [];
		setPanelVisibility(false, isDesktop);
	} finally {
		const isLatestRequest = isDesktop
			? requestId === desktopRequestId
			: requestId === mobileRequestId;
		if (isLatestRequest) isSearching = false;
	}
};

const scheduleSearch = (keyword: string, isDesktop: boolean) => {
	// Invalidate in-flight results as soon as input changes, before debounce.
	if (isDesktop) desktopRequestId++;
	else mobileRequestId++;
	const existingTimer = isDesktop ? desktopSearchTimer : mobileSearchTimer;
	if (existingTimer) clearTimeout(existingTimer);

	const timer = setTimeout(() => search(keyword.trim(), isDesktop), 120);
	if (isDesktop) desktopSearchTimer = timer;
	else mobileSearchTimer = timer;
};

onMount(() => {
	const initializeSearch = () => {
		initialized = true;
		pagefindLoaded =
			typeof window !== "undefined" &&
			!!window.pagefind &&
			typeof window.pagefind.search === "function";
		if (keywordDesktop) search(keywordDesktop, true);
		if (keywordMobile) search(keywordMobile, false);
	};
	const handlePagefindReady = () => initializeSearch();
	const handlePagefindError = () => {
		pagefindLoaded = false;
	};

	if (import.meta.env.DEV) {
		initializeSearch();
	} else {
		document.addEventListener("pagefindready", handlePagefindReady);
		document.addEventListener("pagefindloaderror", handlePagefindError);
		initializeSearch();
	}

	return () => {
		initialized = false;
		desktopRequestId++;
		mobileRequestId++;
		document.removeEventListener("pagefindready", handlePagefindReady);
		document.removeEventListener("pagefindloaderror", handlePagefindError);
		if (desktopSearchTimer) clearTimeout(desktopSearchTimer);
		if (mobileSearchTimer) clearTimeout(mobileSearchTimer);
	};
});

$: if (initialized) {
	scheduleSearch(keywordDesktop, true);
}

$: if (initialized) {
	scheduleSearch(keywordMobile, false);
}
</script>

<!-- search bar for desktop view -->
<div id="search-bar" class="hidden lg:flex transition-all items-center h-11 mr-2 rounded-lg
      bg-black/[0.04] hover:bg-black/[0.06] focus-within:bg-black/[0.06]
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
">
    <Icon icon="material-symbols:search" class="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30"></Icon>
    <input placeholder="{i18n(I18nKey.search)}" bind:value={keywordDesktop} on:focus={requestPagefind}
           class="transition-all pl-10 text-sm bg-transparent outline-0
         h-full w-40 active:w-60 focus:w-60 text-black/50 dark:text-white/50"
    >
</div>

<!-- toggle btn for phone/tablet view -->
<button on:click={togglePanel} aria-label="搜索面板" id="search-switch"
        class="btn-plain scale-animation lg:!hidden rounded-lg w-11 h-11 active:scale-90">
    <Icon icon="material-symbols:search" class="text-[1.25rem]"></Icon>
</button>

<!-- search panel -->
<div id="search-panel" class="float-panel float-panel-closed search-panel absolute md:w-[30rem]
top-20 left-4 md:left-[unset] right-4 shadow-2xl rounded-2xl p-2">

    <!-- search bar inside panel for phone/tablet -->
    <div id="search-bar-inside" class="flex relative lg:hidden transition-all items-center h-11 rounded-xl
      bg-black/[0.04] hover:bg-black/[0.06] focus-within:bg-black/[0.06]
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
  ">
        <Icon icon="material-symbols:search" class="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30"></Icon>
		 <input placeholder={i18n(I18nKey.search)} bind:value={keywordMobile} on:focus={requestPagefind}
               class="pl-10 absolute inset-0 text-sm bg-transparent outline-0
               focus:w-60 text-black/50 dark:text-white/50"
        >
    </div>

    <!-- search results -->
    {#each result as item}
        <a href={item.url}
           class="transition first-of-type:mt-2 lg:first-of-type:mt-0 group block
       rounded-xl text-lg px-3 py-2 hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)]">
            <div class="transition text-90 inline-flex font-bold group-hover:text-[var(--primary)]">
                {item.meta.title}<Icon icon="fa6-solid:chevron-right" class="transition text-[0.75rem] translate-x-1 my-auto text-[var(--primary)]"></Icon>
            </div>
            <div class="transition text-sm text-50">
                {@html item.excerpt}
            </div>
        </a>
    {/each}
</div>

<style>
  input:focus {
    outline: 0;
  }
  .search-panel {
    max-height: calc(100vh - 100px);
    overflow-y: auto;
  }
</style>
