"use client";

import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Check } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { adsService, adsErrorMessage, type AdSupplier } from "@/services/adsService";
import { AdImage } from "@/components/admin/ads/AdImage";
import { AdError, AdLoading, adButtonClass, adInputClass } from "@/components/admin/ads/AdControls";

const LIMIT = 50;
export function AdSupplierPicker({ supplierId, selected, onSelect, disabled = false }: {
  supplierId: number | null; selected: AdSupplier | null; onSelect: (supplier: AdSupplier | null) => void; disabled?: boolean;
}) {
  const id = useId();
  const userId = useAuthStore((state) => state.user?.id);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({ search: "", page: 0 });
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery({ search: search.trim(), page: 0 }), 350);
    return () => window.clearTimeout(timer);
  }, [search]);
  const results = useQuery({
    queryKey: ["advertising-suppliers", userId, query],
    queryFn: ({ signal }) => adsService.admin.listSuppliers(query.search, query.page * LIMIT, LIMIT, signal),
    enabled: expanded,
    retry: false,
  });
  const searching = search.trim() !== query.search || results.isFetching;
  return <div className="min-w-0 space-y-3 rounded-xl border border-gray-200 p-3">
    <p className="text-sm font-medium text-[#004e28]">Relacionar con proveedor (opcional)</p>
    {supplierId != null && <div className="flex flex-wrap items-center gap-3 rounded-lg bg-[#f2f3f4] p-3">
      {selected?.logo && <AdImage src={selected.logo} className="h-10 w-10" />}
      <div className="min-w-0 flex-1 text-sm"><p className="break-words font-semibold text-[#004e28]">{selected?.name || `Proveedor #${supplierId}`}</p>{selected && <p className="text-xs text-gray-500">{[selected.city, selected.state].filter(Boolean).join(", ")}</p>}</div>
      <button type="button" disabled={disabled} className={adButtonClass} onClick={() => onSelect(null)}>Quitar relación</button>
    </div>}
    <button type="button" disabled={disabled} className={adButtonClass} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><Search size={16} />{expanded ? "Cerrar buscador" : supplierId ? "Cambiar proveedor" : "Buscar proveedor"}</button>
    {expanded && <div className="space-y-3">
      <label htmlFor={id} className="block text-sm text-gray-600">Nombre del negocio</label>
      <input id={id} maxLength={255} type="search" value={search} disabled={disabled} onChange={(event) => setSearch(event.target.value)} placeholder="Escribe para buscar" className={adInputClass} />
      {searching ? <AdLoading>Buscando proveedores...</AdLoading> : results.isError ? <AdError message={adsErrorMessage(results.error)} retry={() => void results.refetch()} />
        : !results.data?.length ? <p className="text-sm text-gray-500">No se encontraron proveedores.</p>
        : <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
          {results.data.map((supplier) => <button type="button" key={supplier.id} disabled={disabled} aria-pressed={supplier.id === supplierId} onClick={() => { onSelect(supplier); setExpanded(false); }} className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left focus-visible:ring-2 focus-visible:ring-[#168e00] ${supplier.id === supplierId ? "border-[#168e00] bg-green-50" : "border-gray-200"}`}>
            {supplier.logo && <AdImage src={supplier.logo} className="h-10 w-10 shrink-0" />}
            <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold text-[#004e28]">{supplier.name}</span><span className="text-xs text-gray-500">{[supplier.city, supplier.state].filter(Boolean).join(", ")}</span></span>{supplier.id === supplierId && <Check size={18} className="shrink-0 text-[#168e00]" />}
          </button>)}
        </div>}
      <div className="flex items-center justify-between gap-2"><button type="button" disabled={disabled || searching || !query.page} className={adButtonClass} onClick={() => setQuery((previous) => ({ ...previous, page: previous.page - 1 }))}>Anterior</button><span className="text-xs text-gray-500">Página {query.page + 1}</span><button type="button" disabled={disabled || searching || results.isError || results.data?.length !== LIMIT} className={adButtonClass} onClick={() => setQuery((previous) => ({ ...previous, page: previous.page + 1 }))}>Siguiente</button></div>
    </div>}
  </div>;
}
