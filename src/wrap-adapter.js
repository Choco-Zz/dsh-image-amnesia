import { applyImagePolicy, normalizePolicy } from "./policy.js";

const ORIG_PREPARE = Symbol.for("dsh-image-amnesia.prepareCall");
const ORIG_STREAM = Symbol.for("dsh-image-amnesia.stream");

export function wrapAdapter(adapter, getPolicy, stats) {
  if (!adapter || typeof adapter !== "object") return;
  if (typeof adapter.prepareCall === "function" && !adapter[ORIG_PREPARE]) {
    const orig = adapter.prepareCall.bind(adapter);
    adapter[ORIG_PREPARE] = orig;
    adapter.prepareCall = async function prepareCall(provider, model, signal) {
      const call = await orig(provider, model, signal);
      if (!call || typeof call.stream !== "function") return call;
      const inner = call.stream.bind(call);
      return {
        ...call,
        stream: (options) => inner(project(options, getPolicy(), stats)),
      };
    };
  }
  if (typeof adapter.stream === "function" && !adapter[ORIG_STREAM]) {
    const origStream = adapter.stream.bind(adapter);
    adapter[ORIG_STREAM] = origStream;
    adapter.stream = function stream(options) {
      return origStream(project(options, getPolicy(), stats));
    };
  }
}

export function unwrapAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") return;
  if (adapter[ORIG_PREPARE]) {
    adapter.prepareCall = adapter[ORIG_PREPARE];
    delete adapter[ORIG_PREPARE];
  }
  if (adapter[ORIG_STREAM]) {
    adapter.stream = adapter[ORIG_STREAM];
    delete adapter[ORIG_STREAM];
  }
}

function project(options, rawPolicy, stats) {
  const policy = normalizePolicy(rawPolicy);
  if (!policy.enabled) return options;
  const result = applyImagePolicy(options && options.messages, policy);
  if (stats && typeof stats.record === "function") stats.record(result);
  if (result.dropped === 0) return options;
  const next = Object.assign({}, options, { messages: result.messages });
  return Object.isFrozen(options) ? Object.freeze(next) : next;
}

export function wrapRuntime(llm, getPolicy, stats, ctx) {
  const wrapped = new Set();
  const wrapExisting = () => {
    const map = llm && llm.adapters;
    if (!map || typeof map.values !== "function") return;
    for (const registration of map.values()) {
      const adapter = registration && registration.adapter;
      if (!adapter || wrapped.has(adapter)) continue;
      wrapAdapter(adapter, getPolicy, stats);
      wrapped.add(adapter);
    }
  };
  wrapExisting();
  const origRegister = typeof llm.registerAdapter === "function" ? llm.registerAdapter.bind(llm) : null;
  if (origRegister) {
    try {
      llm.registerAdapter = (providers, adapter) => {
        wrapAdapter(adapter, getPolicy, stats);
        if (adapter) wrapped.add(adapter);
        return origRegister(providers, adapter);
      };
    } catch {
      // runtime object may be non-writable; adapters-updated still wraps new ones
    }
  }
  const host = ctx || llm.ctx;
  const offUpdated = host && typeof host.on === "function" ? host.on("llm/adapters-updated", wrapExisting) : null;
  return () => {
    if (typeof offUpdated === "function") offUpdated();
    if (origRegister) {
      try { llm.registerAdapter = origRegister; } catch { /* ignore */ }
    }
    for (const adapter of wrapped) unwrapAdapter(adapter);
    wrapped.clear();
  };
}
