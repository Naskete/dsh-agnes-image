# dsh-agnes-image

**给 DeepSeek Harness 装一个会画图的大脑：说一句话，出图。**
文生图 / 图生图 / 多图合成，基于 **Agnes AI**（`agnes-image-2.5-flash`）。零依赖，纯 JavaScript，无需构建。

**Image generation for DeepSeek Harness** — text-to-image, image-to-image and multi-image
composition via **Agnes AI**. Zero dependencies, no build step.

关键词 / Keywords：`dsh` `dsh-plugin` `deepseek-harness` `生图` `文生图` `图生图` `图片生成` `图片编辑` `Agnes` `agnes-image-2.5-flash` `image-generation` `text-to-image` `image-to-image`

![一只正在画布前作画的鹈鹕，由本插件调用 agnes-image-2.5-flash 生成（1K / 16:9）](docs/preview.jpg)

> 非官方社区插件，与 DeepSeek、Agnes AI 均无隶属关系。MIT 许可，无担保。
> Unofficial community plugin, not affiliated with DeepSeek or Agnes AI. MIT, no warranty.

---

## 30 秒看懂

| 你想干什么 | 你就这么说（不用记命令） |
|---|---|
| 凭空画一张 | 「画一张夕阳下的海，电影感，16:9」 |
| 改一张现有的图 | 「把 `D:\shots\cat.png` 改成赛博朋克夜景，保留构图」 |
| 用好几张图合成一张 | 「用这两张做海报：第一张是角色，第二张是产品」 |

模型会自动调用本插件的工具 `agnes_generate_image`，把图存到你的工作目录，并**直接显示在对话里**。

```
你的项目\
└── generated-images\
    └── 2026-10-10\                      ← 按日期分文件夹，不会堆成一坨
        ├── a-cheerful-pelican-120933.png
        └── a-cheerful-pelican-120945.png   ← 一秒内连画两张也不会互相覆盖
```

---

## 这是什么？（完全没接触过也能看懂）

三个名词，一句话一个：

| 名词 | 说人话 |
|---|---|
| **DeepSeek Harness（DSH）** | 你正在用的这个 AI 助手客户端。它有「手」——能读写文件、跑命令——但**出厂时不带画图能力** |
| **插件（plugin）** | 给 DSH 装的一个小零件，装完它就多一项本事。本插件加的是一把「画笔」 |
| **Agnes AI** | 一家提供 AI 画图接口的服务商（类似「云端画师」）。你把描述发给它，它把图发回来。图像模型目前免费 |

流程就是这样：

```
你说话  →  DSH 里的模型理解意图  →  调用本插件的工具
        →  插件把描述发给 Agnes  →  拿回图片  →  存到本地 + 显示在对话里
```

**它能做什么**：文生图、图生图（改风格/换背景/局部改）、多图合成。
**它不能做什么**：视频、图库管理、批量队列、在线编辑器。

---

## 手把手安装（照着做，10 分钟）

### 准备清单

- [ ] 一个能正常对话的 DeepSeek Harness（桌面版或命令行版都行）
- [ ] 一个 Agnes AI 账号（注册免费）
- [ ] 大约 10 分钟

---

### 第 1 步：确认 Harness 能用

先随便跟它说句话，能正常回复就跳过这一步。

**没有 Harness？**

- 桌面版：去 [deepseek.com/harness](https://www.deepseek.com/harness/) 下载安装包（Windows / macOS），自带运行环境，不用预装任何东西
- 命令行版：先装 [Node.js](https://nodejs.org/)（要求 `^22.19.0` 或 `>= 24`），然后在终端跑 `npx @deepseek-ai/dsh web`

> 两个版本可以共存、共用会话记录，但**插件要各自安装一次**。

---

### 第 2 步：申请 Agnes API Key（就是一把钥匙）

1. 打开 [agnes-ai.com](https://agnes-ai.com)，注册 / 登录
2. 进入**开发者控制台**
3. 找到 **API Key 管理**，点「创建」
4. 复制那串 **`sk-` 开头的长字符串**

⚠️ **两个最常见的新手错误**：

- ❌ 复制的是你给 Key 起的**名字**（比如 `my-image-key`）→ ✅ 要的是创建时那串 `sk-...` 的**值**
- ❌ 关掉弹窗才想起来没复制 → ✅ 大多数平台只显示一次，看不到就**重新创建一个**

把它先粘贴到记事本里，第 4 步要用。

---

### 第 3 步：安装插件

#### 方式 A：命令行（推荐，最不容易踩坑）

打开终端（Windows 用 PowerShell），执行**其中一条**：

```sh
# 从 GitHub 装（本项目发布后）
dsh plugin --profile web add github:Naskete/dsh-agnes-image

# 从本地目录装（自己 clone 下来或者别人给你的文件夹）
dsh plugin --profile web add D:\path\to\dsh-agnes-image

# 从压缩包装（Release 里下载的 .tgz）
dsh plugin --profile web add D:\path\to\dsh-agnes-image-0.1.0.tgz
```

`--profile` 后面填哪个？桌面版通常是 `desktop`，命令行版通常是 `web`。不确定就跑这条看：

```sh
dsh plugin --profile web list
```

✅ **成功的标志**：命令跑完没有报错，`list` 里能看到 `dsh-agnes-image`。

#### 方式 B：图形界面

1. 打开 Harness → 左侧边栏 **「插件」**
2. 右上角 **「+ 添加插件」**
3. 输入框里填 `dsh-agnes-image`（npm 包名），或本地文件夹的**绝对路径**
4. 点「安装」，等进度跑完

> 界面在安装前会先联网查一次包信息，这一步**只认 npm 上的包**。
> 填 `github:...` 地址会卡在这里 —— 那种情况请走方式 A。

#### 装完还想卸载？

```sh
dsh plugin --profile web remove dsh-agnes-image
```

---

### 第 4 步：把 Key 填进去（三选一）

**方式 ①：写进密钥文件（最推荐 —— 不用重启、不会误传上网）**

新建文件（Windows：`C:\Users\<你的用户名>\.dsh\agnes-image.config.json`，macOS / Linux：`~/.dsh/agnes-image.config.json`），内容就一行：

```json
{ "apiKey": "sk-你的Key" }
```

> 这个文件插件**每次调用都会重新读**，所以换 Key 不需要重启 Harness。
> 它不在插件仓库里，也不会被提交到 git（仓库的 `.gitignore` 已排除）。

**方式 ②：环境变量（适合多个 profile 共用）**

```powershell
# Windows（永久生效，但必须重启 Harness）
setx AGNES_API_KEY "sk-你的Key"
```

```sh
# macOS / Linux
export AGNES_API_KEY="sk-你的Key"     # 写进 ~/.bashrc 或 ~/.zshrc 可长期生效
```

> ⚠️ 环境变量**只在程序启动时读一次**，所以设完**必须重启 Harness**。

**方式 ③：写在插件配置里（适合只有这一个 profile）**

编辑 `~/.dsh/profiles/<你的profile>/cordis.patch.yml`，加入：

```yaml
- id: agnes-image
  name: dsh-agnes-image
  config:
    apiKey: sk-你的Key
```

> ⚠️ 这种写法会让 Key 留在配置文件里。如果这个文件会被同步或备份到别处，请改用方式 ①。

---

### 第 5 步：重启 Harness

改完配置后重启一次（桌面版注意：**点窗口右上角的 X 只是最小化到托盘**，要**右键托盘图标 → 退出**，再打开）。

> 只有用「方式 ① 密钥文件」时才可以跳过这步。

---

### 第 6 步：验证

对 Harness 说一句：

> 画一张：一只戴耳机的小熊猫在画画，扁平插画风格

✅ **成功的标志**（三个都对才算成功）：

1. 它**没有**说「我没有画图能力」，而是去调用了 `agnes_generate_image`
2. 图片**直接显示在对话里**
3. 工作目录下出现 `generated-images/<今天日期>/xxx.png`

❌ 如果报 `Agnes API key is missing` → 回第 4 步，换方式 ①
❌ 如果报 `401 / 403` → Key 值不对（多半填了名字），重新复制
❌ 如果压根没这个工具 → 回第 3 步，并**完全退出** Harness 再打开

---

## 怎么用

### 直接说话就行

你不需要记参数、不需要背命令。这几种说法它都能听懂：

- 「画一张海边日落的壁纸，16:9」
- 「来个插画：一只猫在开视频会议」
- 「给 README 配个头图，扁平风」
- 「把 `D:\shots\room.png` 改成雨夜赛博朋克，保留构图」
- 「用这两张图合成一张海报，第一张是主角，第二张是产品」

### 想精确控制？把参数说给它听

| 参数 | 怎么用 | 默认 |
|---|---|---|
| `prompt` | **必填**，描述画面。写得越具体越好 | — |
| `size` | 清晰度档位：`1K`（快）/ `2K`（清晰）/ `3K` / `4K`；也可写死尺寸如 `1024x768` | `1K` |
| `ratio` | 比例：`1:1` `3:4` `4:3` `16:9` `9:16` `2:3` `3:2` `21:9` | `1:1` |
| `model` | `agnes-image-2.5-flash`（默认，最新最强）/ `2.1-flash` / `2.0-flash` | 2.5 |
| `image` | 参考图：**本地路径**、公网链接、或 `data:image/...` | 无 |
| `outputName` | 指定文件名（不含扩展名） | 提示词自动生成 |

大白话对照：

| 你想要 | 就这么说 |
|---|---|
| 手机壁纸 | 「竖版，9:16」 |
| 电脑壁纸 | 「横版，16:9，2K」 |
| 头像 / 图标 | 「1:1，1K」 |
| 快一点 | 「1K 就行」 |
| 高清一点 | 「2K」|

### 三种玩法的区别

| 玩法 | 你需要给什么 | 插件怎么发请求 |
|---|---|---|
| **文生图** | 只说描述 | 只带 `prompt`（+ 尺寸比例） |
| **图生图** | 描述 + **一张**参考图（路径或链接） | 参考图放进 `image` |
| **多图合成** | 描述 + **多张**参考图 | 多张按顺序放进 `image`，顺序 = 你说的「第一张、第二张」 |

> 本地图片会被读出来换成 base64 再发出去（这是接口的要求）。
> **只支持 PNG / JPEG / WebP / GIF 四种格式，单张最大 12 MB** —— 超大图先压缩一下。

### 出图尺寸对照表

| 比例 | 1K | 2K | 3K | 4K |
|---|---|---|---|---|
| `1:1` | 1024x1024 | 2048x2048 | 3072x3072 | 4096x4096 |
| `3:4` | 864x1152 | 1728x2304 | 2592x3456 | 3456x4608 |
| `4:3` | 1152x864 | 2304x1728 | 3456x2592 | 4608x3456 |
| `16:9` | 1312x736 | 2624x1472 | 3936x2208 | 5248x2944 |
| `9:16` | 736x1312 | 1472x2624 | 2208x3936 | 2944x5248 |
| `2:3` | 832x1248 | 1664x2496 | 2496x3744 | 3328x4992 |
| `3:2` | 1248x832 | 2496x1664 | 3744x2496 | 4992x3328 |
| `21:9` | 1568x672 | 3136x1344 | 4704x2016 | 6272x2688 |

> 想要 `1920x1080` / `2560x1440` 这种显示器分辨率？请用 **`2K` + `16:9`**，再自己裁剪。
> 直接写 `1920x1080` 会被服务端吸附到最接近的标准档位（画质不受损，只是尺寸不同）。

### 提示词怎么写（官方建议的模板）

| 场景 | 模板 |
|---|---|
| 文生图 | `[主体] + [场景/环境] + [风格] + [光照] + [构图] + [质量要求]` |
| 图生图 | `[改动要求] + [新风格/场景] + [要加/要去的元素] + [必须保留的元素]` |
| 多图合成 | 说明每张图的角色 + 图与图的关系 + 目标风格与构图 |

举例（图生图）：**把白天街道改成赛博朋克雨夜，加霓虹招牌和湿地面反光，同时保留街道布局、相机角度和主要建筑形状。**

---

## 安全与隐私（建议花两分钟看完）

### 你的 Key 会被怎么处理

- 插件只把 Key 放进 HTTP 请求头 `Authorization: Bearer ...` 发给**你配置的 `baseUrl`**（默认是 Agnes 官方地址）
- **不会**写进日志、不会回显在对话里、不会写进生成的图片
- 报错信息里只会出现「去哪里放 Key」的**路径**，不会出现 Key 本身

### 你的图片和提示词去哪了

- 提示词、参考图、生成的图片都会经过 **Agnes 的服务器**（这是云端服务的工作原理）
- 生成结果的下载链接指向 Agnes 的对象存储，插件拿到后会立刻下载到本地
- **不想让某张图上传？那就别把它当参考图**。插件不会自动上传你工作区里的任何文件

### 本地文件什么时候会被读出来发出去

**只有**你（或模型替你）在 `image` 参数里**明确写出路径**时，插件才会读那个文件。为了防手滑和防提示词注入，插件做了三道闸：

1. 读出来先按**文件头**确认是图片（PNG / JPEG / WebP / GIF），不是图片直接拒绝
   —— 所以就算有人骗模型传 `~/.ssh/id_rsa`，也不会被当成「参考图」发出去
2. 单张上限 **12 MB**，超了直接报错（本地文件要以 base64 内联，太大既慢又没意义）
3. `data:` 开头的内容只接受 **`data:image/...;base64,`**，其它类型一律拒绝

下载回来的图片同样有三道闸：只接受 `http(s)` 地址、有**64 MB** 体积上限、响应内容按文件头/`Content-Type` 确认是图片才写入磁盘。

### 关于会话记录

DSH 会把对话原文存在本地（`~/.dsh/sessions/`）。**你在对话里粘贴过的 Key 也在里面**。所以：

- 不要把 `~/.dsh/sessions/` 提交到任何 git 仓库（本插件的安装已在 `~/.dsh/.gitignore` 里加了忽略规则）
- 要彻底清理：去 Agnes 控制台**吊销旧 Key** 并新建一个，然后更新你的密钥文件

### 插件自己对系统的权限

它是一个普通的 DSH 插件：**只做两件事**——发 HTTP 请求、往工作区写图片文件。不执行 shell 命令、不 eval 代码、不装额外依赖、不读工作区以外的文件（除非你在 `image` 里指名）。

---

## 常见问题 FAQ

**Q：要花钱吗？**
A：插件本身免费开源；Agnes 的图像模型目前免费（官方定价页标注 `$0`）。以官方页面为准。

**Q：一定要说「画一张」开头吗？**
A：不用。「来个……」「配张图」「把这张改成……」都行，只要意图是出图/改图。

**Q：必须联网吗？**
A：必须。图片是在云端生成的。

**Q：能一次生成好几张吗？**
A：一次调用返回一张。想多张就多说几次，或者直接说「给我 3 个不同版本」，模型会自己调多次。

**Q：图存哪儿了？会不会找不到？**
A：存在**你当前会话的工作目录**下的 `generated-images/<日期>/`，文件名带时间戳。想换地方就改配置项 `outputDir`。

**Q：可以画真实人物/品牌 logo 吗？**
A：技术上可以描述，但请注意版权、肖像权和服务商的内容政策，别生成违规内容。

**Q：能改我已有的照片吗？**
A：可以（图生图）。把文件路径或链接一起给它就行。

**Q：之前那张图还能再改一次吗？**
A：能，它就在你的工作目录里。把那个路径再给它，或者直接用 `@` 引用文件。

**Q：生成的图有署名/水印吗？**
A：插件不加水印；Agnes 侧的默认行为以服务商为准。

---

## 出错了？症状对照表

**先做这三件事**（能解决 80% 的问题）：

1. **完全退出 Harness 再打开**（桌面版右键托盘 → 退出，点 X 只是最小化）
2. **确认 Key 读到了**：让 AI 看一下 `~/.dsh/agnes-image.config.json` 里有没有 `apiKey`
3. **确认网络通**：`curl https://apihub.agnes-ai.com/v1/models -H "Authorization: Bearer sk-你的Key"`

| 你看到的 | 原因 | 怎么修 |
|---|---|---|
| 工具列表里没有 `agnes_generate_image` | 没装成功，或没重启 | 重装后**完全退出** Harness |
| `Agnes API key is missing` | 三个地方都没找到 Key | 见「第 4 步」，方式 ① 最省事 |
| `401` / `403` | Key 的值不对 | 重新复制 `sk-` 开头的整串 |
| `404` | 模型名不认识 | 换 `agnes-image-2.5-flash` / `2.1-flash` / `2.0-flash` |
| `429` | 请求太频繁 | 等一会儿再试 |
| `Invalid size` / `Invalid ratio` | 参数写了不支持的值 | 尺寸用 `1K`~`4K` 或 `宽x高`；比例用表格里那 8 个 |
| `Cannot read the reference image` | 路径写错 / 文件不存在 | 用**绝对路径**，或改成公网链接 |
| `is not a raster image` | 参考图不是 PNG/JPEG/WebP/GIF | 换成这四种格式之一 |
| `... the limit is 12 MB` | 参考图太大 | 先压缩，或改用公网链接 |
| `Refusing to download a non-HTTP(S)` | 服务端给了非法地址 | 重试；持续出现请提 issue |
| `not an image` | 下载回来的不是图片 | 重试；持续出现请提 issue |
| `non-JSON body` | 网络中间有代理/网关拦截 | 检查代理设置或换网络 |
| 生成要等 30 秒以上 | **正常** | 大部分时间花在云端生成。赶时间就用 `1K` |
| 装在桌面版却没用 | 桌面版和命令行版插件各自独立 | 给 `desktop` profile 也装一次 |

---

## 进阶：配置项

在你的 profile 里覆盖（`~/.dsh/profiles/<profile>/cordis.patch.yml`）：

```yaml
- id: agnes-image
  name: dsh-agnes-image
  config:
    apiKey: ''                                     # 留空 → 环境变量 → 密钥文件
    baseUrl: https://apihub.agnes-ai.com/v1        # 接口地址（国内备用：apihub.agnes-ai.cn）
    model: agnes-image-2.5-flash                   # 默认模型
    outputDir: generated-images                    # 输出目录（相对会话工作区，可写绝对路径）
    timeoutMs: 300000                              # 单次请求超时（毫秒），官方建议 60s–360s
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `apiKey` | string | 无 | 留空则按「环境变量 → 密钥文件」继续找 |
| `baseUrl` | string | `https://apihub.agnes-ai.com/v1` | 末尾斜杠会被自动去掉 |
| `model` | string | `agnes-image-2.5-flash` | 调用时没指定就用它 |
| `outputDir` | string | `generated-images` | 相对**会话工作区**；实际落在其下的 `<日期>/` |
| `timeoutMs` | number | `300000` | 超时后中止请求并报错 |

> 📌 **写错配置项名字会直接报错**（而不是被默默忽略）—— 这样你才能发现拼写错误。
> 📌 patch 是**整体替换** `config`，不是逐项合并：覆盖时要重写所有你想保留的字段。

---

## 进阶：开发者

```sh
# 跑测试（完全离线：假 fetch、不需要 Key、不联网）
node --test          # 33 个用例

# 语法检查
node --check index.js
```

**改完代码想立刻看到效果**（不重启 Harness）：在 profile 的 `cordis.patch.yml` 末尾追一段

```yaml
- insert:
    - id: agnes-image
      name: dsh-agnes-image
      config:
        model: agnes-image-2.5-flash
```

前提是该 profile 的 `dsh.profile.patchReload` 是 `live`。
⚠️ **不要和 `dsh plugin add` 同时用**：同一个插件插两行，工具会被注册两次。

仓库结构：

```
dsh-agnes-image/
├── index.js             # 插件本体：一个 Host 工具 + Config 契约
├── cordis.patch.yml     # bundle 层：把插件行插进 Loader
├── package.json         # dsh.bundle.patch / meta / icon
├── icon.svg             # 插件卡片图标
├── locale/{zh,en}.json  # 插件卡片标题与描述
├── test/                # node:test，离线运行
├── docs/preview.jpg     # README 配图（本插件生成的）
├── CHANGELOG.md         # 变更记录
└── CONTRIBUTING.md      # 贡献指南
```

## 设计说明（为什么这么写）

- **零依赖**：只用 Node 内置模块。发布版 dsh 把 zod 之类的依赖藏在带哈希的 pnpm 路径下，从已安装的 bundle 里解析不到；自己实现 Standard Schema 契约反而更稳。
- **`response_format` 必须放进 `extra_body`**：Agnes 不接受请求体顶层的这个字段，参考图也必须走 `extra_body.image`。测试里有专门的断言盯着这点。
- **拿到图就立刻下载**：服务端链接不保证长期有效，写进本地才是你的。同时注册为会话附件，这样对话里能直接看到图。
- **存到「会话工作区」而不是「进程目录」**：DSH 宿主进程的工作目录往往是启动器的目录，不是你的项目目录。插件通过 `workspaceRegistry` 反查当前会话的工作区，查不到才退回到进程目录。
- **只有档位尺寸才搭配 `ratio`**：`1024x768` 这种写死的尺寸已经确定了形状，再发比例会让服务端意图含混。
- **文件名安全**：非法字符会被替换，Windows 保留设备名（`CON`、`NUL`、`LPT1`…）会自动改成 `CON-image.png`，避免写盘失败。
- **Key 每次调用重新读**：换 Key 不必重启。

## 许可证

[MIT](./LICENSE)

## 相关链接

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [插件打包与安装（官方教程）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)
- [Agnes AI 文档](https://wiki.agnes-ai.com/zh-Hans/docs/overview)
- [Agnes Image 2.5 Flash 接口说明](https://wiki.agnes-ai.com/zh-Hans/docs/agnes-image-25-flash)
