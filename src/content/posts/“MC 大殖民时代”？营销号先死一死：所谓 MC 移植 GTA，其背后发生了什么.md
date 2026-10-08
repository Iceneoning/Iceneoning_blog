---
title: “MC 大殖民时代”？营销号先死一死：所谓 MC 移植 GTA，其背后发生了什么
published: 2026-10-05
description: "从 universal-modder 的 Minecraft × GTA Demo 出发，解释 Passthrough、跨游戏状态同步、渲染合成、Decomp Library，以及所谓“游戏移植”究竟发生了什么。"
image: "/images/Posts/universal-modder/1《我的世界》闯入洛圣都.webp"
tags: ["AI", "游戏开发", "Mod", "Minecraft", "GTA5", "逆向工程"]
category: 代码
draft: false
---

# “MC 大殖民时代”？营销号先死一死：所谓 MC 移植 GTA，其背后发生了什么

最近如果你稍微关注一点游戏、AI 或 Mod 圈，大概率刷到过这种东西：

**“Minecraft 被完整移植进 GTA5 了。”**

视频里的场面也确实相当离谱。

Steve 站在洛圣都的大街上。

可以正常走路。

可以放方块。

可以当着路人的面原地起一栋经典火柴盒。

可以掏出 TNT，把 GTA 的汽车直接炸飞。

Minecraft 里的怪物甚至还能和 GTA 的警察打起来。

再配上一点震惊体标题：

> AI 已经可以把一个游戏直接移植进另一个游戏了！

再夸张一点：

> 以后任何游戏都可以被塞进任何游戏！

再往下发展一点：

> Minecraft 大殖民时代正式开始！

看完视频之后，你甚至很容易得出一个非常合理的结论：

```text
有人做出了一个万能游戏移植工具。

输入：

Minecraft

输出：

GTA5 Minecraft Mod
```

甚至很容易把它理解成一个“万能游戏转换器”：只要把 Minecraft 丢进去，再指定一个目标游戏，它就能自动变成对应的 Mod。

```text
Minecraft
    ↓
universal-modder
    ↓
GTA5

Minecraft
    ↓
universal-modder
    ↓
Elden Ring

Minecraft
    ↓
universal-modder
    ↓
Skyrim

Minecraft
    ↓
universal-modder
    ↓
任何游戏
```
如果真是这样，那意思就很简单了：今天是 GTA5，明天换成《艾尔登法环》、Skyrim，后天理论上什么游戏都能塞。

好家伙。

MC 真要开始大殖民了。

以后说不定打开《黑暗之魂》，出生点先看到一棵橡木。

打开《怪物猎人》，苍火龙旁边站着一只苦力怕。

打开《赛博朋克 2077》，荒坂塔顶上有人搭火柴盒。

于是我顺着视频里出现的项目名去 GitHub 找到了它，准备看看这东西到底是怎么实现的。

再结合这个项目的名字：

**`universal-modder`。**

Universal。

万能。

Modder。

万能 Mod 工具。

名字都已经嚣张成这样了。

那营销号说它能“把 Minecraft 移植进 GTA”，听起来似乎也没什么毛病。

甚至我第一次看到这个项目的时候，也很好奇：

**这帮人到底怎么把 Minecraft 塞进 RAGE Engine 里的？**

是把 Minecraft 的世界系统重写了一遍？

把方块系统重新实现在 GTA 里？

还是更加离谱——直接让 GTA 跑起了 Minecraft 的游戏逻辑？

于是我去翻了一下这个项目。

然后发现：

**事情根本不是这么回事。**

准确来说——

**Minecraft 压根没有被移植进 GTA。**

甚至可以说：

**Minecraft 从头到尾都没进去过 GTA。**

---

## 因为真正发生的事情是：两个游戏都开着

到这里也能看出来，前面那些“完整移植”的说法从一开始就把概念带偏了。

说难听点，这已经有点像一场无知者的狂欢：标题越传越夸张，真正的技术事实反而被丢在后面。

这件事第一次看可能有点反直觉。

在所谓的“Minecraft 被移植进 GTA”的 Demo 里：

**Minecraft 还是 Minecraft。**

**GTA5 还是 GTA5。**

两个游戏都是完整运行的。

甚至就是两个独立进程：

```text
Minecraft.exe

和

GTA5.exe
```

都活得好好的。

真正发生的事情不是：

```text
Minecraft
   ↓
移植
   ↓
GTA
```

而是：

```text
Minecraft.exe
      │
      │
      │ 数据通信
      ▼
    Bridge
      ▲
      │
      │
GTA5.exe
```

然后再想办法让：

```text
两个世界的位置
摄像机
碰撞
事件
画面
```

尽可能对应起来。

最后再把两个 Renderer 的结果合成。

所以这个技术真正的名字并不是：

> Minecraft Port

而是：

**Passthrough Mod。**

![Minecraft 与 GTA5 同时运行，并通过 Bridge 同步关键数据](/images/Posts/universal-modder/2.webp)

`universal-modder` 给出的示例项目本身就叫：

**Minecraft × GTA V Passthrough。**

也就是说，所谓：

> “Minecraft 被移植进 GTA。”

如果非要翻译成人话，更接近：

> “Minecraft 和 GTA 同时在后台跑，然后有人搭了一座桥。这里的‘桥’不是地图里的桥，而是一层桥接程序：专门在两个游戏进程之间传位置、摄像机、碰撞和事件。最后再把两边画面合到一起，于是玩家看起来就像真的处在同一个世界里。”

到这里，这件事情反而开始比“简单移植”有意思了。

因为新的问题来了：

**两个完全不同的游戏，到底怎么骗过玩家，让你觉得它们真的在同一个世界？**

---

# `universal-modder` 到底是什么？

先把 Minecraft × GTA 放一边。

这个项目名字其实非常容易让人误解。

`universal-modder` 并不是：

```text
游戏 A
  ↓
universal-modder
  ↓
自动变成游戏 B 的 Mod
```

也不是一个：

> “上传游戏，点击转换。”

的万能移植器。

它更像是一整套给 AI Agent 准备的：

**游戏 Mod / 逆向 / 自动化工程工具链。**

这里先记住一个后面还会出现的概念：**Decomp Library**。

它不是让两个完整游戏同时运行，而是把一个游戏的一部分原始逻辑经过逆向、反编译和整理，变成宿主程序可以直接调用的 Library。这个思路比“万能移植”更接近 `universal-modder` 真正想覆盖的技术边界，后面会专门展开。

简单来说，它想做的事情不是：

> 帮人生成一段 Mod 代码。

而是让 Claude Code、Codex 之类的 Agent 尽可能独立完成：

```text
调查游戏
   ↓
判断游戏引擎
   ↓
寻找 Mod Loader / API
   ↓
选择技术路线
   ↓
逆向 / 编码
   ↓
编译
   ↓
启动真实游戏
   ↓
观察结果
   ↓
验证是否成功
   ↓
继续修改
```

这其实是它比 Minecraft × GTA Demo 更值得关注的地方。

过去我们让 AI 写 Mod，大概是：

```text
人：
帮我写个 Mod。

AI：
这是代码。

人：
复制进去。

编译。

报错。

把报错复制回来。

AI：
再改。

人：
重新打开游戏。

发现游戏炸了。

截图。

继续问。
```

AI 其实只是：

**代码生成器。**

而 `universal-modder` 想尝试的是：

```text
Agent
 │
 ├─ Recon
 ├─ Reverse Engineering
 ├─ Coding
 ├─ Build
 ├─ Launch Game
 ├─ Observe
 ├─ Verify
 └─ Iterate
```

也就是让 Agent 自己参与整个工程闭环。

而 Minecraft × GTA，就是它拿来展示这套工作流能力的一个非常夸张的例子。

---

# 那两个游戏到底是怎么“合体”的？

整个 Minecraft × GTA 的 Passthrough，大致可以拆成三个层次：

```text
第一层：Render Fusion
让两个游戏看起来处于一个世界

第二层：State Synchronization
让两个游戏的关键状态对应起来

第三层：Gameplay Synchronization
让两个游戏里的东西真的互相影响
```

这里第三层最重要。

因为如果只有第一层，那其实顶多只能算：

**高级版绿幕。**

---

# 第一层：先把两个游戏“画”到一起

最简单的想法当然是：

```text
把 Minecraft 截图
盖到 GTA 上。
```

这确实能做到：

> GTA 画面里出现 Minecraft。

但有个非常明显的问题。

假设 Steve 实际应该站在 GTA 大楼后面。

如果你只是把 Minecraft 图片叠在 GTA 图片上：

```text
Minecraft Layer

   Steve
     ↓
████████████

GTA Layer

████ 大楼 ████
```

Steve 永远都会显示在大楼前面。

因为你只是在：

**叠图片。**

电脑根本不知道：

> 谁离摄像机更近？

所以这里就需要一个非常重要的东西：

**Depth Buffer。**

![Render Fusion 中直接叠图与使用 Depth Buffer 合成的区别](/images/Posts/universal-modder/3.webp)

---

## Depth Buffer 是什么？

可以粗暴理解成：

Color Buffer 记录：

> 这个像素是什么颜色。

Depth Buffer 记录：

> 这个像素离 Camera 有多远。

例如某个像素：

```text
GTA 大楼：10m

Minecraft Steve：30m
```

显然：

```text
10 < 30
```

所以 GTA 大楼应该显示在前面。

Steve 被挡住。

另一个位置：

```text
Minecraft 方块：5m

GTA 汽车：20m
```

那么：

```text
5 < 20
```

Minecraft 方块应该显示在前面。

最终整个逻辑就从：

```text
MC Screenshot
+
GTA Screenshot
```

变成：

```text
MC Color
MC Depth
    │
    ▼
Depth Comparison
    ▲
    │
GTA Color
GTA Depth
    │
    ▼
Final Frame
```

于是最终玩家看到的是：

```text
GTA 建筑

    Minecraft 方块

        Steve

GTA 汽车
```

它们之间甚至能够产生正确的前后遮挡。

这时候视觉上才真正开始像：

> 两个世界被融合在了一起。

---

# 第二层：Camera 也必须一致

光解决遮挡还不够。

因为：

Minecraft 有自己的 Camera。

GTA 也有自己的 Camera。

假如：

```text
GTA Camera → 向右转 30°
```

Minecraft Camera 却没动。

那么 MC 世界立刻就会像一张漂浮的贴纸一样滑出去。

所以这个项目里：

**GTA Camera 会驱动 Minecraft Camera。**

GTA 把类似这些信息发过去：

```text
Camera Position

Camera Rotation

Player Position

Heading
```

然后 Minecraft 把自己的 Camera 强制调整到对应状态。

你可以简单理解为：

```text
              GTA Camera
                  │
            Camera State
                  │
          ┌───────┴───────┐
          ▼               ▼
      GTA Renderer     MC Renderer
```

两个游戏虽然处于两个不同世界，

但它们尽量使用：

**同一个观察视角。**

之后 Depth Buffer 才有意义。

---

# 坐标系还得翻译

事情当然没这么简单。

不同游戏对坐标轴的定义可能完全不同。

比如某个引擎认为：

```text
X = 前后
Y = 左右
Z = 上下
```

另一个可能是：

```text
X = 左右
Y = 上下
Z = 前后
```

于是 Bridge 还需要负责：

**Coordinate Transform。**

这个项目甚至可以规定：

```text
1 GTA metre
=
1 Minecraft block
```

于是 GTA 里：

```text
向前移动 5m
```

对应 Minecraft：

```text
移动 5 Block
```

这也是为什么 Minecraft 特别适合这种实验。

它的世界本身就是非常干净的离散坐标。

![Minecraft 与 GTA V 之间的关键状态同步](/images/Posts/universal-modder/4.webp)

---

# 第三个问题：Steve 为什么不会掉下去？

现在画面能对齐了。

Camera 也对齐了。

然后新的问题来了。

Steve 看起来站在 GTA 的马路上。

但是：

**Minecraft 根本不知道那里有马路。**

在 Minecraft World 看来：

```text
Steve

 ↓

 ↓

 ↓

Void
```

于是 Minecraft 的物理系统会非常诚实地把 Steve 往下掉。

解决办法其实非常朴素。

GTA：

**负责探测地面。**

然后告诉 Minecraft：

> 这里有东西。

Minecraft 再在对应位置生成：

**Invisible Barrier。**

于是：

```text
GTA World

       Steve
────────────────
       马路
         │
         │ Ground Probe
         ▼

Minecraft World

       Steve
████████████████
 Invisible Barrier
```

Minecraft 不需要知道：

> GTA 这里是一条什么材质的马路。

它只需要知道：

> 这里不能往下掉。

这就足够了。

这个设计其实非常重要。

因为它体现了跨游戏同步的一个基本原则：

**不要同步整个世界。**

只同步：

**对另一套 Simulation 有意义的最小信息。**

---

# 那 Minecraft 的方块怎么挡住 GTA 汽车？

反方向也是一样。

Steve：

```text
啪。
```

放了一个方块。

Minecraft 自己当然知道：

```text
这里现在有 Block。
```

但是 GTA：

> 关我屁事？

于是一辆 GTA 汽车开过来：

```text
汽车 →→→→→

████ Minecraft Wall

→→→ 穿墙
```

怎么办？

Minecraft 把：

```text
Block Placed
Position = ...
```

这样的事件告诉 GTA。

GTA 在那里建立：

**Invisible Collision Object。**

于是：

```text
Minecraft：

███████
方块

    ↓ 同步

GTA：

███████
Invisible Collision

汽车 → 撞上去
```

视觉由 Minecraft 提供。

GTA 只需要一个：

**能撞的东西。**

双方各自维持最适合自己的表示。

---

# 到这里其实还不算最厉害

到目前为止只是：

```text
Rendering
+
Transform
+
Collision
```

真正让这个 Demo 从“技术演示”变成“看起来像一个游戏”的，是：

**Gameplay Event Mapping。**

比如：

Minecraft：

```text
TNT
 ↓
BOOM
```

Minecraft 自己执行一次爆炸。

然后同时发送：

```text
Explosion

Position

Power
```

GTA 接收到以后：

也执行一次自己的爆炸。

于是：

```text
             Minecraft TNT
                    │
              Explosion Event
                    │
             ┌──────┴──────┐
             ▼             ▼
      MC Explosion    GTA Explosion
             │             │
             ▼             ▼
       MC Entity       GTA Cars
      受到影响          被炸飞
```

所以玩家看到的是：

> Minecraft 的 TNT 把 GTA 的汽车炸飞了。

实际上：

**两边各炸各的。**

Bridge 只是告诉双方：

> 同一个位置，现在发生了一件叫“爆炸”的事情。

![Gameplay Synchronization：两边的玩法事件产生对应影响](/images/Posts/universal-modder/5.webp)

---

# 这才是真正有意思的地方

同样的思想可以继续扩展：

```text
Minecraft Arrow
        ↓
GTA Projectile / Damage

Minecraft Firework
        ↓
GTA Explosion

Minecraft Mob
        ↓
GTA NPC Interaction

Minecraft Block
        ↓
GTA Collision
```

你会发现：

这时候已经不是：

> 把两个游戏画面叠到一起。

而是：

**两套独立的 Gameplay Simulation 开始通过事件互相影响。**

整个东西就变成：

```text
         Minecraft Simulation
             │           │
       State/Event   Color/Depth
             │           │
             ▼           ▼
                Bridge
             ▲           │
             │           │
       State/Event       │
             │           ▼
           GTA Simulation
                  │
                  ▼
          Render Composition
                  │
                  ▼
                玩家
```

所以我们可以说：

**玩家同时体验到了两个游戏的玩法。**

但是底层实际上是：

**两个游戏分别跑自己的玩法，然后只同步双方真正需要知道的东西。**

---

# 所以这东西当然不只适用于 Minecraft

这就是“MC 大殖民时代”这个梗最好玩的地方。

Minecraft 并没有什么特殊的跨游戏能力。

理论上完全可以是：

```text
Game A
   ×
Game B
```

例如：

```text
Minecraft × GTA

Minecraft × Elden Ring

Skyrim × Minecraft

UE 游戏 × Unity 游戏

老游戏 × 新引擎程序
```

甚至两个完全和 Minecraft 无关的游戏。

关键问题只有：

**你到底能够从两边拿到多少信息？**

例如：

```text
Camera

Transform

Input

Collision

Gameplay Event

Color Buffer

Depth Buffer
```

以及：

**你能不能修改两边的状态？**

只要能够做到这些，就存在 Passthrough 的可能性。

注意。

是：

**存在可能性。**

不是：

**universal-modder 可以一键做到。**

不同游戏的开放程度完全不同。

---

# 那为什么偏偏是 Minecraft？

因为 Minecraft 简直是这种 Demo 的天选对象。

第一：

**Mod 生态成熟。**

Fabric 等工具让你可以非常深入地操作：

```text
Player

World

Block

Entity

Rendering

Event
```

第二：

**世界结构简单。**

Minecraft 最大的优势是：

**Block。**

你甚至可以直接：

```text
1 MC Block
=
1 GTA Metre
```

很多对应关系天然成立。

例如：

```text
Minecraft                  GTA

Position        ←→        Position

Ground          ←→        Ground

Block           ←→        Collision

Entity          ←→        Entity

Explosion       ←→        Explosion

Projectile      ←→        Projectile

Camera          ←→        Camera
```

这些 Gameplay Primitive 非常好理解。

---

# 换两个复杂游戏就没这么简单了

比如：

```text
Dark Souls
×
Monster Hunter
```

黑魂的一次攻击可能涉及：

```text
Animation

Hitbox

Stamina

Poise

Damage Type

Invincibility Frame
```

怪物猎人又有：

```text
Motion Value

Sharpness

Hitzone

Element

Part Break

Stagger
```

那么现在有一个非常麻烦的问题：

> 黑魂里砍一刀，在怪猎里到底算什么？

到底是：

```text
多少 Motion Value？

什么 Sharpness？

砍哪个 Hitzone？

能不能 Part Break？

怎么算 Stagger？
```

这已经不是坐标转换了。

这叫：

**Gameplay Semantic Mapping。**

即：

> 游戏 A 的一个行为，在游戏 B 的规则里究竟意味着什么？

两个游戏系统越复杂，这种映射的工作量就越恐怖。

Minecraft × GTA 之所以看起来特别自然，很大程度就是因为：

**它们很多基础行为刚好很好翻译。**

---

# Passthrough 也不是“游戏融合”的唯一办法

`universal-modder` 还总结了另外几种思路。

![Content Port、Passthrough、Decomp Library 与 Reimplementation 四种路线的区别](/images/Posts/universal-modder/6.webp)

最容易理解的是：

## Content Port

可以简单记成：

> “我模仿你。”

比如：

在 GTA 里重新做一个 Creeper。

这个 Creeper：

看起来像 Minecraft。

行为也像 Minecraft。

但实际上它完全是：

**GTA 的东西。**

Minecraft 根本没运行。

---

## Passthrough

也就是这篇文章主要讲的：

> “我们两个一起跑。”

```text
Minecraft.exe

+

GTA5.exe
```

双方通过 Bridge 通信。

---

## Decomp Library

这个就更有意思了。

可以简单理解成：

> “我把你的原始游戏逻辑整理成一个 Library，然后让我直接调用。”

Decomp 来自：

**Decompilation。**

比如原来有：

```text
Game.exe
```

经过逆向、反编译和重构以后，把一些玩法逻辑整理成：

```text
GameLogic.dll
```

然后宿主程序可以直接：

```cpp
UpdatePlayer();
UpdatePhysics();
UpdateEnemy();
```

这时候可能根本不需要：

```text
Game.exe
```

继续运行。

这和 Passthrough 完全不同。

---

## Reimplementation

最后一个最狠：

> “我重新写一个你。”

也就是：

重新实现游戏 Runtime 或核心玩法系统。

这通常也是工作量最大的一种。

所以以后再看到：

> XXX 游戏被塞进 XXX 游戏！

其实最好先问：

```text
Content Port？

Passthrough？

Decomp Library？

还是 Reimplementation？
```

因为这四种东西完全不是一回事。

---

# 所以“MC 大殖民时代”到底来了没有？

作为梗：

**来了。**

作为技术事实：

**任何游戏的“大殖民时代”理论上都可能出现，但远不是一句“万能移植”就能概括的事。**

它首先受制于目标游戏是否可修改、桥接与适配成本，以及机器能不能同时扛住两套游戏和额外的同步、合成开销。

因为真正发生的事情并不是：

```text
Minecraft
   ↓
征服
   ↓
所有游戏
```

而是：

```text
Minecraft Simulation
        ↕
      Bridge
        ↕
   Other Game Simulation
```

以及：

```text
Minecraft Renderer
        │
    Color + Depth
        │
        ▼
Render Composition
        │
        ▼
      玩家
```

用人话说：

**Minecraft 并没有进入 GTA。**

它只是站在隔壁。

然后两边疯狂打电话。

最后 Renderer 帮它们 P 到了一张图里。

---

# 那 `universal-modder` 真正值得看的是什么？

如果只是：

> Minecraft 出现在 GTA 里。

其实做完理解之后，反倒没那么玄学。

真正让我觉得这个项目有意思的，是另外一件事：

**AI Agent 开始从“代码生成器”，往“工程执行者”发展了。**

![AI Agent 从侦察、逆向、编码、构建、启动、观察、验证到迭代的完整工程闭环](/images/Posts/universal-modder/7.webp)

它真正试图解决的问题是：

```text
AI 能不能自己：

理解一个陌生游戏

寻找修改入口

选择技术方案

写代码

编译

启动

测试

观察

失败

继续修改

最后证明自己真的做成功了？
```

这比：

> AI 会写代码。

要再往前走一步。

Minecraft × GTA 只是非常适合传播的 Demo。

因为它把：

```text
Java

C++

OpenGL

DirectX

IPC

Shared Memory

Shader

Depth Buffer

Reprojection

Collision

Mod Loader

Reverse Engineering
```

这么多东西全部揉到了一起。

最后还真的跑起来了。

所以 `universal-modder` 真正值得关注的，也许并不是：

> “AI 能把 Minecraft 移植到 GTA。”

而是：

> “AI 已经开始尝试自己完成一个复杂 Mod 工程的完整闭环。”

这两句话的技术含量完全不是一个级别。

---

# 最后

所以下一次如果你又刷到：

> 震惊！Minecraft 已被完整移植进 GTA！

可以先别急着见证：

**MC 大殖民时代。**

先问一句：

> “你这个移植，到底是哪种移植？”

如果答案是这个项目：

那严格来说：

**不是移植。**

是 Passthrough。

Minecraft 和 GTA：

**两个都还活着。**

只不过有人在中间搭了一座桥。

而这座桥，

其实比“把 Minecraft 塞进 GTA”本身更有意思。
