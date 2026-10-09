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
- 测试：`node --test test/`，覆盖配置校验、工具契约、请求体形状（含 `extra_body` 规则）与落盘流程，全部离线运行。

[Unreleased]: https://github.com/YOUR_GITHUB_NAME/dsh-agnes-image/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/YOUR_GITHUB_NAME/dsh-agnes-image/releases/tag/v0.1.0
