# 星空开场动画实验室（独立预览）

当前阶段：原型验证；**未接入正式博客，尚未选型**。

## 预览

直接在 Windows 文件资源管理器中双击：

`H:/vs_code/fuwari/experiments/star-intro/index.html`

然后从入口选择方案。每个页面均可直接双击打开，无需运行 `pnpm dev` 或构建项目。

| 文件 | 方案 | 时长 | 设计重点 |
| --- | --- | --- | --- |
| `01-star-veil.html` | 星辉显影 | 3.0 s | 星点/连接线/星幕揭晓 |
| `02-meteor-trails.html` | 流星掠影 | 2.8 s | 斜向流星与细尾迹 |
| `03-orbit-ripple.html` | 星环涟漪 | 3.2 s | 环形扩散/微光粒子 |

- `index.html` 是方案总览，`shared.css` 是独立原型样式，`intro.js` 为 WebGL1 Shader 实现。
- 演示使用当前博客的视频 `../../public/background/star-sea-loop-1080p.mp4`；原视频保持不变。
- 小屏使用 `../../public/background/mobile-background.jpg`，静态回退贴图沿用 `star-sea-poster.webp`。
- 支持重播、跳过；`prefers-reduced-motion` 与不支持 WebGL 的浏览器自动直达完成状态。
- 页面切到后台时暂停帧循环，不持续占用 GPU；设备像素比上限 1.35。

## 工程隔离边界

- 这些文件只在 `experiments/star-intro/`，不在 `public` 或 `src/pages` 中。
- Astro 不会自动把这些 HTML 变成正式站点路由；无全局 CSS、无生产脚本导入、无 Swup 钩子。
- **本阶段严禁**修改 `src/layouts/Layout.astro`、`src/scripts/background-video.ts`、`src/scripts/background-parallax.ts` 和网站配置。
- 选型与用户视觉验收之后再决定首次访问策略、动画退出/加载失败兜底以及集成位置。
- 不应使用动画等待视频加载；真实集成时视频解码与动画应并行，并限制播放次数。
