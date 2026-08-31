# Changelog

## 1.0.3

- Remove the browser `dsh.client` card. Declaring it without an official client bundle crashed DSH Desktop on startup. Host wrap is unchanged; edit `maxImages` in `settings.yaml` or `cordis.patch.yml`.

## 1.0.2

- Default `maxImages` is 6 and `maxBytes` is 6MB so a short reference set still reaches native vision.

## 1.0.1

- Register the `image-amnesia` settings namespace and a Plugin configuration card so `maxImages` is editable in the GUI.

## 1.0.0

- Wrap every LLM adapter `prepareCall().stream` so frozen agent-loop requests stay valid.
- Drop oldest images first; keep at least the newest image for native vision.
- Nested `tool-result` images are included.
- Original session messages are never mutated.
- Optional settings section when `@deepseek-ai/dsh-settings` is present.
