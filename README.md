# dsh-agnes-image

**DeepSeek Harness 生图插件** —— 文生图 / 图生图 / 多图合成，基于 **Agnes AI**（`agnes-image-2.5-flash`）。零依赖，纯 JavaScript，无需构建。

**DSH image generation plugin for DeepSeek Harness** — text-to-image, image-to-image, and multi-image composition via **Agnes AI**. Zero dependencies, plain JavaScript, no build step.

关键词 / Keywords：`dsh` `dsh-plugin` `deepseek-harness` `生图` `文生图` `图生图` `图片生成` `图片编辑` `Agnes` `agnes-image-2.5-flash` `image-generation` `text-to-image` `image-to-image`

![一只正在画布前作画的鹈鹕，由本插件调用 agnes-image-2.5-flash 生成（1K / 16:9）](docs/preview.jpg)

> 非官方社区插件，与 DeepSeek、Agnes AI 均无隶属关系。MIT 许可，无担保。
> Unofficial community plugin, not affiliated with DeepSeek or Agnes AI. MIT, no warranty.

---

## 它做什么

给 DeepSeek Harness 加一个画图工具 `agnes_generate_image`。你说「画一张 XXX」「把这张图改成 XXX」，模型就会调用它，然后：

1. **立刻下载并保存**到你的会话工作区（不是留一个会过期的链接）
2. **显示在对话里**（不是只给你一个文件路径）
3. **按日期分文件夹**存放，不会堆成一团

```
D:\你的项目\generated-images\2026-10-10\a-cheerful-pelican-on-a-bicycle-120933.png
```

> **English summary** — Adds one Host tool, `agnes_generate_image`, that turns a prompt into
> an image (text-to-image), restyles an existing image (image-to-image), or composes several
> references into one scene. The result is downloaded immediately into the session workspace
> and shown inline in the conversation. A dependency-free DSH **bundle**: no runtime
> dependencies, no build step, nothing to compile — you supply your own Agnes API key.
> Install with `dsh plugin --profile <name> add github:<you>/dsh-agnes-image`.

> **范围** — 一个工具，覆盖文生图 / 图生图 / 多图合成；**没有**图库、画布、批量队列。
> 视频请用 Agnes 的 `agnes-video-2.5`（本插件不涉及）。
>
> **Scope** — One tool covering text-to-image, image-to-image and multi-image composition.
> No gallery, no canvas, no batch queue. Video is out of scope.

---

## 安装

### 前置条件

1. **DeepSeek Harness** —— 已经有就跳过
   - 桌面版：[deepseek.com/harness](https://www.deepseek.com/harness/) 下载安装包（Windows / macOS），自带运行时
   - 命令行版：装 [Node.js](https://nodejs.org/)（`^22.19.0` 或 `>= 24`）后 `npx @deepseek-ai/dsh web`
2. **Agnes API Key** —— 见下方「获取与配置 API Key」。Agnes 的图像模型当前免费。

### 方式一：命令行

```sh
# 从 npm 安装（发布到 npm 之后）
dsh plugin --profile web add dsh-agnes-image

# 从 GitHub 源码安装
dsh plugin --profile web add github:YOUR_GITHUB_NAME/dsh-agnes-image

# 从本地仓库目录安装（开发时最方便）
dsh plugin --profile web add D:\path\to\dsh-agnes-image

# 从 tarball 安装
dsh plugin --profile web add D:\path\to\dsh-agnes-image-0.1.0.tgz
```

`<profile>` 通常是 `web`（命令行版）或 `desktop`（桌面版），不确定就用 `list` 查：

```sh
dsh plugin --profile web list
dsh plugin --profile web remove dsh-agnes-image   # 卸载
```

装完**重启 Harness**（桌面版要右键托盘图标 → 退出，点窗口 X 只是最小化）。

> ### 为什么从 GitHub 装这个插件不需要「构建授权」？
>
> pnpm ≥10 默认拒绝执行 git 依赖的构建脚本（`prepare` / `postinstall` 等），所以**有构建步骤的包**
> 从 GitHub 安装第一次会失败，需要你在 profile 的 `pnpm-workspace.yaml` 里写：
>
> ```yaml
> allowBuilds:
>   dsh-agnes-image: true
> ```
>
> **本项目是纯 JavaScript、零依赖、`package.json` 里没有任何安装期脚本**，pnpm 没有脚本要跑，
> 所以**不需要**这项授权。（`npm test` 不是安装期脚本，不受影响。）
>
> ⚠️ 这条结论**只对本项目成立**。装别的插件时如果第一次失败并提示 `allowBuilds`，那是正常流程 ——
> 但请意识到：**那等于允许该插件的代码在你机器上安装期执行**，只对可信来源授权，并尽量钉住 commit
> （`github:you/repo#<sha>`）。

### 方式二：桌面版图形界面

1. 打开 Harness，点左侧边栏的 **「插件」**
2. 点右上角 **「+ 添加插件」**
3. 填入 `dsh-agnes-image`（npm 包名）或本地目录绝对路径
4. 点 **「安装」**，然后**完全退出 Harness 再打开**

> 图形界面在安装前会先查一次包信息，这一步只认 npm 上的包；填 `github:` 地址会在这一步失败。
> 从 GitHub 装请走命令行。

### 装好的标志

重启后，工具列表里出现 `agnes_generate_image`；直接对模型说「画一张……」，它会调用工具，而不是告诉你「我没有画图能力」。

---

## 获取与配置 API Key

### 获取

1. 打开 [agnes-ai.com](https://agnes-ai.com)，注册 / 登录
2. 进入开发者控制台 → **API Key 管理** → 创建 Key
3. 复制那串 `sk-` 开头的**值**

> ⚠️ 要的是 Key 的**值**，不是你在控制台给它起的**名字**。很多平台只在创建时显示一次，看不到就重新创建一个。

### 配置（四级，按优先级）

| 优先级 | 位置 | 适用场景 |
|---|---|---|
| 1 | Loader 行 `config.apiKey` | 单一 profile，最直接 |
| 2 | 环境变量 `AGNES_API_KEY` | 多个 profile 共用 |
| 3 | 密钥文件 `~/.dsh/agnes-image.config.json` | **推荐**：不进版本库、改完即生效、不用重启 |
| 4 | `AGNES_API_KEY_FILE` 指定的自定义路径 | 密钥托管在别处 |

**方式 A：密钥文件（推荐）**

```jsonc
// Windows: C:\Users\<你>\.dsh\agnes-image.config.json
// macOS / Linux: ~/.dsh/agnes-image.config.json
{ "apiKey": "sk-你的Key" }
```

这个文件**每次调用都重新读取**，换 Key 不需要重启 Harness。

**方式 B：环境变量**

```powershell
# Windows（当前用户，永久）
setx AGNES_API_KEY "sk-你的Key"
```

```sh
# macOS / Linux
export AGNES_API_KEY="sk-你的Key"      # 写进 ~/.bashrc / ~/.zshrc 可持久化
```

> 环境变量**只在进程启动时读取一次**，所以 `setx` 之后**必须重启 Harness** 才生效。
> 想免重启，用方式 A 或方式 C。

**方式 C：Loader 行配置**

在你自己 profile 的 `cordis.patch.yml` 里覆盖这一行：

```yaml
- id: agnes-image
  name: dsh-agnes-image
  config:
    apiKey: sk-你的Key
    baseUrl: https://apihub.agnes-ai.com/v1
    model: agnes-image-2.5-flash
    outputDir: generated-images
    timeoutMs: 300000
```

> patch 是**整体替换** `config`，不是深合并 —— 覆盖时要重述所有你仍想保留的键。

**改完怎么验证？** 随便让它画一张。报 `Agnes API key is missing` 就是没读到；报 `401 / 403` 就是读到了但 Key 不对。

---

## 使用

直接跟模型说话，不需要记命令：

> 画一张：夕阳下的海边栈道，一只鹈鹕骑着红色自行车，电影感写实风格，16:9

模型会自己填参数。你也可以明确指定：

| 参数 | 类型 | 说明 | 默认 |
|---|---|---|---|
| `prompt` | string | **（必填）** 画面描述或编辑指令。详细描述远好于堆关键词 | — |
| `model` | enum | `agnes-image-2.5-flash` / `agnes-image-2.1-flash` / `agnes-image-2.0-flash` | `agnes-image-2.5-flash` |
| `size` | string | 档位 `1K`/`2K`/`3K`/`4K`，或显式 `1024x768` 这类 `WxH` | `1K` |
| `ratio` | enum | 与档位搭配的宽高比：`1:1` `3:4` `4:3` `16:9` `9:16` `2:3` `3:2` `21:9` | `1:1` |
| `image` | string[] | 参考图：公网 HTTPS URL、Data URI，或**本地文件路径**（自动内联成 Data URI） | 无 |
| `outputName` | string | 输出文件基名（不含扩展名）。非法字符会被替换，Windows 保留名会被改写 | 提示词 slug + 时间戳 |

### 三种玩法

| 玩法 | 怎么说 | 插件怎么走 |
|---|---|---|
| **文生图** | 「画一张……」「来个……当壁纸」 | 只要 `prompt`（+ 可选 `size`/`ratio`） |
| **图生图** | 「把这张改成雨夜赛博朋克，保留构图」+ 给出图片路径/链接 | `image` 传一张参考图 |
| **多图合成** | 「用这两张合成一张海报：第一张是角色，第二张是产品」 | `image` 传多张，顺序即 prompt 里说的顺序 |

图生图时，把本地文件路径（`D:\shots\a.png`）或公网链接直接给模型即可；本地文件会被读出来内联成 base64（单张上限 12 MB）。

### 尺寸参考（宽高比 × 档位）

| Ratio | 1K | 2K | 3K | 4K |
|---|---|---|---|---|
| `1:1` | 1024x1024 | 2048x2048 | 3072x3072 | 4096x4096 |
| `3:4` | 864x1152 | 1728x2304 | 2592x3456 | 3456x4608 |
| `4:3` | 1152x864 | 2304x1728 | 3456x2592 | 4608x3456 |
| `16:9` | 1312x736 | 2624x1472 | 3936x2208 | 5248x2944 |
| `9:16` | 736x1312 | 1472x2624 | 2208x3936 | 2944x5248 |
| `2:3` | 832x1248 | 1664x2496 | 2496x3744 | 3328x4992 |
| `3:2` | 1248x832 | 2496x1664 | 3744x2496 | 4992x3328 |
| `21:9` | 1568x672 | 3136x1344 | 4704x2016 | 6272x2688 |

> 想要 `1920x1080` / `2560x1440` 这类显示器分辨率，请用 `2K + 16:9`，再在下游裁剪；
> 直接传这两个尺寸会被服务标准化。

### 提示词写法（来自 Agnes 官方建议）

- **文生图**：`[主体] + [场景/环境] + [风格] + [光照] + [构图] + [质量要求]`
- **图生图**：`[改动要求] + [新风格/场景] + [要加/要去掉的元素] + [必须保留的元素]`
- **多图合成**：说明每张参考图的角色、图与图的关系、目标风格与构图

---

## 配置项

在你的 profile（`$DSH_HOME/profiles/<name>/cordis.patch.yml`）里按 id 覆盖：

```yaml
- id: agnes-image
  name: dsh-agnes-image
  config:
    apiKey: ''                                     # 留空则按「四级查找」走
    baseUrl: https://apihub.agnes-ai.com/v1        # API 地址（国内备用：apihub.agnes-ai.cn）
    model: agnes-image-2.5-flash                   # 默认模型
    outputDir: generated-images                    # 输出目录（相对会话工作区，可写绝对路径）
    timeoutMs: 300000                              # 单次请求超时（毫秒）
```

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `apiKey` | string | 无 | Agnes API Key；留空则查环境变量 → 密钥文件 |
| `baseUrl` | string | `https://apihub.agnes-ai.com/v1` | 末尾斜杠会被去掉 |
| `model` | string | `agnes-image-2.5-flash` | 工具调用未指定 `model` 时使用 |
| `outputDir` | string | `generated-images` | 相对会话工作区；写绝对路径则原样使用；实际落在其下的 `<YYYY-MM-DD>/` |
| `timeoutMs` | number | `300000` | Agnes 官方建议 60s–360s |

未知字段会被**拒绝**（而不是静默忽略），避免拼错配置项却毫无提示。

---

## 出问题了？按这张表自查

先走这三步，大部分问题到这就解决了：

1. **完全退出 Harness 再打开**（桌面版要右键托盘 → 退出，点窗口 X 只是最小化）
2. **确认 Key 读到了**：在 Harness 里问「帮我看一下 `~/.dsh/agnes-image.config.json` 里有没有 apiKey」
3. **确认网络通**：`curl https://apihub.agnes-ai.com/v1/models -H "Authorization: Bearer sk-..."`

### 症状对照表

| 你看到的 | 原因 | 怎么修 |
|---|---|---|
| 工具列表里没有 `agnes_generate_image` | 插件没装好 / 没重启 | 重装后**完全退出** Harness |
| 装的时候报网络错误、一直转圈 | 连不上 npm 或 GitHub | 换网络，或改用本地目录 / tarball 安装 |
| 报「已存在」/ 加载冲突 | `node_modules` 有残留 | 先 `remove`、重启，再装 |
| 报 `Agnes API key is missing` | 四处都没找到 Key | 见「配置」一节；写密钥文件最省事 |
| 报 `401` / `403` | Key 值不对（多半填了 Key 的名字） | 重新复制 `sk-` 开头的值 |
| 报 `404` | 模型名不认识 | 换 `agnes-image-2.5-flash` / `2.1-flash` / `2.0-flash` |
| 报 `429` | 请求太频繁 | 等一会儿再试，或降低调用频率 |
| 报 `Invalid size` / `Invalid ratio` | 参数不合法 | 用档位 `1K`–`4K` 或 `WxH`；宽高比取表格里的 8 个值之一 |
| 报 `Cannot read the reference image` | 本地路径写错 / 文件不存在 | 用绝对路径，或改成公网 URL |
| 报 `Reference image ... MB; the limit is 12 MB` | 参考图太大 | 先压缩，或改用公网 URL |
| 报 `non-JSON body` | 网关 / 代理返回了 HTML | 检查网络、代理、`baseUrl` |
| 图存到了奇怪的地方 | `outputDir` 配置 | 默认是**会话工作区**；`process.cwd()` 只在拿不到工作区信息时兜底 |
| 生成很慢（30 秒以上） | **正常** | 实测绝大部分时间花在 API 生成。想快用 `1K` |

---

## 设计说明

这些是实现上的取舍，供二次开发参考：

**零依赖。** 只 import Node 内置模块，不依赖任何 `@deepseek-ai/*` 包。发布版 dsh 把 zod 等依赖藏在带哈希的 pnpm 路径下，从已安装的 bundle 里解析不到；自己实现 Standard Schema 契约比赌一个解析路径更稳。

**`response_format` 必须放进 `extra_body`。** Agnes 拒绝请求体顶层的 `response_format`，参考图也必须走 `extra_body.image`。插件统一在 `extra_body` 里构造这些字段，测试里有一条断言专门盯着这点。

**图片立刻转存。** 生成结果是带签名的对象存储链接，不保证长期有效。插件拿到响应后立即下载并写入工作区，返回的本地路径永久有效，同时把字节注册进会话附件，让图片能直接在对话里内联显示。

**输出到会话工作区，不是进程目录。** Host 进程的工作目录是启动器所在目录，不是你的项目目录。插件通过 `workspaceRegistry` 找到会话对应的工作区，取不到时才回退到进程目录。

**只有档位尺寸才搭配 `ratio`。** `1024x768` 这类显式尺寸已经固定了形状，再发 `ratio` 会让服务端意图变得含混，所以插件在 `WxH` 模式下不发 `ratio`。

**本地参考图内联成 Data URI 有上限。** 超过 12 MB 直接报错并给出理由，避免把一个几十 MB 的 base64 塞进单次 HTTP 请求。

**Windows 保留名处理。** `CON`、`PRN`、`NUL`、`LPT1` 等是 Windows 保留设备名，无法作为文件名（无论什么扩展名）。插件会自动改写成 `CON-image.png` 这样的安全形式。

**目录按日期分层。** `generated-images/2026-10-10/`，文件名带秒级时间戳，连续生成不会互相覆盖。

**Key 每次调用重新读。** 密钥文件与行配置都在调用时解析，换 Key 不必重启 Harness。

---

## 开发

```sh
# 测试（完全离线，用假 fetch，不需要 API Key）
node --test

# 语法检查
node --check index.js
```

**本地 live 调试**（改完即生效，不用重启 Harness）：在 profile 的 `cordis.patch.yml` 末尾追一行 ——

```yaml
- insert:
    - id: agnes-image
      name: dsh-agnes-image
      config:
        model: agnes-image-2.5-flash
```

前提是该 profile 的 `dsh.profile.patchReload` 为 `live`，且**不能**同时用 `dsh plugin add` 装一遍（重复插入会注册两个同名工具）。

仓库结构：

```
dsh-agnes-image/
├── index.js             # 插件本体：一个 Host 工具 + Config 契约
├── cordis.patch.yml     # bundle 层：把插件行插进 Loader
├── package.json         # dsh.bundle.patch / meta / icon
├── icon.svg             # 插件管理器卡片图标（≤ 256 KiB）
├── locale/{zh,en}.json  # 插件卡片标题与描述
├── test/                # node:test，离线运行
├── CHANGELOG.md
└── CONTRIBUTING.md
```

## 发布前检查清单（作者用）

本仓库留了若干占位符，发到 GitHub 之前请替换：

- [ ] `package.json`：`author`、`repository.url`、`homepage`、`bugs.url` 里的 `YOUR_GITHUB_NAME`
- [ ] `LICENSE`：`Copyright (c) 2026 YOUR_NAME`
- [ ] `CHANGELOG.md`：底部两条 compare / tag 链接里的 `YOUR_GITHUB_NAME`
- [ ] `README.md` / `README.en.md`：安装命令里的 `YOUR_GITHUB_NAME`
- [ ] 确认 `.gitignore` 生效：`generated-images/`、`node_modules/` 不该进版本库
- [ ] 确认 API Key 没有出现在任何被提交的文件里（它只应存在于 `~/.dsh/agnes-image.config.json`）

## 许可证

[MIT](./LICENSE)

## 相关链接

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [插件打包与安装（官方教程）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)
- [Agnes AI 文档](https://wiki.agnes-ai.com/zh-Hans/docs/overview)
- [Agnes Image 2.5 Flash](https://wiki.agnes-ai.com/zh-Hans/docs/agnes-image-25-flash)
