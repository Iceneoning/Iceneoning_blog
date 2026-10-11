# 图片资源格式与无损转换审计

检查日期：2026-10-11。扫描 `public/` 和 `src/` 的图片，使用现有 Sharp 读取实际编码、尺寸与文件大小，并核对源码和生产构建中的引用。统计不包含视频、构建目录的重复副本和远程图片。

## 实际编码

| 编码 | 文件数 | 总大小 |
| --- | ---: | ---: |
| WebP | 40 | 6,368,012 B |
| JPEG | 5 | 1,730,882 B |
| PNG | 4 | 186,965 B |

共有 49 张图片；按实际编码计算，40 张为 WebP。文章图片、每日一签的 16 张图片、小说图片，以及桌面背景和开场示例图均为 WebP。

`public/Portrait/Moi.webp` 的文件内容实际为 JPEG，扩展名不能作为编码验证依据。它目前被友链页使用。

## 非 WebP 文件

| 文件 | 编码 | 尺寸 | 文件大小 | 当前用途 |
| --- | --- | --- | ---: | --- |
| `public/background/mobile-background.jpg` | JPEG | 1200×800 | 1,323,111 B | 手机背景，各路由的公共配置 |
| `public/Portrait/Moi.webp` | JPEG | 1024×1024 | 238,065 B | 友链头像 |
| `public/Portrait/avatar.jpg` | JPEG | 1080×1080 | 62,432 B | 友链头像 |
| `public/Portrait/NanKeYiMeng.jpg` | JPEG | 640×640 | 32,179 B | 友链头像 |
| `public/Portrait/default.jpg` | JPEG | 672×378 | 75,095 B | 内容 schema 默认头像，当前构建未引用 |
| `public/favicon/favicon-32.png` | PNG | 32×32 | 2,823 B | 网站图标 |
| `public/favicon/favicon-128.png` | PNG | 128×128 | 41,440 B | 网站图标 |
| `public/favicon/favicon-180.png` | PNG | 180×180 | 70,755 B | 网站图标 |
| `public/favicon/favicon-192.png` | PNG | 192×192 | 71,947 B | 网站图标 |

## 保持像素的转换实验

在内存中尝试无损 WebP，并比较原图与结果解码后的 RGB 像素；五张 JPEG 的像素均相同。没有覆盖原图或修改页面引用。

| 原图 | 原始大小 | 无损 WebP 大小 |
| --- | ---: | ---: |
| 手机背景 | 1,323,111 B | 1,216,852 B |
| `Moi.webp`（实际 JPEG） | 238,065 B | 808,926 B |
| `avatar.jpg` | 62,432 B | 412,312 B |
| `NanKeYiMeng.jpg` | 32,179 B | 128,506 B |
| `default.jpg` | 75,095 B | 321,052 B |

手机背景转换可节省 106,259 B，约 8.0%；四张头像转换后均变大。因此不应仅为统一后缀将所有 JPEG 转成无损 WebP。手机背景在配置中明确标注为受保护资源，保留原始文件。

另外试验了四个 PNG 图标的无损重新压缩，并保留元数据。像素一致；有两张变大，两张合计仅减少 2,139 B，暂不改动。

## 判断与后续方向

当前主要内容已经采用 WebP，但格式本身不能保证资源足够轻。最大的图片是约 1.26 MiB 的手机背景；文章中的 Token 券图片虽然已是 WebP，仍有 547,144 B。后续优先评估它们的实际请求时机与传输成本。

`public/novels/yaoxing/showcase.webp`（493,390 B）和 `public/background/site-bg.webp`（171,194 B）在当前构建的页面、CSS 和 JS 中未发现引用。它们的存储大小不应直接算作首屏下载负担，原文件予以保留。

完整检查结果位于本地忽略目录 `.codex-fps-frames/performance/image-audit.json`。本次仅新增审计记录，图片资源、页面引用与画面表现均未修改。
