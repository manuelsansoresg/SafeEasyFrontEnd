"use client";

export function DemoActionButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.alert("Esta es una demostración. No se pueden realizar compras, pedidos ni reservaciones reales.")}
      className="rounded-full supplier-surface-primary bg-[var(--supplier-primary-action,#168e00)] px-5 py-2.5 text-sm font-semibold text-[color:var(--supplier-on-primary,#ffffff)] transition hover:bg-[var(--supplier-primary-hover,#137a00)]">
      {label}
    </button>
  );
}
