# Fuwari 魔改项目冗余代码只读审计

> 状态：只读审计文档  
> 范围：当前 `fuwari` 工作区  
> 原则：本文只记录已观察到的现状、清理建议与风险分级，不代表已经执行删除或重构。

## 1. 审计目标

当前项目已经从原版 Fuwari 演化为个人博客，期间加入了背景、友链、归档、运势、主题设置、文章样式等多次魔改。随着功能替换，一部分旧资源、模板页、兼容层和已关闭功能仍保留在仓库中。

本次审计目标不是“尽可能删文件”，而是把对象分成：

- 可以高置信度清理的无引用残留；
- 仍有代码引用、但已经失去产品入口的旧功能；
- 当前没有使用、但未来可能需要的可选能力；
- 明确仍在使用、不可误删的核心模块。

## 2. A 类：高置信度可清理

这类对象当前无有效运行时用途，且没有发现实际引用。

### 2.1 `src/components/GlobalStyles.astro`

现状：文件仅包含空 Astro frontmatter：

```astro
---
---
```

项目中没有 import。`Layout.astro` 还保留了一条历史注释，说明全局 CSS 变量早已改为直接在 Layout 中处理。

结论：可删除。

### 2.2 `public/background/site-bg2.webp`

现状：项目配置当前使用：

```ts
src: "/background/site-bg.webp"
```

没有发现 `site-bg2.webp` 的源码或文档引用。

结论：可删除。

### 2.3 `public/DailyForecast/` 根目录的 16 张原始图

现状：`DateTimePanel.astro` 只扫描：

```text
public/DailyForecast/optimized/
```

运行时 URL 也只生成：

```text
/DailyForecast/optimized/<image>
```

原始 JPG/PNG 当前无代码引用。

体积方面，原始 16 张图约 18.5 MiB，而优化后的 WebP 版本远小于原图。

结论：若确认这些原图不作为“母版素材”留档，可从博客仓库删除；若希望保留母版，建议移到仓库外素材目录，而不是继续放在 `public/`。

### 2.4 `.codex-fps-frames/`

现状：目录内为 9 张视频抽帧 PNG，约 3.55 MiB，不属于博客产品资源，也没有被代码引用。

结论：典型开发过程残留，可清理；同时建议加入 `.gitignore`，避免再次进入仓库。

### 2.5 `vercel.json`

现状：内容仅为：

```json
{}
```

当前站点配置与实际使用方向均为 Cloudflare Pages。

结论：空配置没有实际价值，可删除。

### 2.6 未使用 npm 依赖

当前发现：

- `remark-directive-rehype`
- `@rollup/plugin-yaml`

没有发现源码或配置直接 import。

注意：项目存在自定义文件 `src/plugins/remark-directive-rehype.js`，名字相近，但它不是 npm 包 `remark-directive-rehype`。

结论：这两项属于高概率可移除依赖，正式移除前应在修改阶段执行一次 `pnpm check` 与 `pnpm build` 验证。

## 3. B 类：高概率属于旧模板功能

这类对象不是“完全无代码”，但与当前网站结构已经出现明显重复。

### 3.1 旧 `/about/` 页面

相关文件：

```text
src/pages/about.astro
src/content/spec/about.md
```

当前导航已经使用：

```text
/intro/
```

而旧 `about.md` 仍保留原版 Fuwari 风格内容，包括：

- “本站基于 Fuwari 构建”；
- Fuwari GitHub Card；
- 原模板图片来源说明。

目前 `/about/` 没有实际导航入口，只在 `LinkPreset.About` 兼容层中保留预设。

结论：如果 `/intro/` 已确定为唯一“关于我”页面，则建议删除旧 About 页面与内容，并继续清理 `LinkPreset.About`。

### 3.2 LinkPreset 兼容层

文件：

```text
src/constants/link-presets.ts
```

当前 `navBarConfig.links` 全部直接使用对象：

```ts
{
  name: "启航",
  url: "/"
}
```

没有实际使用数字型 `LinkPreset`。

`Navbar.astro` 仍为原模板兼容“配置里传枚举预设”的旧机制。

结论：可以进一步简化，但属于小型重构，不建议和纯文件清理混在同一提交中。

## 4. C 类：功能关闭，但代码主体仍完整保留

### 4.1 Banner 系统

当前配置：

```ts
banner: {
  enable: false,
  ...
}
```

但以下能力仍完整存在：

- `BANNER_HEIGHT`
- `BANNER_HEIGHT_EXTEND`
- `BANNER_HEIGHT_HOME`
- `MAIN_PANEL_OVERLAPS_BANNER_HEIGHT`
- `banner-wrapper`
- `banner-credit`
- Banner 的首页高度逻辑
- Banner 的 Swup 切页逻辑
- Banner 的滚动阈值逻辑
- Banner 的样式块
- `demo-banner.webp`
- `Layout.astro` 中多段 Banner JS
- `MainGridLayout.astro` 中 Banner DOM 与 credit DOM

结论：这是当前最明显的“功能已经不用，但架构尸体仍在”的模块。

建议单独做一次“Remove Legacy Banner”重构，而不是零碎删除。这样可以明显缩短 `Layout.astro`，降低以后维护复杂度。

`src/assets/images/demo-banner.webp` 只有配置引用，而 Banner 已关闭，因此也可在 Banner 重构时一并处理。

## 5. D 类：当前内容没有使用，但属于可选能力

这类内容不应直接按“垃圾”处理，而应根据未来写作需求决定。

### 5.1 GitHub Card 与 Admonition

相关模块：

```text
src/plugins/rehype-component-github-card.mjs
src/plugins/rehype-component-admonition.mjs
src/plugins/remark-directive-rehype.js
src/styles/markdown-extend.styl
```

现有内容中：

- `::github{...}` 只出现在旧 `about.md`；
- 没有发现当前文章使用 `:::note`、`:::tip`、`:::warning` 等 Admonition 指令。

如果删除旧 About 后仍确定未来不写这些扩展语法，则可以裁掉对应插件、配置与大量样式。

### 5.2 KaTeX / 数学公式链

当前全局启用：

```text
remark-math
rehype-katex
katex
```

但现有文章内容没有检测到数学公式语法。

结论：当前是“保留能力但未使用”。如果博客未来仍可能写算法、数学、图形或技术文章，建议保留；如果明确只写普通技术笔记，可考虑移除。

### 5.3 Spoiler 样式

`src/styles/main.css` 保留：

```css
.custom-md spoiler { ... }
```

当前内容没有发现 `spoiler` 使用。

结论：低优先级可选清理项。

## 6. E 类：国际化残留

项目当前站点语言固定：

```ts
lang: "zh_CN"
```

但仍保留完整语言包：

```text
en
es
id
ja
ko
th
tr
vi
zh_CN
zh_TW
```

这不是死代码，因为现有组件仍统一通过 `i18n()` 获取文案。

因此不能只删语言文件，否则会破坏当前翻译映射结构。

建议策略：

- 短期：保留整个 i18n 系统；
- 中期：若确认个人博客永久只提供中文 UI，再单独做“单语言化”重构。

当前明确可以清的小项：

```text
I18nKey.recentPosts
I18nKey.comments
I18nKey.untitled
```

这三个 key 当前只存在于翻译表，没有运行代码消费。

## 7. F 类：文档与仓库模板残留

### 7.1 `README.md`

当前 README 仍基本是原版 Fuwari README，包括：

- 上游项目 Badge；
- DeepWiki；
- FOSSA；
- 官方 Vercel Demo；
- 原模板创建教程；
- 上游贡献说明。

它不影响运行，但已经不能准确描述当前项目。

建议：重写为“冰霓の梦之旅”的仓库主页，保留：

- 项目简介；
- 当前技术栈；
- 本地运行方式；
- 部署说明；
- 内容目录约定；
- Fuwari 原项目署名与许可证说明。

### 7.2 `CONTRIBUTING.md`

仍是上游模板式贡献指南。

个人项目如果不接受外部 PR，可以删除；如果希望保留开源协作，则应改成当前仓库自己的规则。

### 7.3 `.github/`

包括 Issue Template、PR Template、Build、Biome workflow。

这些不属于纯垃圾。

其中 CI 对防止魔改后继续出现编译错误有价值，建议保留；Issue/PR 模板是否保留取决于仓库是否接受外部协作。

### 7.4 `docs/draft.md`

这是草稿文章示例，不参与站点运行。

如果已经熟悉 Frontmatter，可删除或移动到文档归档区。

### 7.5 `frontmatter.json`

服务于 VS Code Front Matter CMS。

如果仍使用该扩展管理文章，则保留；如果完全不用，可以删除。

## 8. 明确不要误删的对象

以下对象已确认仍有实际使用：

- `public/Portrait/*`
- `src/components/PostCard.astro`
- `src/components/PostMeta.astro`
- `src/components/Search.svelte`
- `src/components/widget/Profile.astro`
- `src/components/widget/Categories.astro`
- `src/components/widget/Tags.astro`
- `src/components/widget/TOC.astro`
- `src/components/widget/SideBar.astro`
- `src/components/widget/DateTimePanel.astro`
- `src/components/misc/ImageWrapper.astro`
- Pagefind 搜索链
- Svelte 集成
- `scripts/new-post.js`
- `photoswipe`
- Expressive Code
- 当前背景 `public/background/site-bg.webp`
- `public/background/intro.webp`

## 9. 推荐清理顺序

### Phase 1：纯垃圾清理

目标：不动架构，只删无引用对象。

建议对象：

```text
GlobalStyles.astro
site-bg2.webp
DailyForecast 原始图
.codex-fps-frames/
vercel.json
未使用 npm 依赖
```

### Phase 2：旧页面与兼容层

目标：删除重复产品入口。

建议对象：

```text
/about/
about.md
LinkPreset.About
无用 i18n key
```

### Phase 3：Fuwari 去模板化

目标：降低长期维护成本。

建议处理：

```text
Legacy Banner
GitHub Card / Admonition（若确认不用）
KaTeX（若确认不用）
单语言化（可选）
README / CONTRIBUTING
```

## 10. 清理时的验证要求

每一阶段都建议独立提交，并至少执行：

```bash
pnpm check
pnpm build
```

涉及页面结构时还应人工检查：

- 首页；
- 文章页；
- 目录页；
- 介绍页；
- 友链页；
- 搜索；
- 明暗主题；
- 手机与桌面布局；
- Swup 页面切换。

不要将“删除文件”和“视觉重构”混进一个提交，否则出现问题时很难定位。
