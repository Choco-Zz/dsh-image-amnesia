# dsh-image-amnesia

A DeepSeek Harness profile bundle that keeps **native vision** (Grok, Claude, GPT, …) while stopping **historical images** from being re-uploaded to relay providers on every turn.

The local session still stores every original image. Only the outbound model request is projected. Every agent in the profile — including subagents and task-board jobs — shares the same wrap.

## Why

DSH's built-in visual offload defaults are about **20MB / 600 images**. Relays (OpenAI-compatible gateways) usually die long before that. Each `read_image` or paste stays in history and is sent again on the next turn.

This plugin drops oldest images first, and **always keeps the newest `keepAtLeast` image** so the current look still reaches a native vision model.

## Install

```sh
pnpm dsh plugin --profile web add github:Choco-Zz/dsh-image-amnesia
pnpm dsh plugin --profile desktop add github:Choco-Zz/dsh-image-amnesia
```

Local checkout:

```sh
pnpm dsh plugin --profile web add "link:D:/CodexProjects/dsh-image-amnesia"
```

Install once per **profile**. You do not install it per agent. Subagents, task-board cron jobs, and new chats in that profile are covered automatically. See `AGENTS.md`.

## Defaults

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Master switch |
| `maxImages` | `6` | Images kept in the outbound request |
| `maxBytes` | `6291456` | Byte budget for kept images |
| `keepAtLeast` | `1` | Never drop the newest N images |

Edit `image-amnesia.maxImages` in `settings.yaml` or this package's `cordis.patch.yml`. Do not add a `dsh.client` half unless it is a real lazy-CJS client bundle — a stub card prevented DSH Desktop from starting.

## Verify

Paste seven images in one session. Host log:

`dsh-image-amnesia: dropped 1/7 image(s); kept 6`

```sh
node --test
```

## License

MIT
