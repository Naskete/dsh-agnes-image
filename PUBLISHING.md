# 发布清单：从本地仓库到插件市场

这份文档回答一个问题：**代码写完了，怎么让它在生态里被找到。**
（面向插件作者；使用者的安装说明在 [README.md](README.md)。）

---

## 0. 前置条件（本仓库已满足）

| 要求 | 状态 |
|---|---|
| `package.json` 声明 `dsh.bundle`（这是「可安装」的标志） | ✅ `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` |
| 纯 JavaScript、零依赖、无安装期脚本 → 从 GitHub 安装不需要 `allowBuilds` 授权 | ✅ |
| `cordis.patch.yml` 与 `index.js` 在仓库根 | ✅ |
| 离线测试可跑（`node --test`） | ✅ |

---

## 1. 推到 GitHub

先在 GitHub 上**建一个空仓库**（不要勾选 README / .gitignore / license），然后：

```powershell
cd $env:USERPROFILE\.dsh\plugin-src\dsh-agnes-image
git remote add origin https://github.com/Naskete/dsh-agnes-image.git
git push -u origin main --tags
```

---

## 2. ⭐ 给仓库加 `dsh-plugin` topic（这一步不能省）

**这一步就是「表明这是 DSH 插件」的官方做法。**

网页操作：仓库首页 → 右侧 **About** 区域的**齿轮图标** → **Topics** → 填 `dsh-plugin` → 保存。

命令行（装了 [gh CLI](https://cli.github.com/)）：

```sh
gh repo edit Naskete/dsh-agnes-image --add-topic dsh-plugin,dsh,deepseek-harness,image-generation,agnes
```

**为什么必须**：DSH 生态里大量「找插件」的工具（`dsh-find-plugin` 及其它目录站、市场）都是
**直接搜索 GitHub 的 [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic** 来发现新插件的。
没有这个 topic，别人搜不到你 —— `package.json` 里的 `keywords` 只对 npm 搜索有用，**不能替代 topic**。

---

## 3. 进内置插件市场（可选，但推荐）

> **只推 GitHub 不会自动出现在市场里。** 市场（设置 → 插件市场 / `dshmarket`）的数据源是
> [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的精选 registry —
> 它和这个市场是**两个不同的仓库**，需要你单独提一个 PR。

**提 PR 的内容：新增一个文件** `data/plugins/Naskete__dsh-agnes-image.yml`（文件名格式 `<owner>__<repo>.yml`）：

```yaml
url: https://github.com/Naskete/dsh-agnes-image
name: Naskete/dsh-agnes-image
category: tools
description:
  en: 'Generate and edit images with Agnes AI (agnes-image-2.5-flash): text-to-image, image-to-image and multi-image composition, saved straight into the session workspace.'
  zh: '用 Agnes AI（agnes-image-2.5-flash）生成或编辑图片：文生图、图生图与多图合成，结果直接存进会话工作区。'
```

> - 描述里含 `: `（冒号+空格）**必须加引号**，否则 YAML 解析失败 —— 上面的英文已加。
> - `description.en` 是唯一必填项；写不了中文可以不写，维护者会补。
> - **不要手工编辑 README**，那份列表是脚本从 `data/plugins/*.yml` 生成的。
> - 一个 PR 最多 3 条条目。

**CI 会自动校验**（不通过就无法合并）：

| 检查 | 本仓库状态 |
|---|---|
| `package.json` 声明 `dsh.bundle` | ✅ 已满足 |
| 仓库**创建满 1 天** | ⏳ 刚推送的仓库要等一天；不够就改好再来，重新提交不受影响 |
| 仓库带 `dsh-plugin` topic | 见第 2 步 |
| 有真实可用代码（非占位/空壳） | ✅ |
| 描述属实（维护者会对着代码核） | ✅ 描述里只写了实际支持的能力 |

合并后：market 客户端、awesome 网站、以及 `dsh-find-plugin` 的精选回退列表都会自动更新（通常一天内）。
**如果被要求修改**：在同一分支上推送修复即可，不用重开 PR。

---

## 4. 可选：发布到 npm

好处：市场能显示**下载量**、图形界面的「+ 添加插件」可以只填包名、预构建安装免授权。

```sh
npm login
npm publish
```

约束：发布包的 `repository` 字段必须指回 `https://github.com/Naskete/dsh-agnes-image`，
否则市场不会把包和仓库关联起来（**列不列进市场不受影响**，发不发都能从 GitHub 装）。

---

## 5. 可选：截图与预构建包

**截图**：在仓库根放 `screenshots.json`，列出 1–8 张仓库内的相对路径，市场详情页会像 App Store 一样展示：

```jsonc
// <repo>/screenshots.json
["docs/preview.jpg"]
```

（不声明也行：市场会自动从 README 抽取图片，声明只是让你能控制顺序和挑选。）

**预构建 tarball**：把 `dsh-agnes-image-0.1.0.tgz` 作为资产挂到 GitHub Release，然后在投稿 yml 里加：

```yaml
tarball: https://github.com/Naskete/dsh-agnes-image/releases/latest/download/dsh-agnes-image.tgz
```

⚠️ `latest/download/` 的文件名是**字面匹配**：名字里带版本号的话，你下次发版它就会 404。
要么让资产名不带版本（如上），要么钉住 tag：
`.../releases/download/v0.1.0/dsh-agnes-image-0.1.0.tgz`。

---

## 6. 收录后：挂个徽章

```markdown
[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
```

---

## 7. 最容易被打回的几个原因（避免踩）

1. **只声明了 `dsh.client`**，缺 `dsh.bundle` —— 那样装不上。本仓库没有这个问题。
2. **描述夸大**：写了数字或 API 名，代码里对不上。描述会被逐条核对，这是最主要的打回原因。
3. **仓库太新**（< 1 天）或**是纯 README / 占位仓库**。
4. **忘了加 `dsh-plugin` topic**。
5. **分类选得太离谱** —— 其实不会因此被打回，维护者会自行调整；按「插件实际做的事」选最接近的即可。
6. **PR 里动了别人的条目** —— 只改你自己的那一个文件。

---

## 8. 一句话总结

```
推到 GitHub  →  加 dsh-plugin topic  →  （想进市场）PR 到 awesome-dsh-plugin
     ↑                                          ↑
  dsh plugin add github:Naskete/dsh-agnes-image   这一步和市场是两回事
```
