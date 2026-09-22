import { defineCollection, z } from "astro:content";

const postsCollection = defineCollection({
	schema: z
		.object({
			title: z.string().trim().min(1, "文章标题不能为空"),
			published: z.date(),
			updated: z.date().optional(),
			draft: z.boolean().optional().default(false),
			description: z.string().trim().optional().default(""),
			image: z.string().trim().optional().default(""),
			tags: z
				.array(z.string())
				.optional()
				.default([])
				.transform((tags) => [
					...new Set(tags.map((tag) => tag.trim()).filter(Boolean)),
				]),
			category: z.enum(["杂谈", "代码"]).optional().nullable().default("代码"),
			lang: z.string().trim().optional().default(""),

			/* For internal use */
			prevTitle: z.string().default(""),
			prevSlug: z.string().default(""),
			nextTitle: z.string().default(""),
			nextSlug: z.string().default(""),
		})
		.superRefine((post, context) => {
			if (post.updated && post.updated < post.published) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["updated"],
					message: "更新时间不能早于发布时间",
				});
			}
		}),
});
const specCollection = defineCollection({
	schema: z.object({
		friends: z
			.array(
				z.object({
					name: z.string().trim().min(1, "友链名称不能为空"),
					url: z.string().url("友链地址必须是完整 URL"),
					avatar: z
						.string()
						.trim()
						.min(1)
						.optional()
						.default("/Portrait/default.jpg"),
					description: z.string().trim().optional().default(""),
				}),
			)
			.optional(),
		friendRules: z.array(z.string().trim().min(1)).optional().default([]),
		friendApplication: z
			.object({
				email: z.string().email("友链联系邮箱格式不正确"),
				description: z.string().trim().optional().default(""),
			})
			.optional(),
		siteInfo: z
			.object({
				name: z.string().trim().min(1),
				url: z.string().url("本站友链地址必须是完整 URL"),
				description: z.string().trim().min(1),
				avatar: z.string().trim().min(1),
			})
			.optional(),
	}),
});

const novelIdSchema = z
	.string()
	.trim()
	.regex(
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
		"小说标识只能包含小写字母、数字和连字符",
	);

const novelCollection = defineCollection({
	schema: z
		.discriminatedUnion("type", [
			z.object({
				type: z.literal("novel"),
				novelId: novelIdSchema,
				title: z.string().trim().min(1, "作品标题不能为空"),
				subtitle: z.string().trim().optional().default(""),
				description: z.string().trim().min(1, "作品简介不能为空"),
				author: z.string().trim().min(1, "作者不能为空"),
				status: z.enum(["连载中", "已完结", "暂停更新"]),
				cover: z.string().trim().optional().default(""),
				hero: z.string().trim().optional().default(""),
				showcase: z
					.object({
						image: z.string().trim().optional().default(""),
						position: z.string().trim().optional().default("72% center"),
						scale: z.number().min(0.5).max(2).optional().default(1),
					})
					.optional()
					.default({ image: "", position: "72% center", scale: 1 }),
				accentHue: z.number().int().min(0).max(360).optional().default(205),
				started: z.date(),
				tags: z
					.array(z.string())
					.optional()
					.default([])
					.transform((tags) => [
						...new Set(tags.map((tag) => tag.trim()).filter(Boolean)),
					]),
				lang: z.string().trim().optional().default("zh_CN"),
				draft: z.boolean().optional().default(false),
			}),
			z.object({
				type: z.literal("chapter"),
				novel: novelIdSchema,
				chapterId: z
					.string()
					.trim()
					.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "章节标识格式不正确"),
				title: z.string().trim().min(1, "章节标题不能为空"),
				order: z.number().int().positive("章节排序必须是正整数"),
				chapter: z.number().int().positive("章号必须是正整数"),
				volume: z.number().int().positive("卷号必须是正整数").default(1),
				volumeTitle: z.string().trim().optional().default(""),
				published: z.date(),
				updated: z.date().optional(),
				description: z.string().trim().optional().default(""),
				lang: z.string().trim().optional().default("zh_CN"),
				draft: z.boolean().optional().default(false),
			}),
		])
		.superRefine((entry, context) => {
			if (entry.type === "chapter") {
				if (entry.updated && entry.updated < entry.published) {
					context.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["updated"],
						message: "章节更新时间不能早于发布时间",
					});
				}
			}
		}),
});

export const collections = {
	posts: postsCollection,
	spec: specCollection,
	novels: novelCollection,
};
