[English](./README.md) | 中文

# SlothCommit 🦥

**再也不用对着 commit 输入框发呆。**

粘贴你的 `git diff`，得到一条干净的 Conventional Commit message + PR 描述 —— 由开源权重 AI 生成。

[在线演示](https://commit.tianx.tech) · [DEV 文章](#) · [Hacktoberfest Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)

---

## 演示

https://github.com/user-attachments/assets/3960d5df-d31d-4c91-80c1-d1af42a5b46f

## 它是干嘛的

写 commit message 是开发者一天中最爱拖延的 30 秒。SlothCommit 帮你省掉它：

1. 在终端跑 `git diff --staged`
2. 把 diff 粘贴进 SlothCommit
3. 得到一条规范的 commit message（Conventional Commits / 简洁 / Emoji 三种风格）+ 可选的 PR 描述
4. 复制，粘贴，完事。回去接着睡。

## 怎么做的

- **前端**：单个零构建 `index.html` —— 无框架，无打包
- **后端**：Cloudflare Pages Function（`functions/api/generate.js`）
- **AI**：[Llama 3.1 8B Instruct](https://ai.meta.com/llama/)（开源权重），跑在 [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) 上 —— 不用 API key，不按 token 计费
- **域名**：部署在 `commit.tianx.tech`（一个 `.tech` 域名）

## 为什么用开源权重？

你的 diff 里全是还没提交的工作 —— 半成品想法、内部 API、私有逻辑。发给闭源 API，等于把没写完的代码托付给第三方。

用跑在 Cloudflare 边缘节点上的开源权重 Llama：

- **不囤数据**：你的 diff 处理完就忘，不会拿去训练
- **不花钱**：Workers AI 免费额度完全够用，配一次，永久白嫖
- **人人可用**：任何人 fork 这个仓库，几分钟就能部署自己的版本

## 自己跑一个

**方案 A —— 本地（完整 AI 功能，演示推荐）：**
```bash
git clone https://github.com/joemh79/sloth-commit.git
cd sloth-commit
ollama pull gemma3:4b   # 开源权重模型，跑在你自己机器上
python3 local_server.py  # 打开 http://localhost:8080
```

**方案 B —— Cloudflare Pages：**
```bash
# 1. 建一个 Pages 项目，上传这个文件夹
# 2. Settings → Functions → 添加绑定：AI → Workers AI
# 注：commit.tianx.tech 上的在线演示目前只提供界面；
# 完整 AI 生成功能走本地 Ollama（方案 A）。
```

## 许可证

MIT
