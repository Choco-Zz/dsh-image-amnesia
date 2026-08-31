# dsh-image-amnesia

DeepSeek Harness 全局插件：让 grok / Claude / GPT 等**原生看图模型继续看图**，但**历史图片不再反复打进中转站**。

会话本地仍保存原图。被丢掉的只是发往 API 的那一份请求体。所有 agent、所有子代理、所有走 `ctx.llm` 的模型共用这一层。

## 它解决什么

中转站（sui-xiang 一类）对请求体很敏感。DSH 默认视觉上限大约是 **20MB / 600 张图**。主会话每看一张图，历史图片都会在下一轮原样重传。几轮之后：

- Connection error / 413 / terminated
- 中转站进程被撑死
- compact 也救不了，因为 image parts 还在

本插件在适配器真正发 HTTP 之前，按「从旧到新」丢掉多余的图，**默认最多留最新 6 张**给原生视觉。

不会改 session log，所以回放、导出、本地查看都还在。

## 安装

### 本机开发（已有仓库）

```bat
cd <dsh-source>
pnpm dsh plugin --profile web add "link:D:/CodexProjects/dsh-image-amnesia"
pnpm dsh plugin --profile desktop add "link:D:/CodexProjects/dsh-image-amnesia"
```

没有 `pnpm dsh` 时，手工把依赖和 bundle 写进 `$DSH_HOME/profiles/<profile>/package.json`，再 `pnpm install`。

### 给其他机器 / 其他 agent 用（GitHub）

```bat
pnpm dsh plugin --profile web add github:Choco-Zz/dsh-image-amnesia
pnpm dsh plugin --profile desktop add github:Choco-Zz/dsh-image-amnesia
```

装进 **profile** 就会对这个 profile 里的每一个 agent 生效，包括子代理、任务看板定时任务、新开的会话。不用每个 agent 单独装。

Web 长驻进程一般会热载 patch；若设置页没出现 `dsh-image-amnesia`，重启一次 `dsh web` / DSH Desktop。

## 默认策略

| 项 | 默认 | 含义 |
| --- | --- | --- |
| `enabled` | `true` | 总开关 |
| `maxImages` | `6` | 请求里最多留几张图 |
| `maxBytes` | `6291456`（6MB） | 留下的图合计体积上限 |
| `keepAtLeast` | `1` | 即使超体积也至少留最新 N 张，避免原生看图变成 0 张 |

改上限：编辑 `~/.dsh/settings.yaml` 的 `image-amnesia.maxImages`，或改插件 `cordis.patch.yml`。不要给这个包加 `dsh.client`——不完整的浏览器半侧会让 DSH Desktop 起不来。

## 怎么验证

1. 连续往同一会话贴 7 张图并提问。
2. Host 日志应出现 `dsh-image-amnesia: dropped 1/7 image(s); kept 6`。
3. 模型仍能描述**最新 6 张**；更早的图不再打进中转站。
4. 本地会话时间线里 7 张图都还在。

```bat
cd D:\CodexProjects\dsh-image-amnesia
node --test
```

## 不会做什么

- 不把图转给 DeepSeek / Gemini 官方视觉（那是 ModLens 的事）。
- 不删除磁盘上的附件。
- 不替代上下文文本压缩（可与 `dsh-force-compact` 等并存）。
- 不作用于非 DSH 的 Cursor / Claude Code / OpenCode；那些环境请继续用各自的 vision 桥。

## 原理

Agent loop 发出的请求是冻结的，不能在 `llm/stream` 里改 `messages`（否则 invariant 会报 desync）。本插件包装每个 LLM adapter 的 `prepareCall().stream`：invariant 通过之后、HTTP 发出之前，投影一份去掉旧图的 messages。这是 DSH 自己的 `offloadRequestImages` 同一层，只是把 20MB/600 张收成中转站扛得住的预算。

## License

MIT
