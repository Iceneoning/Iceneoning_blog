---
name: fuwari-image-optimizer
description: 优化本 Fuwari/Astro 博客的照片、文章截图、头像和小说插画体积，使用现有 Sharp 转 WebP，检查画质并更新引用。用于用户要求图片压缩、图片瘦身或为新文章准备轻量图片；不用于生成图片、视频压缩或仅修改排版。
---

# Fuwari 图片优化

在仓库根目录执行下列命令。目标是降低实际页面使用图片的传输体积，同时保持可读性和透明效果。用户已确认本站默认在替换验证成功后删除本批原图，只交付优化版本；不为了统一后缀转换全部资源。

## 项目事实与边界

- 项目已有 `sharp`，无需新增依赖。脚本位于本 Skill 的 `scripts/optimize-images.mjs`。
- `public/` 图片直接复制到 `dist/`；仅修改 `<img>` 的显示尺寸不会降低传输体积。以 `/` 开头的 URL 对应 `public/`，如 `/images/Posts/.../1.webp`。
- `src/` 中通过 `astro:assets` 导入的本地图片已有构建处理；先检查产物再决定是否另行转码。不要把 `ImageWrapper.astro` 的图片 glob 扩大到全部源码。
- 图片可能用于 Markdown 正文、frontmatter 的 `image`/`cover`/`hero`/`showcase.image`、友链 `avatar`、配置、CSS 或社交分享元数据。必须搜索引用，不能只替换正文。
- `public/background/mobile-background.jpg` 在 `src/config.ts` 标记为受保护资源，默认排除。任务若专门修改它，需要用户明确指令并单独处理；本脚本拒绝转换它。
- 保留 favicon、SVG、动画图片和视频的既有用途；本脚本仅处理静态 PNG/JPEG。现有 WebP/AVIF 不作为默认二次有损压缩对象。
- 扩展名不是实际格式的证据。历史审计发现 `public/Portrait/Moi.webp` 实际为 JPEG；读取 Sharp metadata，禁止仅改后缀冒充转换。详见 `docs/performance-optimization/06-image-resource-audit.md`，其中大小、用途和引用情况是历史记录，需重新检查。

## 工作流程

### 1. 确定范围并只读盘点

先检查 `git status --short` 和适用的 `AGENTS.md`，保留已有修改。没有指定图片时，可以扫描项目图片找候选，不应自动转换所有候选。

```powershell
node .agents/skills/fuwari-image-optimizer/scripts/optimize-images.mjs --scan
```

输出 JSON 数组，按字节数降序列出路径、实际编码、尺寸、透明通道、页数和 EXIF 方向。不跟随目录符号链接，不读取 `source-assets/`。默认以超过约 500 KiB 的 PNG/JPEG 为优先候选；这只是排序参考，不是强制压缩门槛。

将图片 URL 与源码引用对应，确认实际显示尺寸、首屏用途以及是否会被加载。未引用的存储资源不等同于首屏传输负担，不能据此自动删除。

### 2. 选择参数，显式列出输入

普通照片、游戏截图、插画可从以下参数起步，保留原尺寸：

```js
sharp(input).webp({
  quality: 82,
  alphaQuality: 100,
  smartSubsample: true,
  effort: 6,
})
```

此前本站批次使用过 `quality: 82, alphaQuality: 95, smartSubsample: true, effort: 6`。这里将默认 alpha 质量提高到 `100`，优先保留透明边缘；有明确画质评估依据时可用 `--alpha-quality 95` 重现先前设置。

- 文字密集、细线图表、UI 截图：比较 `--quality 90` 与 `--lossless`；82 只是起点，不能据单张样图保证整批文字清晰。
- 用户要求无损或像素不变：使用 `--lossless`；脚本会比较解码后的 sRGB RGBA 像素。无损指相同解码像素，不等于保留原文件的 EXIF/ICC 字节。
- JPEG 转无损 WebP 可能明显变大；脚本不写入没有体积收益的结果。
- 半透明发丝、光效、透明立绘应检查浅/深背景下的边缘；不铺底、不丢弃 alpha。
- 未明确要求时不缩放、不裁切；需要降低尺寸时先确认放大灯箱和高像素密度屏的用途，再另行生成派生版本。

带空格、中文或标点的路径必须作为完整的引号参数传递。路径相对仓库根目录；不使用 glob 或递归批量转换。

```powershell
# 默认只在内存编码并报告结果；不写文件
node .agents/skills/fuwari-image-optimizer/scripts/optimize-images.mjs 'public/images/Posts/文章名/1.png'

# 确认参数后添加 --write；生成同目录、同名 .webp，验证前暂留原图
node .agents/skills/fuwari-image-optimizer/scripts/optimize-images.mjs --write --quality 90 'public/images/Posts/文章名/1.png'

# 可显式列出多个输入；无损转换也会检查体积收益
node .agents/skills/fuwari-image-optimizer/scripts/optimize-images.mjs --write --lossless 'public/Portrait/example.png'
```

这些是路径示例，执行时替换为当前任务的真实文件。脚本拒绝越界路径、已有输出、动画和受保护资源，不删除文件，也不自动修改引用。如果原文件后缀已经是 `.webp` 但实际是 JPEG，脚本生成 `原名.optimized.webp`，避免覆盖原图。失败退出码为非零；逐项检查报告，已有成功输出不会回滚。

Sharp 默认移除元数据。遇到非标准 EXIF 方向时，脚本会拒绝转换，需单独归一化方向并比较显示效果，不能让照片横竖颠倒。完全不透明的 alpha 平面可能在 WebP 中省略，这是正常优化；真实半透明像素仍需保留。

### 3. 查看画质并更新精确引用

对实际写出的结果检查原尺寸、实际编码、alpha，并查看原图/结果。至少覆盖每种内容类型；对文字密集或可疑图片逐张检查。出现糊字、色边、渐变断层时提高质量或改无损；不能接受时保留原图引用。

仅对确认合格且节省体积的结果更新精确路径，保留 alt、标题、Markdown 语法及 URL 编码。使用补丁，不要全局替换所有 `.png`。若涉及博客文字本身的创作或校对，另遵循项目的中文写作要求；纯图片 URL 更新不顺带改正文。

```powershell
rg -n -F -- '/images/Posts/文章名/1.png' src public docs scripts
```

脚本在编码阶段暂留原图用于比较。项目用户已授权：确认本批转换成功、画质合格、引用核对及构建验证通过后，删除被替代的原图，避免部署时包含双份资源。无需为同一批图片再次征求确认；用户明确要求备份或保留时优先遵循。

清理前列出本批准确原图清单和恢复情况，记录源文件哈希；删除时重新核对哈希及输出文件，避免删除被并发修改的源文件。只按确切文件路径清理，不按扩展名、体积门槛或目录通配递归删除。转换失败、无体积收益、画质不合格、仍被引用或受保护的资源不删除。确认同名 WebP 是本次生成并已验证的结果，不能仅凭它存在就删除任何旧文件。

未跟踪的原图不能依赖 Git 恢复，有损 WebP 不能恢复原始像素。若构建在清理前已生成对应原图副本，也应按同一清单移除 `dist/` 中的这些生成副本，并核对优化版本仍完整存在；也可以在清理后重建。不要将此授权扩大到任务范围之外的资源。

### 4. 验证与交付

- 搜索旧路径：将仍有效的示例/历史说明与运行时漏改引用区分；确认新资源文件真实存在。
- 更新引用后运行一次 `pnpm build`，检查退出码与内容渲染错误；仅构建成功不能证明所有 public 图片没有 404，仍需核对产物中 URL 对应的 `dist/` 文件。
- 根据用途查看相关页面的封面、正文灯箱、头像或透明立绘；说明未完成的视觉检查。仅创建/修改本 Skill 时无需重建站点。
- 按本次实际字节数报告处理数量、前后大小、减少比例、引用变动、原图清理情况和检查结果；有例外保留时说明位置和原因。明确是图片合计减少，不把它宣传成每个页面的首屏收益。
- 不自动安装依赖、清理无关文件、提交或推送。
