import { type CollectionEntry, getCollection } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryUrl } from "@utils/url-utils.ts";

let rawSortedPostsPromise: Promise<CollectionEntry<"posts">[]> | undefined;

// Retrieve visible posts once per module instance and keep ordering deterministic.
async function loadRawSortedPosts() {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	return allBlogPosts.sort((a, b) => {
		const dateDifference =
			b.data.published.getTime() - a.data.published.getTime();
		return dateDifference || a.slug.localeCompare(b.slug, "zh-CN");
	});
}

function getRawSortedPosts() {
	rawSortedPostsPromise ??= loadRawSortedPosts();
	return rawSortedPostsPromise;
}

export async function getSortedPosts() {
	const sorted = await getRawSortedPosts();

	return sorted.map((post, index) => ({
		...post,
		data: {
			...post.data,
			nextSlug: index > 0 ? sorted[index - 1].slug : "",
			nextTitle: index > 0 ? sorted[index - 1].data.title : "",
			prevSlug: index < sorted.length - 1 ? sorted[index + 1].slug : "",
			prevTitle: index < sorted.length - 1 ? sorted[index + 1].data.title : "",
		},
	}));
}
export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(): Promise<Tag[]> {
	const allBlogPosts = await getRawSortedPosts();

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	// sort tags
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(): Promise<Category[]> {
	const allBlogPosts = await getRawSortedPosts();
	const count: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { category: string | null } }) => {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized);
			count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
			return;
		}

		const categoryName =
			typeof post.data.category === "string"
				? post.data.category.trim()
				: String(post.data.category).trim();

		count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
	});

	const lst = Object.keys(count).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c),
		});
	}
	return ret;
}
