import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyImagePolicy, collectImages, normalizePolicy, OMITTED_IMAGE_TEXT } from "../src/policy.js";
import { wrapAdapter, unwrapAdapter } from "../src/wrap-adapter.js";

function img(id, bytes) {
  return { type: "image", attachment: { attachmentId: id, bytes } };
}

function user(...content) {
  return { role: "user", content };
}

describe("normalizePolicy", () => {
  it("clamps and defaults", () => {
    const p = normalizePolicy({ maxImages: 0, maxBytes: 10, keepAtLeast: 99, enabled: false });
    assert.equal(p.enabled, false);
    assert.equal(p.maxImages, 1);
    assert.equal(p.maxBytes, 1024);
    assert.equal(p.keepAtLeast, 1);
  });
  it("keepAtLeast cannot exceed maxImages", () => {
    const p = normalizePolicy({ maxImages: 2, keepAtLeast: 8 });
    assert.equal(p.keepAtLeast, 2);
  });
});

describe("applyImagePolicy", () => {
  it("is a no-op without images", () => {
    const messages = [user({ type: "text", text: "hi" })];
    const out = applyImagePolicy(messages, { maxImages: 1 });
    assert.equal(out.dropped, 0);
    assert.equal(out.messages, messages);
  });

  it("keeps the newest image and drops older ones", () => {
    const messages = [
      user(img("a", 100), { type: "text", text: "first" }),
      user(img("b", 100), { type: "text", text: "second" }),
      user(img("c", 100), { type: "text", text: "third" }),
    ];
    const out = applyImagePolicy(messages, { maxImages: 1, maxBytes: 10_000_000 });
    assert.equal(out.total, 3);
    assert.equal(out.dropped, 2);
    assert.equal(out.kept, 1);
    assert.equal(out.messages[0].content[0].type, "text");
    assert.equal(out.messages[0].content[0].text, OMITTED_IMAGE_TEXT);
    assert.equal(out.messages[1].content[0].type, "text");
    assert.equal(out.messages[2].content[0].type, "image");
    assert.equal(out.messages[2].content[0].attachment.attachmentId, "c");
    assert.notEqual(out.messages, messages);
  });

  it("walks nested tool-result images", () => {
    const messages = [
      {
        role: "tool",
        content: [
          { type: "tool-result", toolCallId: "1", content: [img("old", 50)] },
        ],
      },
      user(img("new", 50)),
    ];
    const out = applyImagePolicy(messages, { maxImages: 1, maxBytes: 10_000_000 });
    assert.equal(out.dropped, 1);
    assert.equal(messages[0].content[0].content[0].type, "image");
    assert.equal(out.messages[0].content[0].content[0].type, "text");
    assert.equal(out.messages[1].content[0].type, "image");
  });

  it("never drops the newest keepAtLeast image even when over maxBytes", () => {
    const messages = [user(img("huge", 9_000_000))];
    const out = applyImagePolicy(messages, { maxImages: 1, maxBytes: 1000, keepAtLeast: 1 });
    assert.equal(out.dropped, 0);
    assert.equal(out.kept, 1);
    assert.equal(out.messages[0].content[0].type, "image");
  });

  it("drops extra images to satisfy maxBytes while keeping one", () => {
    const messages = [user(img("a", 800), img("b", 800), img("c", 800))];
    const out = applyImagePolicy(messages, { maxImages: 8, maxBytes: 900, keepAtLeast: 1 });
    assert.equal(out.dropped, 2);
    assert.equal(out.kept, 1);
    assert.equal(out.messages[0].content[2].type, "image");
    assert.equal(out.messages[0].content[0].type, "text");
  });

  it("does not mutate the original messages array", () => {
    const messages = [user(img("a", 10), img("b", 10))];
    const snapshot = JSON.stringify(messages);
    applyImagePolicy(messages, { maxImages: 1, maxBytes: 10_000_000 });
    assert.equal(JSON.stringify(messages), snapshot);
  });

  it("collects in request order", () => {
    const messages = [user(img("a", 1)), user(img("b", 1))];
    const ids = collectImages(messages).map((x) => {
      const block = messages[x.path[0]].content[x.path[2]];
      return block.attachment.attachmentId;
    });
    assert.deepEqual(ids, ["a", "b"]);
  });
});

describe("wrapAdapter", () => {
  it("projects images on prepareCall.stream without mutating frozen options", async () => {
    const seen = [];
    const adapter = {
      async prepareCall() {
        return {
          model: { id: "x" },
          stream(options) {
            seen.push(options);
            return { ok: true, count: options.messages.length };
          },
        };
      },
    };
    wrapAdapter(adapter, () => ({ maxImages: 1, maxBytes: 10_000_000 }), { record() {} });
    const call = await adapter.prepareCall("p", "m");
    const frozen = Object.freeze({
      provider: "p",
      model: "m",
      messages: Object.freeze([
        Object.freeze(user(img("old", 10))),
        Object.freeze(user(img("new", 10))),
      ]),
    });
    const result = call.stream(frozen);
    assert.equal(result.ok, true);
    assert.equal(frozen.messages[0].content[0].type, "image");
    assert.equal(seen[0].messages[0].content[0].type, "text");
    assert.equal(seen[0].messages[1].content[0].type, "image");
    assert.ok(Object.isFrozen(seen[0]));
    unwrapAdapter(adapter);
  });
});
