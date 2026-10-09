# Changelog

本文件记录本插件的所有重要变更。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.0] - 2026-10-10

### Added

- 首个可用版本，注册 Host 工具 `agnes_generate_image`。
- 文生图：`prompt` + `size`（1K/2K/3K/4K 档位或显式 `WxH`）+ `ratio`（8 种宽高比）。
- 图生图与多图合成：`image` 数组接受公网 HTTPS URL、Data URI 或本地文件路径（本地文件自动内联为 Data URI，单张上限 12 MB）。
- 模型：`agnes-image-2.5-flash`（默认）、`agnes-image-2.1-flash`、`agnes-image-2.0-flash`。
- 生成结果立即下载并写入会话工作区 `generated-images/<YYYY-MM-DD>/`，同时注册为会话附件以在对话中内联预览。
- API Key 三级查找：Loader 行 `config.apiKey` → 环境变量 `AGNES_API_KEY` → 密钥文件 `~/.dsh/agnes-image.config.json`（每次调用重新读取，换 Key 无需重启）。
- 配置项：`apiKey`、`baseUrl`、`model`、`outputDir`、`timeoutMs`，通过 Standard Schema (`Config['~standard']`) 校验。
- 平台适配：Windows 保留设备名（`CON`、`NUL`、`LPT1` 等）自动改名；文件名按提示词 slug + 秒级时间戳生成，避免覆盖。
- 零依赖实现：仅使用 Node 内置模块与注入的 `tools` / `attachments` / `workspaceRegistry` 服务。
- 测试：`node --test`，33 个用例，覆盖配置校验、工具契约、请求体形状（含 `extra_body` 规则）、落盘流程与安全准入，全部离线运行（假 `fetch`，不需要 Key）。

### Security

- **参考图准入**：本地文件必须按**文件头**确认为 PNG / JPEG / WebP / GIF 才会被读出来内联发送；其它文件一律拒绝。这条挡住的是「被提示词注入的模型把 `~/.ssh/id_rsa`、`.credentials.yaml` 之类当作参考图外发」的场景。
- **`data:` 输入准入**：只接受 `data:image/...;base64,`，其它 Data URI 直接拒绝。
- **下载准入**：只接受 `http(s)` 地址；`Content-Length` 与实际体积都有 64 MB 上限（先看声明再验实际）；内容必须是图片（文件头或 `Content-Type: image/*`）才写入磁盘，避免把任意内容以图片名义落盘。
- **本机侧防护**：安装说明中在 `~/.dsh/.gitignore` 补上忽略规则，避免密钥文件与会话记录被误提交到 git。
- 体积边界：本地参考图单张上限 12 MB，超限报错并说明原因。

[Unreleased]: https://github.com/Naskete/dsh-agnes-image/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Naskete/dsh-agnes-image/releases/tag/v0.1.0
