import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/src/components/agenda/AgendaRefundStatus.tsx")) {
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});

const { default: AgendaRefundStatus } = await import("../src/components/agenda/AgendaRefundStatus.tsx");
const base = {
  id: 7,
  booking_id: 4,
  payment_id: 3,
  mp_payment_id: "private-mp-id",
  amount: 500,
  currency: "MXN",
  method: "online",
  status: "confirmed",
  reason: null,
  initiated_by: "provider",
  requested_at: "2026-10-08T12:00:00Z",
  confirmed_at: "2026-10-08T12:10:00Z",
  last_checked_at: null,
  last_error: "private-error",
  manual_reference: null,
  confirmed_by_user_id: null,
};
const render = (refund, compact = false) => renderToStaticMarkup(React.createElement(AgendaRefundStatus, { refund, compact }));

test("cada devolución indica su tipo incluso en la tarjeta compacta", () => {
  const primary = render({ ...base, refund_type: "primary" }, true);
  const additional = render({ ...base, refund_type: "additional" }, true);
  const unknown = render({ ...base, refund_type: "unknown" }, true);
  assert.match(primary, /Reembolso del servicio/);
  assert.match(primary, /El pago principal de esta reservación fue reembolsado/);
  assert.match(additional, /Devolución de cobro adicional/);
  assert.match(additional, /Esta operación no modifica por sí sola el pago principal/);
  assert.match(unknown, />Devolución</);
  assert.doesNotMatch(unknown, /Reembolso del servicio/);
  for (const html of [primary, additional, unknown]) {
    assert.doesNotMatch(html, /private-mp-id|private-error/);
  }
});

test("una respuesta antigua sin refund_type se presenta como desconocida", () => {
  const html = render({ ...base, refund_type: undefined });
  assert.match(html, />Devolución</);
  assert.doesNotMatch(html, /pago principal de esta reservación fue reembolsado/);
});
