# 星空开场 · 当前方案

当前选型：**V4.5「星水涟漪」**，已接入 Fuwari 正式源码。

## 在哪里预览

- 独立可调参数 Demo：`experiments/star-intro/v4-5/index.html`
- 统一入口：`experiments/star-intro/index.html`（直接跳转当前 Demo）
- 正式博客源码：`src/scripts/star-intro.ts`、`src/components/StarIntro.astro`、`src/components/StarIntro.css`。
- 本地博客入口：`pnpm dev`，访问 `/?intro=1` 强制播放一遍。

**正式开场参数：星纹强度 200%、水感 100%。** V4.5 Demo 内滑块仍可调整，用于后续美术对照，默认值不等于正式站参数。

## 清理说明（2026-10-11）

早期 V1～V4.4 开场实验已不再作为可用版本维护。清理仅涉及独立实验素材，不移除正式渲染器；原设计演变可以在 Git 历史中回溯。小说馆使用 `src/scripts/novel-crystal-hero.ts`，不再使用旧 `novel-hero-effects.ts`。

## 工程约束

开场是一次性的全屏覆盖层，动画结束即销毁 Canvas/WebGL，不得常驻博客背景。保留原 MP4、Swup 局部页面切换与全站三栏结构。不要将 Demo 中的调试控制直接引入生产。
