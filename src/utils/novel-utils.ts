import { type CollectionEntry, getCollection } from "astro:content";
import { getNovelChapterUrl } from "./url-utils";

type NovelEntry = CollectionEntry<"novels">;
type NovelData = NovelEntry["data"];
type NovelSeriesData = Extract<NovelData, { type: "novel" }>;
type NovelChapterData = Extract<NovelData, { type: "chapter" }>;

export type NovelSeriesEntry = Omit<NovelEntry, "data"> & {
	data: NovelSeriesData;
};

export type NovelChapterEntry = Omit<NovelEntry, "data"> & {
	data: NovelChapterData;
};

export interface NovelRecord {
	series: NovelSeriesEntry;
	chapters: NovelChapterEntry[];
	latestPublished?: Date;
}

export interface ChapterNavigation {
	previous?: NovelChapterEntry;
	next?: NovelChapterEntry;
}

let novelLibraryPromise: Promise<NovelRecord[]> | undefined;

function isSeries(entry: NovelEntry): entry is NovelSeriesEntry {
	return entry.data.type === "novel";
}

function isChapter(entry: NovelEntry): entry is NovelChapterEntry {
	return entry.data.type === "chapter";
}

function normalizedId(entry: NovelEntry) {
	return entry.id.replaceAll("\\", "/");
}

function sourceFolder(entry: NovelEntry) {
	return normalizedId(entry).split("/")[0] ?? "";
}

function sourceStem(entry: NovelEntry) {
	const filename = normalizedId(entry).split("/").at(-1) ?? "";
	return filename.replace(/\.(md|mdx)$/i, "");
}

function validateEntries(
	seriesEntries: NovelSeriesEntry[],
	chapterEntries: NovelChapterEntry[],
) {
	const seriesById = new Map<string, NovelSeriesEntry>();

	for (const series of seriesEntries) {
		const { novelId } = series.data;
		if (seriesById.has(novelId)) {
			throw new Error(`小说标识重复：${novelId}`);
		}
		if (sourceFolder(series) !== novelId || sourceStem(series) !== "index") {
			throw new Error(`作品 ${novelId} 必须保存为 novels/${novelId}/index.md`);
		}
		seriesById.set(novelId, series);
	}

	const idsByNovel = new Map<string, Set<string>>();
	const ordersByNovel = new Map<string, Set<number>>();
	const volumeTitles = new Map<string, string>();

	for (const chapter of chapterEntries) {
		const { novel, chapterId, order, volume, volumeTitle } = chapter.data;
		if (!seriesById.has(novel)) {
			throw new Error(
				`章节 ${normalizedId(chapter)} 引用了不存在的作品：${novel}`,
			);
		}
		if (sourceFolder(chapter) !== novel || sourceStem(chapter) !== chapterId) {
			throw new Error(
				`章节 ${novel}/${chapterId} 的文件名必须为 ${chapterId}.md`,
			);
		}

		const ids = idsByNovel.get(novel) ?? new Set<string>();
		if (ids.has(chapterId)) {
			throw new Error(`作品 ${novel} 的章节标识重复：${chapterId}`);
		}
		ids.add(chapterId);
		idsByNovel.set(novel, ids);

		const orders = ordersByNovel.get(novel) ?? new Set<number>();
		if (orders.has(order)) {
			throw new Error(`作品 ${novel} 的章节排序重复：${order}`);
		}
		orders.add(order);
		ordersByNovel.set(novel, orders);

		const volumeKey = `${novel}:${volume}`;
		const knownTitle = volumeTitles.get(volumeKey);
		if (knownTitle !== undefined && knownTitle !== volumeTitle) {
			throw new Error(`作品 ${novel} 的第 ${volume} 卷使用了不同的卷标题`);
		}
		volumeTitles.set(volumeKey, volumeTitle);
	}
}

async function loadNovelLibrary(): Promise<NovelRecord[]> {
	const entries = await getCollection("novels");
	const allSeries = entries.filter(isSeries);
	const allChapters = entries.filter(isChapter);
	validateEntries(allSeries, allChapters);

	const visibleSeries = import.meta.env.PROD
		? allSeries.filter((entry) => !entry.data.draft)
		: allSeries;

	const records = visibleSeries.map((series) => {
		const chapters = allChapters
			.filter(
				(chapter) =>
					chapter.data.novel === series.data.novelId &&
					(!import.meta.env.PROD || !chapter.data.draft),
			)
			.sort(
				(a, b) =>
					a.data.order - b.data.order ||
					a.data.chapterId.localeCompare(b.data.chapterId),
			);

		const latestPublished = chapters.reduce<Date | undefined>(
			(latest, chapter) =>
				!latest || chapter.data.published > latest
					? chapter.data.published
					: latest,
			undefined,
		);

		return { series, chapters, latestPublished };
	});

	return records.sort((a, b) => {
		const aDate = a.latestPublished ?? a.series.data.started;
		const bDate = b.latestPublished ?? b.series.data.started;
		return (
			bDate.getTime() - aDate.getTime() ||
			a.series.data.novelId.localeCompare(b.series.data.novelId)
		);
	});
}

export function getNovelLibrary() {
	novelLibraryPromise ??= loadNovelLibrary();
	return novelLibraryPromise;
}

export async function getNovelRecord(novelId: string) {
	const library = await getNovelLibrary();
	return library.find((record) => record.series.data.novelId === novelId);
}

export function getChapterNavigation(
	chapters: NovelChapterEntry[],
	chapterId: string,
): ChapterNavigation {
	const index = chapters.findIndex(
		(chapter) => chapter.data.chapterId === chapterId,
	);
	if (index < 0) return {};
	return {
		previous: index > 0 ? chapters[index - 1] : undefined,
		next: index < chapters.length - 1 ? chapters[index + 1] : undefined,
	};
}

export function getFirstChapterUrl(record: NovelRecord) {
	const first = record.chapters[0];
	return first
		? getNovelChapterUrl(record.series.data.novelId, first.data.chapterId)
		: undefined;
}

export function formatNovelDate(date: Date, short = false) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return short ? `${month}.${day}` : `${year}.${month}.${day}`;
}
