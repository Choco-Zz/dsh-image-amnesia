# AGENTS.md

This DeepSeek Harness profile bundle wraps **every** `ctx.llm` adapter in the profile.

- Do not re-send historical images to relay providers. This plugin already drops older image blocks on the outbound request and keeps the newest `keepAtLeast` image for native vision.
- Do not mutate session logs to strip images. The original attachments stay local.
- Subagents, task-board jobs, and new chats inherit the wrap automatically. You do not install this per agent.
- If a turn still needs an older image, re-read its file path in the current turn.
- Defaults: `maxImages=1`, `maxBytes=2MB`, `keepAtLeast=1`. Change them in Settings → Plugin configuration → dsh-image-amnesia.
