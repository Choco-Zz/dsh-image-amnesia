import { DEFAULT_POLICY, normalizePolicy } from "./policy.js";
import { wrapRuntime } from "./wrap-adapter.js";

export const name = "dsh-image-amnesia";
export const inject = ["llm"];
/** Settings namespace in ~/.dsh/settings.yaml. No browser card — a stub client bundle took down the GUI. */
export const NS = "image-amnesia";

async function loadSchemaLib() {
  for (const spec of ["@deepseek-ai/schemastery", "schemastery"]) {
    try {
      const mod = await import(spec);
      return mod.default ?? mod;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function apply(ctx, config = {}) {
  let current = normalizePolicy({ ...DEFAULT_POLICY, ...config });
  let readSource = () => ({ ...DEFAULT_POLICY, ...config });
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

  const refresh = () => {
    try {
      current = normalizePolicy({ ...DEFAULT_POLICY, ...config, ...readSource() });
    } catch {
      current = normalizePolicy({ ...DEFAULT_POLICY, ...config });
    }
  };

  void (async () => {
    try {
      const z = await loadSchemaLib();
      let settings;
      try {
        settings = await import("@deepseek-ai/dsh-settings");
      } catch {
        settings = null;
      }
      if (!z || typeof settings?.installSettingsSection !== "function") return;
      const schema = z.object({
        enabled: z.boolean().default(true),
        maxImages: z.number().step(1).min(1).max(64).default(6),
        maxBytes: z.number().step(1).min(1024).default(6291456),
        keepAtLeast: z.number().step(1).min(1).max(16).default(1),
      });
      settings.installSettingsSection(ctx, settings.settingsNamespace(NS), schema, config, {
        setSource: (source) => {
          readSource = source;
        },
        onChange: refresh,
      });
    } catch (error) {
      ctx.logger?.warn?.("dsh-image-amnesia: settings registration skipped");
      ctx.logger?.debug?.(error);
    }
  })();

  if (typeof ctx.effect === "function") {
    ctx.effect(() => () => disposeWrap(), "dsh-image-amnesia.unwrap");
  }

  ctx.logger?.info?.(
    `dsh-image-amnesia: armed (maxImages=${current.maxImages}, maxBytes=${current.maxBytes}, keepAtLeast=${current.keepAtLeast})`
  );
}
