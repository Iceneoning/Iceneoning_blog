# RSS 订阅源技术方案与验收记录

> 项目：冰霓の梦之旅（Astro / Fuwari / Cloudflare Pages）  
> 日期：2026-10-27；状态：实施中（以文末记录为准）  
> 订阅地址：https://iceneoning-blog.pages.dev/rss.xml

## 1. 目标与边界

RSS 2.0 是 XML 内容订阅格式。阅读器定期拉取 `/rss.xml` 发现文章，无需账号或推送后端。本站流水线：Markdown → Astro Content Collections → `@astrojs/rss` → `dist/rss.xml` → Cloudflare Pages。

本轮目标：
1. 保持 `/rss.xml` 的 RSS 2.0 格式、页面自动发现和现有文章 GUID 稳定。
2. 全文 HTML 中的图片与网页链接使用可解析的绝对 HTTP(S) URL。
3. 仅发布非草稿文章，保证排序确定、发布时间正确。
4. 有可复现的单元、构建产物和线上阅读器验收流程。

非目标：更改文章正文或图片资产、加入小说章节、部署 RSS 服务、自动提交/推送/上线。

## 2. 实测基线（2026-10-27）

| 项目 | 来源及事实 |
| --- | --- |
| RSS 入口 | `src/pages/rss.xml.ts` 使用 `@astrojs/rss`，生成含 `content:encoded` 的完整 HTML；`Layout.astro` 有自动发现，`Footer.astro` 有 RSS 链接 |
| 域名 | `astro.config.mjs` 指向 `https://iceneoning-blog.pages.dev/` |
| 本地已有产物 | `dist/rss.xml` 约 144 KB，10 条 `item`，最新发布日期 2026-10-05 |
| 新文章 | `src/content/posts/toumei-yoru.md` 为 2026-10-27 且 `draft: false`，旧 `dist/rss.xml` 尚未包含 |
| 图片兼容性 | 旧 RSS 正文有 11 处 `img src="/images/..."` 根相对链接，部分 RSS 阅读器无法解析 |
| 遗留配置 | RSS 路由曾回退到 `https://fuwari.vercel.app`，不符合本站域名 |
| 线上状态 | 本次第三方抓取工具无法读取线上端点；不据此判断 HTTP 状态或实际部署内容 |

**证据边界**：本地 `dist` 仅代表过去的构建产物，不能据此推断线上 Cloudflare Pages 的当前状态。

## 3. 设计决策

### 3.1 地址身份

以 Astro `context.site` 为唯一主站来源，缺失时明确失败，不回退模板域名。文章 item `link` 使用 `new URL(path, site).href`，不变更 slug、文章发布日期和现有 RSS/GUID 语义。继续复用 `getSortedPosts()`，生产构建排除 `draft: true`，按 `published` 降序，日期相同时 slug 确定排序。

### 3.2 全文 HTML 规范化

由 MarkdownIt 渲染文章正文，再通过 `sanitize-html` 白名单清理。仅处理 `a[href]`、`img[src]`：
- `/images/a.webp` → `https://iceneoning-blog.pages.dev/images/a.webp`
- `./file`、`../other`、`#heading` → 相对于该篇文章的绝对 URL
- 原有 HTTP(S) 外链和协议相对链接规范化保留
- 非 HTTP(S) 协议对图片禁止；链接可保留 `mailto:`、`tel:`，禁止 `javascript:`、`data:`、`file:`
- 继续让清理库过滤脚本、事件处理器和不安全 HTML；不直接修改 Markdown 文件

不承诺 RSS 能复现动态站点 CSS、组件、视频或所有 `srcset` 变体。

### 3.3 更新和部署语义

`/rss.xml` 是静态文件：新文章只有在构建且成功部署后才会更新；阅读器还需要等待下一次拉取。不要用构建时间替换文章 `pubDate`，避免旧条目误判成新内容。严禁仅因旧 `dist` 滞后便修改文章发布日期或草稿标记。

## 4. 计划与验收

| 编号 | 标准 | 状态 |
| --- | --- | --- |
| R1 | RSS XML 可解析，频道、站点 URL 正确 | **PASS（本地构建）** |
| R2 | 所有 RSS 正文图片 URL 为绝对 HTTP(S) | **PASS（11/11，产物校验）** |
| R3 | 普通文章链接绝对化，危险协议被丢弃 | **PASS（6/6 单元测试、产物校验）** |
| R4 | GUID 唯一且稳定，pubDate 正确、排序一致 | **PASS（唯一性/日期/排序）；跨两次独立构建稳定性未专测** |
| R5 | 仅公开文章进入生产 RSS，最新文章出现 | **PASS（11 篇当前非草稿文章，新文章已进入）；草稿注入负例未专测** |
| R6 | 正式线上 GET 200、XML 正常、读者阅读器订阅可用 | 待部署后核验 |

实施顺序：技术文档 → 最小范围 RSS 代码修改 → 定向单元测试 → `pnpm run check` → `pnpm run build` → 产物检查 → 独立发布后验收。构建和测试必须遵守 MCPX 工具安全策略，不能绕过确认。回滚仅撤销本轮 RSS 代码与测试增量，不运行 git reset/clean，也不删除任何文章或图片。

## 5. 资料

- Astro 官方 RSS 指南：https://docs.astro.build/en/recipes/rss/
- RSS 2.0 规范：https://www.rssboard.org/rss-specification
- HTML 清理实现：https://github.com/apostrophecms/sanitize-html

## 6. 实施记录

- 2026-10-27：读取工作区源码与旧构建产物，核实绝对 URL 兼容性风险、历史 `dist` 未包含新文章以及模板域名兜底。
- 2026-10-27：新增 `src/utils/rss-content.ts`，保留 MarkdownIt + sanitize-html 清理链，针对图片/正文链接安全绝对化；`src/pages/rss.xml.ts` 改用 `context.site` 及稳定文章绝对 permalink，移除旧 Fuwari 模板域名回退。
- 2026-10-27：新增 `scripts/rss-content.test.mjs`（6 项定向测试）和 `scripts/verify-rss.py`（Python 标准库 RSS 2.0 XML、GUID、pubDate、正文 URL 检查器）。文件写入和读回经 MCPX 验证。
- 2026-10-27：最初命令策略要求 `USER_CONFIRMATION_REQUIRED`，用户已明确授权本轮测试和构建；执行均由 MCPX 原始命令路径完成，未绕过授权。
- 2026-10-27：首次 Node 单测 5 PASS / 1 FAIL；失败缘于把 MarkdownIt 已转义为普通文本的原始 HTML 误判为可执行标签。修正断言后，`node --experimental-strip-types --test scripts/rss-content.test.mjs` **6 PASS / 0 FAIL，exit_code=0**。
- 2026-10-27：`pnpm run check` **75 files, 0 errors, 0 warnings, 0 hints, exit_code=0**；`pnpm run build` **exit_code=0**，Astro 生成 21 页面及 `/rss.xml`，Pagefind 正常结束。构建仍有 Browserslist 数据过旧、Svelte 和 Pagefind 中文 stemming 的非阻塞提示。
- 2026-10-27：`python scripts/verify-rss.py` **exit_code=0**，RSS XML 解析、频道信息、GUID 唯一性、pubDate、降序、HTML 正文图片与网页链接均通过；`dist/rss.xml` **11 个 item、11 张图片、1 个链接**。读回首条确认 2026-10-27 的《于透明之夜，谈一场看不见的恋爱》已进入生成产物。
- 2026-10-27：本轮未进行任何 Git commit、push 或 Cloudflare 部署；**R6 线上 HTTP 200、阅读器订阅/图片显示仍待部署后的真实验证**。
