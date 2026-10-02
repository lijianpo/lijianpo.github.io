# lijianpo · 技术、记录与思考

一个浅色、极简的中文个人博客。Astro 生成静态 HTML，Markdown 管理文章，Pagefind 提供中文全文搜索，GitHub Actions 自动部署到 GitHub Pages。

目标地址：**https://lijianpo.github.io**

目标仓库：**https://github.com/lijianpo/lijianpo.github.io**

## 本地运行

使用 Node.js 24 和 pnpm 11.14.0。项目通过 `.nvmrc` 和 `package.json` 固定工具版本。

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

开发地址默认为 `http://localhost:4321`。开发模式会显示草稿并明确标记。搜索索引在构建时生成，请使用生产预览验证搜索：

```bash
pnpm check
pnpm test:content
pnpm build
pnpm preview
```

`pnpm preview` 默认为 `http://localhost:4321`，可加 `--port 4322` 更换端口。正式预览与 GitHub Pages 一样不包含草稿。

## 写一篇文章

在 `src/content/posts/` 新建 Markdown 文件。文件名使用英文小写字母、数字和短横线，例如 `my-first-note.md`；文章地址为 `/posts/my-first-note/`。发布后保持文件名不变，以保留已有链接。

```markdown
---
title: '我的第一篇记录'
description: '一句简短的摘要，用于文章列表、搜索结果和分享。'
pubDate: 2026-10-02
tags: ['技术', '随笔']
draft: true
---

这里是文章的开头。

## 一个小标题

从一个具体的问题开始。
```

| 字段 | 说明 |
| --- | --- |
| `title` | 必填，文章标题 |
| `description` | 必填，文章摘要 |
| `pubDate` | 必填，`YYYY-MM-DD` 格式的发布日期 |
| `updatedDate` | 可选，最后更新日期 |
| `tags` | 可选，标签数组，默认空数组 |
| `draft` | 可选，是否为草稿，默认 `false` |

准备发布时把 `draft` 改为 `false`，提交到 `main` 即触发构建。`pubDate` 用于排序和展示，不是定时发布开关。日期统一按 `Asia/Taipei` 显示。

正文从二级标题 `##` 开始，二、三级标题自动进入目录。代码块注明语言后自动高亮。图片放入 `public/images/`，例如 `![图片说明](/images/example.png)`。完整排版示例见 `src/content/posts/markdown-example.md`。

**草稿只从网站产物中排除。此仓库公开，Markdown 草稿源文件仍然公开，请勿提交私密内容。**

## 修改个人信息与样式

- `src/site.config.ts`：站名、副标题、简介、作者、GitHub 地址及每页文章数量。
- `src/pages/about.astro`：关于页正文。
- `src/styles/global.css`：颜色、字体、布局与响应式样式。
- `astro.config.mjs`：正式网站地址与静态构建配置。
- `public/social-card.svg`：分享图源文件。修改后运行 `pnpm exec playwright install chromium` 和 `node scripts/generate-social-card.mjs` 更新 PNG。

首页显示最新文章，每页 10 篇。标签页按文章数量排列，归档按年份组织。所有页面共用简洁导航、RSS 链接与自适应布局。

## 验证

```bash
pnpm check
pnpm test:content
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Linux CI 首次运行浏览器测试时使用 `pnpm exec playwright install --with-deps chromium` 安装系统依赖。

- `check`：Astro 与 TypeScript 检查。
- `test:content`：草稿过滤、排序、标签统计、分页、链接编码、日期与阅读时长测试。
- `build`：生成 HTML、RSS、站点地图及搜索索引；检查站内链接、生产草稿隔离和基础元数据。
- `test:e2e`：启动独立的生产预览，检查真实中文搜索、导航、目录、代码复制、404、无 JavaScript 阅读，以及 320–1440px 布局。

搜索只索引已发布文章，首次检索时才加载索引。生产搜索验证必须针对 `dist/` 的预览执行。空关键词不查询；无结果和加载失败都有明确提示。

## 部署到 GitHub Pages

1. 使用对 **lijianpo** 账号有权限的 GitHub 认证，准备公开仓库 `lijianpo/lijianpo.github.io`。如果远端已有内容，先读取并合并，避免覆盖现有历史。
2. 将当前项目提交并推送到该仓库的 `main` 分支。已有 `origin` 时无需重复添加。
3. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 在 **Actions** 中确认 `Deploy blog to GitHub Pages` 成功完成；必要时使用 **Run workflow** 重新触发。
5. 访问 `https://lijianpo.github.io/`，检查欢迎文章、搜索、RSS 和文章深层链接。

用户站点使用根路径 `/`；不要把 `base` 设置成 `/lijianpo.github.io`。`site` 固定为正式网址，用于 canonical、RSS、分享元数据和站点地图。部署只上传静态 `dist/`，不需要常驻 Node 服务。

工作流在 PR 和 `main` 推送时执行检查、内容测试、构建与浏览器测试；只有 `main` 推送或手动运行会部署。发布权限仅授予部署任务，PR 不发布网站。工作流以任何验证失败为停止条件，之前成功的线上版本不受失败构建影响。

排查顺序：先查看 Actions 中失败的步骤，再检查 Pages 发布来源及目标仓库权限。若网址仍是 GitHub 默认 404，不代表本地构建失败，也不能视为部署完成。

当前环境需要补齐 `lijianpo/lijianpo.github.io` 的访问权限后才能推送并核验线上发布；仓库中包含完整发布配置，本地实现不等于线上已部署。

参考：[Astro 的 GitHub Pages 部署指南](https://docs.astro.build/en/guides/deploy/github/)、[Pagefind 中文搜索](https://pagefind.app/docs/multilingual/)。
