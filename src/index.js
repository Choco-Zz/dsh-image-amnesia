import { DEFAULT_POLICY, normalizePolicy } from "./policy.js";
import { wrapRuntime } from "./wrap-adapter.js";

export const name = "dsh-image-amnesia";
export const inject = ["llm"];

function fallbackConfig() {
  return {
    enabled: true,
    maxImages: 1,
    maxBytes: 2097152,
    keepAtLeast: 1,
  };
}

async function loadSchema() {
  try {
    const mod = await import("@deepseek-ai/schemastery");
    const z = mod.default ?? mod;
    return z.object({
      enabled: z.boolean().default(true),
      maxImages: z.number().step(1).min(1).max(64).default(1),
      maxBytes: z.number().step(1).min(1024).default(2097152),
      keepAtLeast: z.number().step(1).min(1).max(16).default(1),
    });
  } catch {
    return null;
  }
}

export function apply(ctx, config = {}) {
  let current = normalizePolicy({ ...DEFAULT_POLICY, ...config });
  const stats = {
    last: null,
    record(result) {
      this.last = {
        dropped: result.dropped,
        kept: result.kept,
        total: result.total,
        bytesKept: result.bytesKept,
        at: Date.now(),
      };
      if (result.dropped > 0) {
        ctx.logger?.info?.(
          `dsh-image-amnesia: dropped ${result.dropped}/${result.total} image(s); kept ${result.kept} (${result.bytesKept} bytes)`
        );
      }
    },
  };

  const disposeWrap = wrapRuntime(ctx.llm, () => current, stats, ctx);

  const wireSettings = async (schema) => {
    if (!schema) return;
    try {
      const settings = await import("@deepseek-ai/dsh-settings");
      if (typeof settings.installSettingsSection !== "function") return;
      const ns = typeof settings.settingsNamespace === "function"
        ? settings.settingsNamespace(name)
        : name;
      settings.installSettingsSection(ctx, ns, schema, config, {
        setSource: (source) => {
          try {
            current = normalizePolicy({ ...DEFAULT_POLICY, ...config, ...source() });
          } catch {
            current = normalizePolicy({ ...DEFAULT_POLICY, ...config });
          }
        },
        onChange: () => {},
      });
    } catch (error) {
      ctx.logger?.debug?.("dsh-image-amnesia: settings section skipped");
      ctx.logger?.debug?.(error);
    }
  };

  const attachSettings = (schema) => {
    if (typeof ctx.inject === "function") {
      try {
        ctx.inject(["settings"], () => { void wireSettings(schema); });
        return;
      } catch { /* settings not in this profile */ }
    }
    void wireSettings(schema);
  };
  void loadSchema().then(attachSettings);

  if (typeof ctx.effect === "function") {
    ctx.effect(() => () => disposeWrap(), "dsh-image-amnesia.unwrap");
  }

  ctx.logger?.info?.(
    `dsh-image-amnesia: armed (maxImages=${current.maxImages}, maxBytes=${current.maxBytes}, keepAtLeast=${current.keepAtLeast})`
  );
}

export { fallbackConfig as defaultConfig };
