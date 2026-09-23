# 全站视觉系统重构与 Depth Map Parallax 方案

> 版本：Refactor V1.2  
> 状态：Depth Map Parallax 已回退，恢复单层 Pointer Parallax  
> 目标：背景原画优先，视觉增强局部化、交互化

## 1. 重构原因

此前 Atmospheric Fog / Volumetric Fog 系列已经验证了一件事：

- Shader 本身可以正常工作；
- 但全屏介质会持续改写背景插画的肤色、高光和构图；
- 对当前这张人物占比很高、亮部很多的背景图，收益低于代价。

因此正式停止：

- 全屏 Fog；
- 全屏 Volumetric Lighting；
- 任何会持续改色整张背景的后处理。

## 2. 新视觉原则

新的优先级为：

```text
背景原画完整性
    ↓
空间感
    ↓
UI 层级
    ↓
局部交互
    ↓
程序化装饰
```

具体原则：

1. 背景插画不再被全屏 Shader 改色。
2. 图形学只增强“深度 / 空间 / 交互”，不覆盖人物主体。
3. 常驻效果必须低侵入；明显效果只在交互时出现。
4. 所有效果都必须支持 Reduced Motion / Mobile fallback。
5. Navbar、左右侧栏保持常驻；Swup 仍只更新中间内容。

## 3. 当前保留效果

- Background Pointer Parallax；
- Mouse Edge Light；
- 外围 Technical Grid；
- 原有 Mouse Spark；
- 小说区独立 Visual Effects。

## 4. Depth Map Parallax 实验结论

### 4.1 核心思路

使用两张图：

```text
site-bg.webp
    +
site-bg-depth.svg

depth:
黑 = 远
白 = 近
```

Fragment Shader 只做一件事：

```glsl
depth = texture(depthMap, uv).r;
offset = pointer * depth * strength;
color = texture(background, uv + offset);
```

它不会：

- 改亮度；
- 改饱和度；
- 加雾；
- 加 Bloom；
- 加滤镜。

因此背景原图的颜色与高光保持不变。

### 4.2 为什么改用 Depth Map

当前单层 Pointer Parallax 是整张图一起移动，只能产生“背景在跟鼠标走”的感觉。

Depth Map Parallax 会让：

- 前景腿部移动幅度更大；
- 人物主体次之；
- 沙发 / 椅子更小；
- 房间背景最小。

实际接入后，人物内部不同区域产生了可感知的相对位移，技术上成立，但视觉上出现“插画被拉扯”的违和感。对于当前这种人物占比高、主体连续、又被大量卡片遮挡的背景，Depth Map Parallax 的收益低于破坏原画完整性的代价。

因此该方案正式回退，不作为当前博客基线。

### 4.3 工程结构

```text
Layout.astro
  ↓
site-bg-image              CSS fallback
  ↓
DepthParallaxBackground    WebGL2，仅负责颜色贴图 + depth 位移
  ↓
site-bg-frosted
  ↓
site-content
```

单独拆出 `DepthParallaxBackground`，不重新把 WebGL 塞回 `SiteGraphicsLayer`。

原因：

- 背景渲染与 UI 微交互职责分离；
- 后续删除 / 降级更简单；
- Fog 实验不会再污染背景组件；
- Swup 切页不重建背景渲染器。

### 4.4 性能边界

- 只在 Desktop + Fine Pointer 启用；
- Reduced Motion 直接使用 CSS 静态背景；
- WebGL2 不可用时自动 fallback；
- DPR 最大约 1.25；
- 像素预算约 150 万；
- 不连续跑 60 FPS，只在 Pointer 改变和惯性收敛期间 requestAnimationFrame；
- 单 WebGL Context。

### 4.5 Depth Map 资产边界

Depth Map 不使用原图亮度直接推断深度，因为“白色”不等于“近”。

当前背景按语义手工建立粗深度：

```text
房间 / 墙 / 家具   → 远
沙发 / 靠垫       → 中远
头发 / 身体       → 中近
手臂 / 书         → 近
右侧腿部          → 最近
```

第一版已使用 SVG 语义深度图落地，边缘故意做得较柔，因为位移幅度很小；后续只在实际观察到明显撕裂的位置继续精修 mask。

`DepthParallaxBackground` 已从 `Layout.astro` 拆除，`depthSrc` 配置已移除。当前重新只使用原 `#site-bg-image` + Pointer Parallax。

## 5. 验收标准

Depth Map Parallax 成功必须同时满足：

- 背景颜色与关闭特效时基本一致；
- 角色肤色 / 白衣 / 腿部高光不变灰；
- 鼠标移动时前景和远景速度明显不同；
- 静止后完全停止 GPU 连续刷新；
- 卡片 / Navbar / Sidebar 不移动；
- 页面切换不重建布局；
- Mobile / Reduced Motion 无异常。

## 6. 后续路线

```text
原版 Pointer Parallax
        ↓
恢复原版卡片通透度
        ↓
Navbar / 按钮 / 卡片 Hover 微交互
        ↓
Typography / Spacing 小步精修
        ↓
外围程序化装饰精修
```

后续不再引入全屏 Fog、Bloom、God Rays、Depth Map 背景扭曲或全局颜色后处理。
