/**
 * Pure image-budget policy for outbound LLM requests.
 * Oldest images drop first. The newest `keepAtLeast` images always stay,
 * even when they exceed maxBytes, so native vision still sees the latest look.
 * Session storage is never mutated here — callers pass a request projection.
 */

export const OMITTED_IMAGE_TEXT =
  "[image omitted to keep this request within relay size limits; older images dropped first. The original remains in the local session. Re-read the file if you still need it.]";

export const DEFAULT_POLICY = Object.freeze({
  enabled: true,
  maxImages: 1,
  maxBytes: 2 * 1024 * 1024,
  keepAtLeast: 1,
});

export function normalizePolicy(input) {
  const src = input && typeof input === "object" ? input : {};
  const maxImages = toInt(src.maxImages, DEFAULT_POLICY.maxImages, 1, 64);
  const keepAtLeast = Math.min(maxImages, toInt(src.keepAtLeast, DEFAULT_POLICY.keepAtLeast, 1, 16));
  return {
    enabled: src.enabled !== false,
    maxImages,
    maxBytes: toInt(src.maxBytes, DEFAULT_POLICY.maxBytes, 1024, 64 * 1024 * 1024),
    keepAtLeast,
  };
}

function toInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function imageBytes(block) {
  const attachment = block?.attachment;
  const raw = Number(attachment?.bytes);
  if (Number.isFinite(raw) && raw > 0) return raw;
  const b64 = attachment?.data || attachment?.base64;
  if (typeof b64 === "string" && b64.length) return Math.floor((b64.length * 3) / 4);
  return 0;
}

/** Collect image blocks in request order (oldest first), including nested tool results. */
export function collectImages(messages) {
  const found = [];
  const walk = (blocks, path) => {
    if (!Array.isArray(blocks)) return;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block || typeof block !== "object") continue;
      if (block.type === "image") {
        found.push({ path: [...path, i], bytes: imageBytes(block) });
        continue;
      }
      if (block.type === "tool-result" && Array.isArray(block.content)) {
        walk(block.content, [...path, i, "content"]);
      }
    }
  };
  if (!Array.isArray(messages)) return found;
  for (let m = 0; m < messages.length; m++) {
    walk(messages[m]?.content, [m, "content"]);
  }
  return found;
}

function dropCount(images, policy) {
  const keepFloor = Math.min(policy.keepAtLeast, images.length);
  const maxDrop = Math.max(0, images.length - keepFloor);
  let drop = Math.max(0, images.length - policy.maxImages);
  let keptBytes = images.reduce((sum, img) => sum + img.bytes, 0);
  let i = 0;
  while (i < maxDrop && (drop > i || keptBytes > policy.maxBytes)) {
    keptBytes -= images[i].bytes;
    i += 1;
    if (i > drop) drop = i;
  }
  return Math.min(drop, maxDrop);
}

function replaceAt(messages, targets) {
  if (targets.length === 0) return messages;
  const keyed = new Set(targets.map((t) => t.path.join(".")));
  const cloneMessages = messages.map((message, mi) => {
    if (!message || !Array.isArray(message.content)) return message;
    const content = mapBlocks(message.content, [mi, "content"], keyed);
    if (content === message.content) return message;
    return { ...message, content };
  });
  return cloneMessages;
}

function mapBlocks(blocks, path, keyed) {
  let changed = false;
  const next = blocks.map((block, i) => {
    const here = [...path, i];
    if (block?.type === "image" && keyed.has(here.join("."))) {
      changed = true;
      return { type: "text", text: OMITTED_IMAGE_TEXT };
    }
    if (block?.type === "tool-result" && Array.isArray(block.content)) {
      const content = mapBlocks(block.content, [...here, "content"], keyed);
      if (content !== block.content) {
        changed = true;
        return { ...block, content };
      }
    }
    return block;
  });
  return changed ? next : blocks;
}

/**
 * @returns {{ messages, dropped: number, kept: number, total: number, bytesKept: number }}
 */
export function applyImagePolicy(messages, rawPolicy) {
  const policy = normalizePolicy(rawPolicy);
  if (!policy.enabled || !Array.isArray(messages) || messages.length === 0) {
    return { messages, dropped: 0, kept: 0, total: 0, bytesKept: 0, policy };
  }
  const images = collectImages(messages);
  if (images.length === 0) {
    return { messages, dropped: 0, kept: 0, total: 0, bytesKept: 0, policy };
  }
  const drop = dropCount(images, policy);
  const keptImages = images.slice(drop);
  const next = drop === 0 ? messages : replaceAt(messages, images.slice(0, drop));
  return {
    messages: next,
    dropped: drop,
    kept: keptImages.length,
    total: images.length,
    bytesKept: keptImages.reduce((sum, img) => sum + img.bytes, 0),
    policy,
  };
}

export function applyToOptions(options, rawPolicy) {
  if (!options || typeof options !== "object") return options;
  const result = applyImagePolicy(options.messages, rawPolicy);
  if (result.dropped === 0) return options;
  const next = { ...options, messages: result.messages };
  return Object.isFrozen(options) ? Object.freeze(next) : next;
}
