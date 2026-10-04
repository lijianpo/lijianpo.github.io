# lijianpo · 技术、记录与思考

一个采用 Google Blog 视觉风格的中文个人博客：白底、蓝色主色、四色点缀，支持左图右文列表与圆角图文卡片切换。Astro 生成静态 HTML，Markdown 管理文章，Pagefind 提供中文全文搜索，GitHub Actions 自动部署到 GitHub Pages。

正式地址：**https://lijianpo.com**（`lijianpo.github.io` 跳转到此域名）

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
pnpm check:content
pnpm test:content
pnpm build
pnpm preview
```

`pnpm preview` 默认为 `http://localhost:4321`，可加 `--port 4322` 更换端口。正式预览与 GitHub Pages 一样不包含草稿。

## 写一篇文章

日常发文流程：**放入 Markdown 文件 → 构建 → 刷新预览**。

### 1. 新建 Markdown 文件

把 `.md` 文件直接放在项目的 `src/content/posts/` 目录下。文件名使用英文小写字母、数字和短横线，例如 `my-first-note.md`；文章地址为 `/posts/my-first-note/`。发布后保持文件名不变，以保留已有链接。

也可以用命令创建草稿，日期自动按 `Asia/Taipei` 填写，已有文件不会被覆盖：

```bash
pnpm new:post my-first-note --title "我的第一篇记录"
pnpm check:content
```

命令生成的文件默认 `draft: true`。修改摘要与正文后，再把 `draft` 改为 `false`。`pnpm check:content` 会检查文件名、元数据和本地图片；已发布文章缺图或图片损坏会报错，草稿缺图只提示，便于边写边补图。`pnpm build` 也会先执行同样的内容检查。

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

正文从二级标题 `##` 开始，二、三级标题自动进入目录。代码块注明语言后自动高亮。图片放入 `public/images/`，例如 `![图片说明](/images/example.png)`，完整图文模板见下方的[编写带图片的文章](#编写带图片的文章)。其他排版示例见 `src/content/posts/markdown-example.md`。

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

### 编写带图片的文章

图片放在 `public/images/`，文章中用 `/images/...` 引用。可以按文章名称建立图片文件夹，方便管理同一篇文章的封面和正文配图。

例如，新建 `src/content/posts/weekend-walk.md`，并把自己的两张图片分别保存为以下文件。示例图片需要自行准备，仓库没有预置：

```text
src/content/posts/weekend-walk.md
public/images/weekend-walk/cover.jpg
public/images/weekend-walk/park.jpg
```

将下面的完整模板复制到 `weekend-walk.md`，再修改文章信息和正文：

```markdown
---
title: '周末散步'
description: '用文字和照片记录一次周末散步。'
pubDate: 2026-10-03
tags: ['生活', '摄影']
cover: '/images/weekend-walk/cover.jpg'
draft: false
---

周末去附近的公园走了走，记录几张照片。

## 出发

![清晨的街道](/images/weekend-walk/cover.jpg)

街道很安静，阳光刚好照到路边。

## 公园里的风景

![阳光下的公园步道](/images/weekend-walk/park.jpg)

*图：沿着这条步道，可以一直走到湖边。*

这里继续写正文……
```

- **正文图片**：使用 `![图片说明](/images/文件夹/图片.jpg)`。方括号中是替代文字，供屏幕阅读器读取或在图片加载失败时显示；需要可见图注时，可以像示例一样在图片下方另写一段文字。
- **文章封面**：顶部的 `cover` 用于文章列表缩略图，可省略。封面不会自动插入正文；正文要显示同一张图片时，再写一次图片语法即可。更多尺寸和格式说明见[设置文章封面](#设置文章封面)。
- **路径对应**：文件 `public/images/weekend-walk/park.jpg` 对应引用路径 `/images/weekend-walk/park.jpg`，引用中省略 `public`。文件名、大小写和扩展名都要与实际图片一致。
- **图片格式**：正文可使用 JPG、PNG、WebP、SVG 等浏览器支持的格式。文件名建议使用英文小写字母、数字和短横线，例如 `park-view.webp`。

本地可以运行 `pnpm dev` 检查正文图片和文章列表封面。发布时，把 **Markdown 和使用的图片一起提交并推送到 `master`**，等待 `Deploy blog to GitHub Pages` 工作流成功，再打开 `/posts/weekend-walk/` 检查线上图片。仅在本地保存文件不会更新线上站点。

### 设置文章封面

把封面放在 `public/images/` 下，在文章顶部的元数据中添加对应路径，例如：

```yaml
cover: '/images/covers/test-small-script.svg'
```

封面用于首页、分页和标签页的文章缩略图，两种视图使用同一张图片。建议使用 3:2 的图片（例如 720 × 480），其他比例会居中裁切。支持 SVG、PNG、JPEG、WebP 等浏览器支持的图片格式；此字段使用本地文件，不填写外部网址。构建检查会发现不存在的本地图片。

没有设置 `cover` 的文章继续使用默认插画；启用 JavaScript 时，封面加载失败也会回退到插画。首篇封面优先加载，其余延迟加载。可参考“小脚本”和“慢慢读”两篇测试文章的配置。

### 图片处理与分享图

封面和正文仍使用 `public/images/` 与 `/images/...`，不需要修改 Markdown 写法。构建时自动生成宽度为 320、640、960、1280、1600 的 WebP，超出原图宽度的版本不会生成，小图不会放大；保留原图作为浏览器回退。SVG 和多帧动画保留原格式。正文图片自动补齐尺寸，首张优先加载，其余延迟加载，减少加载时的页面跳动。列表与卡片会根据实际显示宽度选择图片。

生成资源使用内容哈希文件名，缓存在被 Git 忽略的 `.cache/blog-assets/`。替换原图后，即使 Markdown 没有变化，也会刷新尺寸与资源地址；开发模式会自动重新渲染文章并更新页面。生产构建仅复制当前已发布文章引用的生成资源。`public/` 中的原文件仍会原样发布，因此不要把私密图片放在这里。

每篇已发布文章会自动生成 1200 × 630 PNG 分享图，包含文章标题、日期、站名和域名；首页等页面使用默认站点分享图，兼容地址为 `/social-card.png`。标题、站点信息或模板变化后会自动更新，无需手动截图。生成器位于 `src/lib/social-images.ts`，使用仓库内的 Noto Sans CJK SC 字体和 Sharp，不依赖构建机器的中文字体或浏览器。字体仅供构建使用，不会发送给读者；授权见 `assets/fonts/LICENSE`。

## 修改个人信息与样式

- `src/site.config.ts`：正式域名 `url`、站名、副标题、简介、作者、GitHub 地址及每页文章数量。canonical、RSS、分享元数据、站点地图和检查脚本统一读取这里。
- `src/pages/about.astro`：关于页正文。
- `src/styles/global.css`：统一声明样式层和导入；`base.css` 管理变量及公共样式，`shell.css` 管理导航页脚，`posts.css` 管理列表卡片，`article.css` 管理正文目录，`pages.css` 管理其他页面，各模块保留自己的响应式规则。
- `src/components/PostArtwork.astro`：文章卡片的本地 SVG 插画，无需外部图片服务。
- `astro.config.mjs`：静态构建配置，从 `site.config.ts` 读取域名。
- `src/integrations/blog-assets.ts`：Markdown 图片处理、开发资源刷新与生产资源输出。
- `src/lib/image-loader.ts`：把图片变化纳入文章缓存，并触发开发预览更新。

首页及后续分页默认显示左图右文列表，每页 10 篇；手机端同样保持图片在左侧。文章工具栏提供“列表 / 卡片”切换，卡片模式以左右分栏大卡片展示最新一篇，其余文章排列为图文网格，窄屏下自动调整列数。

视图选择通过浏览器本地存储保存，刷新、翻页和返回首页后恢复。存储不可用时仍可在当前页面切换；禁用 JavaScript 时显示默认列表并隐藏切换按钮。标签页保持图文卡片，归档按年份组织。所有页面共用导航、RSS 链接与自适应布局。

文章页采用紧凑标题区，正文最大宽度 740px；在 1120px 及以上宽屏中，目录固定在正文右侧并跟随滚动。窄屏目录默认折叠，禁用 JavaScript 时仍能手动展开和跳转。

## 验证

```bash
pnpm check
pnpm check:content
pnpm test:content
pnpm test:assets
pnpm build
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

Linux CI 首次运行浏览器测试时使用 `pnpm exec playwright install --with-deps chromium webkit` 安装系统依赖。

- `check`：Astro 与 TypeScript 检查。
- `check:content`：独立校验文章元数据、文件名和本地图片。
- `test:content`：草稿过滤、排序、标签统计、分页、链接编码、日期、阅读时长和新建草稿测试。
- `test:assets`：图片尺寸、方向、动画、缓存更新、中文分享图和生成资源隔离测试；使用临时项目验证换图重建、开发预览更新和空站点构建。
- `build`：生成 HTML、RSS、站点地图、图片及搜索索引；检查站内链接、图片尺寸、生产草稿隔离，以及各页面的域名和分享元数据。
- `test:e2e`：启动独立生产预览，运行 Chromium 桌面与 iPhone WebKit 回归。覆盖视图切换、封面回退、中文搜索、目录、复制和拒绝剪贴板后的回退、404、无 JavaScript 阅读、320–1440px 布局、正文首屏位置与图片加载稳定性。
- `test:live`：访问正式站点，在最多两分钟内重试并验证构建版本、文章、真实搜索结果、RSS、地图、robots 与分享图，任何一项失败均以非零状态退出。

发布后可手动验证；指定提交号时会拒绝把旧版本判定为成功：

```bash
EXPECT_COMMIT="完整提交号" pnpm test:live
```

也可以在已启动的生产预览上验证脚本。`SITE_BASE_URL` 只更换请求目标，元数据仍应指向正式域名：

```bash
SITE_BASE_URL=http://127.0.0.1:4321 pnpm test:live
```

搜索只索引已发布文章，首次检索时才加载索引。生产搜索验证必须针对 `dist/` 的预览执行。空关键词不查询；无结果和加载失败都有明确提示。

## 部署到 GitHub Pages

1. 使用对 **lijianpo** 账号有权限的 GitHub 认证，准备公开仓库 `lijianpo/lijianpo.github.io`。如果远端已有内容，先读取并合并，避免覆盖现有历史。
2. 将当前项目提交并推送到该仓库的 `master` 分支。已有 `origin` 时无需重复添加。
3. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 在 **Settings → Pages → Custom domain** 设置 `lijianpo.com`，并启用 HTTPS。使用 Actions 发布时，自定义域名以 Pages 设置为准。
5. 在 **Actions** 中确认 `Deploy blog to GitHub Pages` 的 `build`、`deploy` 和 `verify-live` 均成功；最后一步会核对线上 `/build-info.json` 的提交号，避免旧版仍能访问造成误判。
6. 访问 `https://lijianpo.com/`，检查文章、搜索、RSS 和文章深层链接。

用户站点使用根路径 `/`；不要把 `base` 设置成 `/lijianpo.github.io`。正式地址统一配置在 `src/site.config.ts` 的 `url`。换域名时还需同步 Pages 自定义域名设置和仓库的 `CNAME` 记录。部署只上传静态 `dist/`，不需要常驻 Node 服务。

工作流在 PR 和 `master` 推送时执行检查、内容和资源测试、构建与浏览器测试；只有 `master` 推送或手动运行会部署。发布权限仅授予部署任务，PR 不发布网站。构建或浏览器测试失败会阻止发布；发布后的 `verify-live` 失败会标记工作流失败，需检查实际线上版本，不会自动回滚。

排查顺序：先查看 Actions 中失败的步骤，再检查 Pages 发布来源及目标仓库权限。若网址仍是 GitHub 默认 404，不代表本地构建失败，也不能视为部署完成。

本地构建和预览用于确认代码可运行；只有目标提交完成部署且 `verify-live` 通过，才能确认该版本已在线上生效。

参考：[Astro 的 GitHub Pages 部署指南](https://docs.astro.build/en/guides/deploy/github/)、[Pagefind 中文搜索](https://pagefind.app/docs/multilingual/)。
