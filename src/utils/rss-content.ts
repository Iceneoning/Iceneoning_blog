import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

const parser = new MarkdownIt();

// Resolve URLs against the original article, not the feed endpoint.
// Readers often render RSS HTML without the site's document base URL.
function resolveRssUrl(
  value: string | undefined,
  articleUrl: URL,
  allowContact: boolean,
): string | undefined {
  if (!value?.trim()) return undefined;

  const source = value.trim();
  try {
    const resolved = new URL(source, articleUrl);
    if (resolved.protocol === "https:" || resolved.protocol === "http:") {
      return resolved.href;
    }
    if (
      allowContact &&
      (resolved.protocol === "mailto:" || resolved.protocol === "tel:")
    ) {
      return source;
    }
  } catch {
    // Invalid URLs must not be exposed as relative or unsafe attributes.
  }
  return undefined;
}

function normalizeAttribute(
  tagName: string,
  attributes: Record<string, string>,
  attribute: "href" | "src",
  articleUrl: URL,
  allowContact: boolean,
) {
  const normalized = { ...attributes };
  const absolute = resolveRssUrl(normalized[attribute], articleUrl, allowContact);
  if (absolute) {
    normalized[attribute] = absolute;
  } else {
    delete normalized[attribute];
  }
  return { tagName, attribs: normalized };
}

function stripInvalidXmlChars(content: string): string {
  return content.replace(
    // biome-ignore lint/suspicious/noControlCharactersInRegex: XML 1.0 excludes these code points.
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
    "",
  );
}

/** Convert Markdown to RSS-safe HTML with absolute article links and image URLs. */
export function renderRssContent(markdown: string, articlePermalink: string): string {
  const articleUrl = new URL(articlePermalink);
  return sanitizeHtml(parser.render(stripInvalidXmlChars(markdown)), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: (tagName, attributes) =>
        normalizeAttribute(tagName, attributes, "href", articleUrl, true),
      img: (tagName, attributes) =>
        normalizeAttribute(tagName, attributes, "src", articleUrl, false),
    },
  });
}
