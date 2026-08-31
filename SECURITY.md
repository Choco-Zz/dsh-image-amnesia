# Security

This plugin runs inside the DeepSeek Harness host process.

- It reads outbound LLM request messages and replaces older image blocks with a short text stub.
- It does not upload images to a third party of its own; it only reduces what the already-configured model adapter would send.
- It does not read `.env`, API keys, or credentials.
- It does not write outside the DSH process besides Host logs.

Report issues on the GitHub repository.
