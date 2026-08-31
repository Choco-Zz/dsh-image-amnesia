import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apply } from "../src/index.js";
import { wrapRuntime } from "../src/wrap-adapter.js";

function img(id, bytes) {
  return { type: "image", attachment: { attachmentId: id, bytes } };
}
function user(...content) {
  return { role: "user", content };
}
function frozenRequest() {
  return Object.freeze({
    provider: "sui",
    model: "grok-4.6",
    messages: Object.freeze([
      Object.freeze(user(img("old", 10))),
      Object.freeze(user(img("new", 10))),
    ]),
  });
}

describe("wrapRuntime", () => {
  it("wraps adapters already registered and adapters registered later", async () => {
    const seen = [];
    const existing = {
      async prepareCall() {
        return {
          stream(options) { seen.push(["existing", options]); return { ok: true }; },
        };
      },
    };
    const llm = {
      adapters: new Map([["sui", { adapter: existing }]]),
      registerAdapter(providers, adapter) {
        this.adapters.set(providers[0], { adapter });
        return () => {};
      },
    };
    const dispose = wrapRuntime(llm, () => ({ maxImages: 1, maxBytes: 10_000_000 }), { record() {} });
    const later = {
      async prepareCall() {
        return {
          stream(options) { seen.push(["later", options]); return { ok: true }; },
        };
      },
    };
    llm.registerAdapter(["openai"], later);
    const req = frozenRequest();
    (await existing.prepareCall()).stream(req);
    (await later.prepareCall()).stream(req);
    assert.equal(req.messages[0].content[0].type, "image");
    assert.equal(seen.length, 2);
    assert.equal(seen[0][1].messages[0].content[0].type, "text");
    assert.equal(seen[1][1].messages[1].content[0].attachment.attachmentId, "new");
    dispose();
    const after = [];
    existing.prepareCall = async () => ({ stream(options) { after.push(options); } });
    (await existing.prepareCall()).stream(req);
    assert.equal(after[0], req);
  });
});

describe("apply", () => {
  it("arms on a mock llm and logs the policy", async () => {
    const logs = [];
    const seen = [];
    const adapter = {
      async prepareCall() {
        return { stream(options) { seen.push(options); return { ok: true }; } };
      },
    };
    const llm = {
      adapters: new Map([["sui", { adapter }]]),
      registerAdapter() { return () => {}; },
    };
    const effects = [];
    apply({
      llm,
      logger: { info: (m) => logs.push(m), debug() {}, warn() {} },
      effect(fn) { effects.push(fn); },
    }, { maxImages: 1 });
    assert.match(logs[0], /dsh-image-amnesia: armed/);

    await (await adapter.prepareCall()).stream(frozenRequest());
    assert.equal(seen[0].messages[0].content[0].type, "text");
    assert.equal(seen[0].messages[1].content[0].type, "image");
    const disposer = effects[0]();
    disposer();
  });
});
