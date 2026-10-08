# 冰霓の梦之旅

> 分享生活趣事，学习技术，做好游戏。

这是 **冰霓 Iceneon** 的个人博客源码仓库。这里记录游戏开发、编程学习、游戏体验和日常想法，也存放自己写的故事。网站由 [Fuwari](https://github.com/saicaca/fuwari) 改造而来，持续调整布局、交互与阅读体验，并非 Fuwari 模板的官方演示仓库。

**访问博客：** https://iceneoning-blog.pages.dev/  
**关于我：** [站点介绍](https://iceneoning-blog.pages.dev/intro/) · [GitHub](https://github.com/Iceneoning)

## 这里有什么

- **杂谈与代码**：C++、游戏开发、技术实践、工具折腾，以及游戏和生活的见闻。
- **小说馆**：独立的作品展示、章节目录与阅读页面，采用区别于普通博客的布局。
- **友之屋**：友情链接与交流入口。
- **文章阅读**：标签与分类归档、站内搜索、文章目录、代码高亮和数学公式。

## 技术实现

| 模块 | 技术或实现 |
| --- | --- |
| 站点框架 | [Astro](https://astro.build/) + TypeScript |
| 样式与交互 | [Tailwind CSS](https://tailwindcss.com/) + [Svelte](https://svelte.dev/) |
| 页面导航 | [Swup](https://swup.js.org/)，主要内容区域过渡 |
| 内容管理 | Astro Content Collections + Markdown |
| 站内搜索 | [Pagefind](https://pagefind.app/)，构建后生成静态索引 |
| 阅读支持 | Expressive Code、KaTeX、文章目录、RSS、站点地图 |
| 外观 | 明暗主题、自定义背景和响应式布局 |

博客与小说区都在持续迭代。仓库内的部分设计文档记录了历史方案，实际行为请以当前代码为准。

## 本地开发

项目使用 `pnpm@9.14.4`，推荐 Node.js 22 和 pnpm 9。

```bash
pnpm install
pnpm dev
```

开发服务器默认运行于 `http://localhost:4321`，以终端实际显示的地址为准。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm check` | 运行 Astro 检查 |
| `pnpm build` | 构建网站并生成 Pagefind 索引（`dist/`） |
| `pnpm preview` | 预览构建产物 |
| `pnpm new-post <文件名>` | 创建一篇 Markdown 文章 |
| `pnpm format` | 使用 Biome 格式化 `src/` |

## 项目结构

```text
src/
├─ config.ts            # 站点、导航、个人信息和主题配置
├─ content/
│  ├─ posts/            # 博客文章
│  ├─ novels/           # 小说作品与章节
│  └─ spec/             # 介绍、友情链接等页面内容
├─ pages/               # 页面路由
├─ components/          # UI 组件（包含小说专区）
└─ layouts/             # 页面布局
public/                 # 图片、背景等静态资源
docs/                   # 设计方案与开发记录
astro.config.mjs        # Astro 构建与站点地址
```

文章使用 Markdown 和 Frontmatter 管理；内容字段定义见 `src/content/config.ts`。普通文章目前分为「代码」和「杂谈」两类。站点发布地址由 `astro.config.mjs` 配置。

## 致谢与授权

本站基于 [saicaca/Fuwari](https://github.com/saicaca/fuwari) 进行个人定制，感谢原作者与相关开源项目。仓库保留了原项目的 [MIT License](./LICENSE) 和版权声明。

本站原创文章按站点标注的 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 授权；第三方素材与其他内容遵循各自授权约定。
