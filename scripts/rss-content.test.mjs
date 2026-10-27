import assert from "node:assert/strict";
import test from "node:test";

import { renderRssContent } from "../src/utils/rss-content.ts";

const article = "https://iceneoning-blog.pages.dev/posts/example/";

test("converts root-relative image URLs to absolute site URLs", () => {
  const html = renderRssContent("![封面](/images/Posts/example.webp)", article);
  assert.match(
    html,
    /src="https:\/\/iceneoning-blog\.pages\.dev\/images\/Posts\/example\.webp"/,
  );
  assert.match(html, /alt="封面"/);
});

test("resolves document-relative links against the article, not rss.xml", () => {
  const html = renderRssContent(
    "[上一章](../previous/) [节选](#excerpt) [主页](/intro/)",
    article,
  );
  assert.match(html, /href="https:\/\/iceneoning-blog\.pages\.dev\/posts\/previous\/"/);
  assert.match(html, /href="https:\/\/iceneoning-blog\.pages\.dev\/posts\/example\/#excerpt"/);
  assert.match(html, /href="https:\/\/iceneoning-blog\.pages\.dev\/intro\/"/);
});

test("keeps external HTTP(S) URLs and allows mailto/tel links", () => {
  const html = renderRssContent(
    '[外链](https://example.com/a?q=1&x=2) [邮件](mailto:hello@example.com) [电话](tel:+123456789)',
    article,
  );
  assert.match(html, /href="https:\/\/example\.com\/a\?q=1&amp;x=2"/);
  assert.match(html, /href="mailto:hello@example\.com"/);
  assert.match(html, /href="tel:\+123456789"/);
});

test("removes unsafe link/image schemes, scripts and handlers", () => {
  const html = renderRssContent(
    '<a href="javascript:alert(1)" onclick="alert(1)">unsafe</a>' +
      '<img src="data:image/svg+xml;base64,AAAA" onerror="alert(1)" />' +
      '<script>alert(1)</script>',
    article,
  );
  // MarkdownIt escapes raw HTML, so references to unsafe attributes inside
  // escaped text are inert; reject only dangerous executable HTML attributes.
  assert.doesNotMatch(html, /<(?:a|img)\\b[^>]*(?:href|src)="(?:javascript:|data:)/i);
  assert.doesNotMatch(html, /<[a-z][^>]*\\bon(?:click|error)=/i);
  assert.doesNotMatch(html, /<script\\b/i);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /unsafe/);
});

test("normalizes protocol-relative image URLs", () => {
  const html = renderRssContent("![CDN](//static.example.com/a.webp)", article);
  assert.match(html, /src="https:\/\/static\.example\.com\/a\.webp"/);
});

test("strips invalid XML control characters without changing article text", () => {
  const html = renderRssContent("你好\u0001世界\u000b！", article);
  assert.match(html, /你好世界！/);
  assert.doesNotMatch(html, /[\u0001\u000b]/);
});
