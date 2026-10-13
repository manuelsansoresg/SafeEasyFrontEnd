"use client";

export function DemoActionButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.alert("Esta es una demostración. No se pueden realizar compras, pedidos ni reservaciones reales.")}
      className="rounded-full bg-[#168e00] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#137a00]">
      {label}
    </button>
  );
}
