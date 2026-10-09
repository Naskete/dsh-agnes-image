# 贡献指南

感谢你想改进这个插件。它刻意保持**零依赖、纯 JavaScript、无构建步骤**，请沿用这个约束。

## 本地开发

```sh
# 1. 运行测试（离线，不需要 API Key，不发起任何网络请求）
node --test test/

# 2. 语法检查
node --check index.js
```

## 在真实 Harness 里调试

把仓库目录链进你的 profile，然后让 Loader 加载它：

```sh
# 方式 A：标准安装（会把包加进 profile 的 bundles 列表，需要重启 Harness）
dsh plugin --profile web add /path/to/dsh-agnes-image

# 方式 B：live 调试（在 profile 的 cordis.patch.yml 末尾插入一行，改完即生效，无需重启）
```

```yaml
- insert:
    - id: agnes-image
      name: dsh-agnes-image
      config:
        baseUrl: https://apihub.agnes-ai.com/v1
        model: agnes-image-2.5-flash
```

> 方式 B 依赖 profile 的 `dsh.profile.patchReload: live`。**不要同时用 A 和 B**，
> 否则同一插件会被插入两次。用 A 时记得 `dsh plugin --profile web remove dsh-agnes-image` 来卸载。

调试时可临时设置 `AGNES_API_KEY_FILE` 指向一个测试用的 Key 文件，避免动用真实密钥。

## 提交要求

1. **测试必须离线可跑**。禁止在测试里发起真实网络请求——用假 `fetch`（见 `test/tool.test.mjs`）。
2. **不要引入运行时依赖**。发布版 dsh 把依赖藏在带哈希的 pnpm 路径下，从已安装的 bundle 里解析不到；
   只用 Node 内置模块，或注入的 `ctx.*` 服务。
3. **不要放宽安全闸门**（`test/tool.test.mjs` 尾部的 5 个用例在盯着它们）：
   - 本地参考图必须按**文件头**确认为 PNG / JPEG / WebP / GIF 才能内联外发；
   - `data:` 输入只接受 `data:image/...;base64,`；
   - 下载只接受 `http(s)`、有体积上限、内容必须是图片才落盘。
   放宽任何一条都等于把「用户文件外泄」或「任意内容写盘」的风险重新打开，请在 PR 里给出充分理由。
4. **不要新增顶层 `response_format`**。Agnes 只接受 `extra_body.response_format`。
5. **错误信息保持中英双语**，并且要说清「怎么修」，不只是「哪里错了」。
6. **不要把密钥写进任何文件**：测试用 `AGNES_API_KEY_FILE` 指向临时路径，绝不动真实的
   `~/.dsh/agnes-image.config.json`。
7. 改了行为就更新 `CHANGELOG.md`；改了配置项/参数就更新 `README.md` 与 `README.en.md`。

## 提 PR

- 一个 PR 只做一件事，说明动机和验证方式（贴一下测试输出即可）。
- 涉及用户可见行为变化的，请在描述里给出 before / after。
