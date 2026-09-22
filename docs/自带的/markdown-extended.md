---
title: Markdown 扩展功能
published: 2024-05-01
updated: 2024-11-29
description: '在 Fuwari 中了解更多 Markdown 扩展能力'
image: ''
tags: [演示, 示例, Markdown, Fuwari]
category: '示例'
draft: false 
---

## GitHub 仓库卡片
你可以添加链接到 GitHub 仓库的动态卡片。页面加载时，仓库信息会从 GitHub API 拉取。

::github{repo="Fabrizz/MMM-OnSpotify"}

使用 `::github{repo="<owner>/<repo>"}` 可以创建 GitHub 仓库卡片。

```markdown
::github{repo="saicaca/fuwari"}
```

## 提示块（Admonitions）

目前支持的提示块类型有：`note` `tip` `important` `warning` `caution`

:::note
用于突出即使快速浏览时也应注意的信息。
:::

:::tip
可选信息，帮助用户更顺利地完成任务。
:::

:::important
完成任务所必需的重要信息。
:::

:::warning
由于存在潜在风险而需要用户立即关注的关键内容。
:::

:::caution
某个操作可能带来的负面后果。
:::

### 基础语法

```markdown
:::note
用于突出即使快速浏览时也应注意的信息。
:::

:::tip
可选信息，帮助用户更顺利地完成任务。
:::
```

### 自定义标题

提示块的标题可以自定义。

:::note[自定义标题示例]
这是一个使用自定义标题的提示块。
:::

```markdown
:::note[自定义标题示例]
这是一个使用自定义标题的提示块。
:::
```

### GitHub 语法

> [!TIP]
> 也支持 [GitHub 提示块语法](https://github.com/orgs/community/discussions/16925)。

```
> [!NOTE]
> 也支持 GitHub 提示块语法。

> [!TIP]
> 也支持 GitHub 提示块语法。
```

### 剧透（Spoiler）

你可以在文本中添加剧透内容，剧透内同样支持 **Markdown** 语法。

内容 :spoiler[被隐藏了 **嘿嘿**]！

```markdown
内容 :spoiler[被隐藏了 **嘿嘿**]！

```