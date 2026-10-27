import rss from "@astrojs/rss";
import { getSortedPosts } from "@utils/content-utils";
import { renderRssContent } from "@utils/rss-content";
import { url } from "@utils/url-utils";
import type { APIContext } from "astro";
import { siteConfig } from "@/config";

export async function GET(context: APIContext) {
  const site = context.site;
  if (!site) {
    throw new Error("RSS requires astro.config.mjs to define the site URL");
  }

  const blog = await getSortedPosts();

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site,
    items: blog.map((post) => {
      // Stable absolute permalinks are used for both reader navigation and GUID.
      const permalink = new URL(url(`/posts/${post.slug}/`), site).href;
      const content =
        typeof post.body === "string" ? post.body : String(post.body || "");

      return {
        title: post.data.title,
        pubDate: post.data.published,
        description: post.data.description || "",
        link: permalink,
        content: renderRssContent(content, permalink),
      };
    }),
    customData: `<language>${siteConfig.lang.replace("_", "-")}</language>`,
  });
}
