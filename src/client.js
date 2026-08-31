// Browser card for 设置 → 插件 → 插件配置.
// Lazy-CJS factory: no build step. Key MUST equal host settings namespace `image-amnesia`.
window.__ModuleLoader__.load({
  id: "dsh-image-amnesia",
  factory: (require) => {
    var module = { exports: {} };
    var React = require("react");
    var jsx = require("react/jsx-runtime");
    var NS = "image-amnesia";

    function fieldStyle() {
      return {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "12px 0",
        borderTop: "1px solid var(--dsw-alias-border-l2)",
      };
    }
    function inputStyle() {
      return {
        border: "1px solid var(--dsw-alias-border-l2)",
        background: "var(--dsw-alias-bg-layer-3)",
        color: "var(--dsw-alias-label-primary)",
        height: "34px",
        borderRadius: "8px",
        padding: "0 12px",
        fontSize: "13px",
      };
    }
    function labelStyle() {
      return { color: "var(--dsw-alias-label-primary)", fontSize: "13px", fontWeight: 500 };
    }
    function hintStyle() {
      return { color: "var(--dsw-alias-label-tertiary)", margin: 0, fontSize: "12px" };
    }

    function apply(ctx) {
      if (!ctx || !ctx.slots || typeof ctx.slots.inject !== "function") return;
      var scope = ctx.settingsScope && typeof ctx.settingsScope.bind === "function"
        ? ctx.settingsScope.bind({ namespace: NS })
        : null;

      function Card() {
        var snap = scope
          ? React.useSyncExternalStore(
              function (cb) { return scope.subscribe(cb); },
              function () { return scope.getSnapshot(); }
            )
          : { value: {}, writable: false };
        var value = (snap && snap.value) || {};
        var writable = !!(snap && snap.writable);
        var maxImages = value.maxImages == null ? 6 : value.maxImages;
        var maxBytes = value.maxBytes == null ? 6291456 : value.maxBytes;
        var keepAtLeast = value.keepAtLeast == null ? 1 : value.keepAtLeast;
        var enabled = value.enabled !== false;

        function setNumber(field, raw) {
          var n = Number(raw);
          if (!scope || !writable || !Number.isFinite(n)) return;
          scope.set(field, Math.trunc(n));
        }

        return jsx.jsxs("section", {
          style: {
            border: "1px solid var(--dsw-alias-border-l2)",
            borderRadius: "12px",
            padding: "16px 18px",
            background: "var(--dsw-alias-bg-layer-2, transparent)",
          },
          children: [
            jsx.jsx("h3", {
              style: { margin: "0 0 4px", fontSize: "15px", fontWeight: 600 },
              children: "Image amnesia",
            }),
            jsx.jsx("p", {
              style: { margin: "0 0 8px", color: "var(--dsw-alias-label-tertiary)", fontSize: "12px" },
              children: "发往中转站时最多留几张图。本地会话里的原图不会删。",
            }),
            jsx.jsxs("label", {
              style: fieldStyle(),
              children: [
                jsx.jsx("span", { style: labelStyle(), children: "启用" }),
                jsx.jsx("input", {
                  type: "checkbox",
                  checked: enabled,
                  disabled: !writable,
                  onChange: function (event) {
                    if (scope && writable) scope.set("enabled", event.target.checked);
                  },
                }),
              ],
            }),
            jsx.jsxs("label", {
              style: fieldStyle(),
              children: [
                jsx.jsx("span", { style: labelStyle(), children: "maxImages（最多留几张图）" }),
                jsx.jsx("p", { style: hintStyle(), children: "默认 6。只要最新几张给模型看，就改这个数。" }),
                jsx.jsx("input", {
                  type: "number",
                  min: 1,
                  max: 64,
                  step: 1,
                  value: maxImages,
                  disabled: !writable,
                  style: inputStyle(),
                  onChange: function (event) { setNumber("maxImages", event.target.value); },
                }),
              ],
            }),
            jsx.jsxs("label", {
              style: fieldStyle(),
              children: [
                jsx.jsx("span", { style: labelStyle(), children: "maxBytes（留下的图合计字节）" }),
                jsx.jsx("input", {
                  type: "number",
                  min: 1024,
                  step: 1,
                  value: maxBytes,
                  disabled: !writable,
                  style: inputStyle(),
                  onChange: function (event) { setNumber("maxBytes", event.target.value); },
                }),
              ],
            }),
            jsx.jsxs("label", {
              style: fieldStyle(),
              children: [
                jsx.jsx("span", { style: labelStyle(), children: "keepAtLeast（至少留最新几张）" }),
                jsx.jsx("input", {
                  type: "number",
                  min: 1,
                  max: 16,
                  step: 1,
                  value: keepAtLeast,
                  disabled: !writable,
                  style: inputStyle(),
                  onChange: function (event) { setNumber("keepAtLeast", event.target.value); },
                }),
              ],
            }),
          ],
        });
      }

      ctx.slots.inject("settings.plugin.item", function () {
        return ctx.slots.register({ name: "settings.plugin.item", key: NS }, Card);
      });
    }

    module.exports.apply = apply;
    module.exports.inject = ["slots"];
    return module.exports;
  },
});
