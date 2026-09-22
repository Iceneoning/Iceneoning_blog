# 导航字段修改与新增指南

这份文档用于说明如何修改顶部导航的 6 个字段，以及后续如何新增或删除字段。

## 1. 配置位置

编辑文件：

src/config.ts

修改对象：

navBarConfig.links

当前写法示例（你现在的结构）：

```ts
export const navBarConfig: NavBarConfig = {
  links: [
    { name: "启航", url: "/" },
    { name: "介绍", url: "/intro/" },
    { name: "目录", url: "/archive/" },
    { name: "游戏", url: "/archive/?tag=游戏" },
    { name: "代码", url: "/archive/?tag=代码" },
    { name: "友之屋", url: "/friends/" },
  ],
};
```

## 2. 你这 6 个字段的推荐分工

- 启航：`/`（首页）
  页面已加入“崭新出炉”和“精彩回顾”两个区块。

- 介绍：`/intro/`
  对应 Markdown 文件：`src/content/spec/intro.md`。
  可以放图片、列表、代码块、引用等内容。

- 目录：`/archive/`
  保持默认归档功能不变。

- 游戏：`/archive/?tag=游戏`
  通过文章 `tags` 包含“游戏”来归入该栏目。

- 代码：`/archive/?tag=代码`
  通过文章 `tags` 包含“代码”来归入该栏目。

- 友之屋：`/friends/`
  对应 Markdown 文件：`src/content/spec/friends.md`，用于维护友链。

## 3. 给“游戏 / 代码”添加文章

在文章 frontmatter 里写入对应标签即可：

```yaml
---
title: 示例文章
published: 2026-03-31
tags: [游戏, 博客]
category: 游戏
draft: false
---
```

代码栏目同理：

```yaml
---
title: 代码示例
published: 2026-03-31
tags: [代码, Astro]
category: 代码
draft: false
---
```

## 4. 修改现有字段（名字或跳转）

只改对应项的 name 和 url 即可：

```ts
{ name: "启航", url: "/" }
```

- name：导航栏显示文字
- url：点击后的页面地址

## 5. 新增字段

在 links 数组里新增一个对象：

```ts
{ name: "新栏目", url: "/archive/?tag=新标签" }
```

数组顺序就是导航显示顺序。

## 6. 删除字段

直接删除对应对象（包括末尾逗号按语法处理）。

## 7. 常用链接模板

### 内部页面

- 首页：/
- 介绍：/intro/
- 友链：/friends/
- 归档：/archive/

### 按标签筛选归档

- /archive/?tag=游戏
- /archive/?tag=代码

### 按分类筛选归档

- /archive/?category=教程

## 8. 外部链接（可选）

如果你要加站外链接（例如 B 站、GitHub），可以这样写：

```ts
{
  name: "GitHub",
  url: "https://github.com/你的用户名",
  external: true,
}
```

- external: true 会在导航里显示外链图标，并用新标签页打开。

## 9. 注意事项

- 内部链接建议以 / 开头，例如 /intro/。
- 标签和分类的中文可以直接写，项目会自动处理编码。
- 避免多个字段完全同名同地址，后续维护容易混淆。

## 10. 修改后如何检查

1. 运行 pnpm dev
2. 打开本地页面并刷新
3. 检查导航文字、顺序、跳转是否正确
