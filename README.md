# lijianpo · 技术、记录与思考

一个采用 Google Blog 视觉风格的中文个人博客：白底、蓝色主色、四色点缀，支持左图右文列表与圆角图文卡片切换。Astro 生成静态 HTML，Markdown 管理文章，Pagefind 提供中文全文搜索，GitHub Actions 自动部署到 GitHub Pages。

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

日常发文流程：**放入 Markdown 文件 → 构建 → 刷新预览**。

### 1. 新建 Markdown 文件

把 `.md` 文件直接放在项目的 `src/content/posts/` 目录下。文件名使用英文小写字母、数字和短横线，例如 `my-first-note.md`；文章地址为 `/posts/my-first-note/`。发布后保持文件名不变，以保留已有链接。

复制下面的模板到 `src/content/posts/my-first-note.md`，修改标题、摘要、日期和正文。文件开头两个 `---` 分隔符之间是文章信息，后面是 Markdown 正文：

```markdown
---
title: '我的第一篇记录'
description: '一句简短的摘要，用于文章列表、搜索结果和分享。'
pubDate: 2026-10-03
tags: ['技术', '随笔']
draft: false
---

这里是文章的开头。

## 一个小标题

从一个具体的问题开始。
```

| 字段 | 说明 |
| --- | --- |
| `title` | 必填，文章标题 |
| `description` | 必填，文章摘要 |
| `cover` | 可选，`/images/` 开头的本地封面图片路径 |
| `pubDate` | 必填，`YYYY-MM-DD` 格式的发布日期 |
| `updatedDate` | 可选，最后更新日期 |
| `tags` | 可选，标签数组，默认空数组 |
| `draft` | 可选，是否为草稿，默认 `false` |

上面的模板使用 `draft: false`，构建后即可展示。尚未写完时可设置 `draft: true`，仅在开发模式中预览；准备展示时再改回 `false`。`pubDate` 用于排序和展示，不是定时发布开关。日期统一按 `Asia/Taipei` 显示。

正文从二级标题 `##` 开始，二、三级标题自动进入目录。代码块注明语言后自动高亮。图片放入 `public/images/`，例如 `![图片说明](/images/example.png)`。完整排版示例见 `src/content/posts/markdown-example.md`。

**草稿只从网站产物中排除。此仓库公开，Markdown 草稿源文件仍然公开，请勿提交私密内容。**

### 2. 构建并查看文章

保存文件后，在项目根目录（包含 `package.json` 的目录）执行：

```bash
pnpm build
```

构建成功后，刷新已运行的预览页面，就能在文章列表、归档和搜索中找到新文章，也可以直接访问 `/posts/my-first-note/`。

如果预览服务尚未启动，再运行：

```bash
pnpm preview
```

打开 `http://localhost:4321/` 查看。后续新增、修改或删除文章，重新执行 `pnpm build`，再刷新预览即可。如果 4321 端口已被开发服务占用，可以用 `pnpm preview --port 4322`，并访问 `http://localhost:4322/`。

使用 `pnpm dev` 开发模式时，保存 Markdown 文件会自动更新页面。全文搜索索引在构建时生成，验证搜索请使用 `pnpm build` 后的生产预览。

### 3. 发布到 GitHub Pages

线上站点需先完成下方的[部署配置](#部署到-github-pages)。将文章文件和使用的图片提交并推送到远端 `master` 分支，等待 GitHub Actions 的 `Deploy blog to GitHub Pages` 工作流成功完成，再访问线上文章地址确认发布结果。

### 设置文章封面

把封面放在 `public/images/` 下，在文章顶部的元数据中添加对应路径，例如：

```yaml
cover: '/images/covers/test-small-script.svg'
```

封面用于首页、分页和标签页的文章缩略图，两种视图使用同一张图片。建议使用 3:2 的图片（例如 720 × 480），其他比例会居中裁切。支持 SVG、PNG、JPEG、WebP 等浏览器支持的图片格式；此字段使用本地文件，不填写外部网址。构建检查会发现不存在的本地图片。

没有设置 `cover` 的文章继续使用默认插画；启用 JavaScript 时，封面加载失败也会回退到插画。首篇封面优先加载，其余延迟加载。可参考“小脚本”和“慢慢读”两篇测试文章的配置。

## 修改个人信息与样式

- `src/site.config.ts`：站名、副标题、简介、作者、GitHub 地址及每页文章数量。
- `src/pages/about.astro`：关于页正文。
- `src/styles/global.css`：颜色、字体、布局与响应式样式。
- `src/components/PostArtwork.astro`：文章卡片的本地 SVG 插画，无需外部图片服务。
- `astro.config.mjs`：正式网站地址与静态构建配置。
- `public/social-card.svg`：分享图源文件。修改后运行 `pnpm exec playwright install chromium` 和 `node scripts/generate-social-card.mjs` 更新 PNG。

首页及后续分页默认显示左图右文列表，每页 10 篇；手机端同样保持图片在左侧。文章工具栏提供“列表 / 卡片”切换，卡片模式以左右分栏大卡片展示最新一篇，其余文章排列为图文网格，窄屏下自动调整列数。

视图选择通过浏览器本地存储保存，刷新、翻页和返回首页后恢复。存储不可用时仍可在当前页面切换；禁用 JavaScript 时显示默认列表并隐藏切换按钮。标签页保持图文卡片，归档按年份组织。所有页面共用导航、RSS 链接与自适应布局。

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
- `test:e2e`：启动独立的生产预览，检查视图切换与偏好恢复、封面与失败回退、真实中文搜索、导航、目录、代码复制、404、无 JavaScript 阅读，以及 320–1440px 两种布局。

搜索只索引已发布文章，首次检索时才加载索引。生产搜索验证必须针对 `dist/` 的预览执行。空关键词不查询；无结果和加载失败都有明确提示。

## 部署到 GitHub Pages

1. 使用对 **lijianpo** 账号有权限的 GitHub 认证，准备公开仓库 `lijianpo/lijianpo.github.io`。如果远端已有内容，先读取并合并，避免覆盖现有历史。
2. 将当前项目提交并推送到该仓库的 `master` 分支。已有 `origin` 时无需重复添加。
3. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 在 **Actions** 中确认 `Deploy blog to GitHub Pages` 成功完成；必要时使用 **Run workflow** 重新触发。
5. 访问 `https://lijianpo.github.io/`，检查欢迎文章、搜索、RSS 和文章深层链接。

用户站点使用根路径 `/`；不要把 `base` 设置成 `/lijianpo.github.io`。`site` 固定为正式网址，用于 canonical、RSS、分享元数据和站点地图。部署只上传静态 `dist/`，不需要常驻 Node 服务。

工作流在 PR 和 `master` 推送时执行检查、内容测试、构建与浏览器测试；只有 `master` 推送或手动运行会部署。发布权限仅授予部署任务，PR 不发布网站。工作流以任何验证失败为停止条件，之前成功的线上版本不受失败构建影响。

排查顺序：先查看 Actions 中失败的步骤，再检查 Pages 发布来源及目标仓库权限。若网址仍是 GitHub 默认 404，不代表本地构建失败，也不能视为部署完成。

当前环境需要补齐 `lijianpo/lijianpo.github.io` 的访问权限后才能推送并核验线上发布；仓库中包含完整发布配置，本地实现不等于线上已部署。

参考：[Astro 的 GitHub Pages 部署指南](https://docs.astro.build/en/guides/deploy/github/)、[Pagefind 中文搜索](https://pagefind.app/docs/multilingual/)。
