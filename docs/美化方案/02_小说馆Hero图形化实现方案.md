# 小说馆 Hero 图形化实现方案

> 版本：Visual V3.7
>
> 目标：把小说馆 Hero 从“CSS 装饰集合”升级为可维护的 2.5D 实时图形层。

## 1. 设计原则

Hero 继续遵循：

```text
左信息
+
中间实时光场
+
右侧作品 Showcase
```

但中段不再通过不断增加绝对定位的静态 `span` 实现。

Visual V3.7 使用职责明确的图形管线：

```text
CSS
→ 环境色场 / 强 Bloom / Lens Flare / 云雾 / 棱镜 / 角色融合

SVG
→ 主轨道 / 副轨道 / 第三轨道 / 椭圆环 / 双向沿轨高光 / 远景城市轮廓

Canvas 2D
→ Glow 粒子 / Dust / Prism Shard / 高速 Streak

JavaScript
→ 生命周期 / Resize / Intersection / 轻量鼠标视差

Showcase
→ 小说自身立绘 / 插画

Left Decor
→ 左侧切线 / 发光节点 / 低权重轨道

Core Structure
→ 中部能量环 / 扫描轴 / 脉冲节点

Character Aura
→ 右侧背光环 / 底部光雾 / 左缘羽化 / 前景融合

Character Compositing
→ 三层立绘：Ghost 大范围散射光 + Edge 轻度模糊边缘过渡 + Main 清晰主体；Main 与 Edge 都进行左侧/底部 Alpha 羽化
```

## 2. DOM 分层

```text
novel-library-hero
├─ novel-library-copy               z=8
├─ novel-hero-lightfield            z=2
├─ novel-hero-orbit-field (SVG)     z=3
├─ novel-library-showcase           z=4
├─ novel-hero-flare-field           z=5
└─ novel-hero-particle-field        z=6
```

粒子和部分光效位于角色前景，因此能产生真正的前后遮挡层次，而不是所有元素都像贴纸。

## 3. CSS 环境光场

Hero 背景由多个 `radial-gradient` 与 `linear-gradient` 组成：

- 左侧保持较稳定、较深的蓝；
- 中央形成较亮的椭圆光场；
- 右侧向较清透的主题蓝过渡；
- Light / Dark 都由全站 `--primary` 派生。

`novel-hero-lightfield` 负责二级 Bloom，并以约 7.5 秒周期进行低频呼吸。

## 4. SVG 轨道

SVG 使用 1000×320 的逻辑坐标。

包含：

1. 主 Bezier 轨道；
2. 副 Bezier 轨道；
3. 椭圆 Ring；
4. 沿主轨道移动的 Spark。

使用 SVG 的原因：

- 曲线比 CSS border/ellipse 更精确；
- `pathLength` 可统一动画距离；
- `stroke-dasharray / stroke-dashoffset` 可实现沿轨移动高光；
- SVG filter 可产生稳定 Glow；
- 响应式下不会出现多层绝对定位错位。

## 5. Canvas 粒子系统

脚本：

```text
src/scripts/novel-hero-effects.ts
```

粒子采用固定 seed 生成，因此每次进入页面的总体视觉分布一致，不会随机成完全不同的画面。

粒子类型：

- `glow`：带主题色 Bloom 的光点；
- `dust`：极小冷白浮尘；
- `shard`：三角棱镜碎片。

粒子不是全屏随机游走，而是沿中段的参数化流线运动：

```text
x = left + progress × flowWidth
y = center + band + sin(progress + phase) × amplitude
```

因此它们在视觉上会自然连接左侧信息区和右侧立绘。

## 6. 性能边界

Canvas 粒子数量根据 Hero 实际宽度计算：

```text
最少 42
最多 82
约 width / 18
```

其他约束：

- Device Pixel Ratio 最大按 2 处理；
- Canvas 仅覆盖 Hero，不做全屏特效；
- Hero 离开视口后停止实际绘制；
- 使用 ResizeObserver 适配尺寸；
- Swup page:view 时销毁上一实例并重新挂载；
- 监听 `<html>` 的 `class/style` 变化，使 Canvas Bloom 实时跟随调色板与 Light/Dark；
- 不引入 Three.js / PixiJS / WebGL 依赖。

Visual V3.7 进一步针对人物外轮廓过硬的问题，将角色从双层合成升级为三层合成。Ghost 负责大范围空气光与散射；新增 Edge 层使用约 4.5px 的轻模糊、较低对比度与独立 Alpha 羽化，只负责填补主体边缘和背景之间的视觉断层；Main 保留脸部、头发主体和服装关键细节，但左侧羽化范围扩大、底部衰减提前，并轻微降低整体饱和与对比。这样柔化发生在轮廓过渡区，而不是把整个人物一起模糊。

## 7. 2.5D 鼠标视差

Hero 内不同层使用不同 depth：

```text
SVG Orbit       0.35
Light Field     0.55
Flare           0.70
Particle Canvas 0.90
Showcase        0.35
```

鼠标坐标先归一化到 `[-0.5, 0.5]`，最大位移约：

```text
X：26px
Y：16px
```

实际层位移再乘 depth。

脚本使用插值：

```text
current += (target - current) × 0.075
```

因此不是生硬跟随鼠标，而是存在轻微惯性。

## 8. Reduced Motion 与移动端

`prefers-reduced-motion: reduce`：

- 停止轨道 Spark；
- 停止 Bloom 呼吸；
- 停止 Flare 呼吸；
- 关闭鼠标视差；
- Canvas 保留静态一帧。

小于 900px：

- 图形层隐藏；
- Showcase 按现有移动端规则隐藏；
- Hero 回到简单的 Fuwari 单列布局。

## 9. 维护规则

1. 不再向 Hero 中追加大量一次性 `novel-atmosphere-* span`。
2. 轨迹类效果优先放 SVG。
3. 大量微小动态元素优先放 Canvas。
4. 大面积 Bloom、渐变和混合仍交给 CSS。
5. 作品差异只通过 Showcase 数据表达；图形系统不读取小说主题关键词。
6. 视觉验收必须看实际截图，`pnpm check/build` 只证明工程正确，不证明审美达标。
7. 若未来 Canvas 2D 成为性能或表现瓶颈，再单独评估 WebGL shader，不提前引入。

## 10. 当前文件

```text
src/pages/novels/index.astro
src/scripts/novel-hero-effects.ts
src/scripts/novel-showcase.ts
src/styles/novel.css
src/layouts/Layout.astro
docs/美化方案/02_小说馆Hero图形化实现方案.md
```
