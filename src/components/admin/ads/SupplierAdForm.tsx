"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Search } from "lucide-react";
import { adsService, adsErrorMessage, AdsRequestError, type AdSupplier } from "@/services/adsService";
import { AdImage } from "@/components/admin/ads/AdImage";

const LIMIT = 50;
const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#168e00]";
const buttonClass = "rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:opacity-50";

export function SupplierAdForm({ onCreated }: { onCreated: () => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({ search: "", page: 0 });
  const [supplier, setSupplier] = useState<AdSupplier | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [order, setOrder] = useState("0");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery({ search: search.trim(), page: 0 }), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const suppliers = useQuery({
    queryKey: ["ad-suppliers", query],
    queryFn: ({ signal }) => adsService.listSuppliers(query.search, query.page * LIMIT, LIMIT, signal),
    retry: false,
  });
  const images = useQuery({
    queryKey: ["ad-supplier-images", supplier?.id],
    queryFn: ({ signal }) => adsService.getSupplierImages(supplier!.id, signal),
    enabled: supplier !== null,
    retry: false,
  });
  // Only SupplierCarousel image fields are used; header/video settings are never consulted.
  const gallery = images.data?.filter((item) => {
    const original = item.image || item.image_movil;
    return original && !/\.(mp4|webm|mov|m4v|avi|mkv|ogv)(?:[?#]|$)/i.test(original);
  }) || [];
  const selected = gallery.find((item) => item.id === selectedId);
  const searching = search.trim() !== query.search || suppliers.isFetching;

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current || !selected || selected.is_selected || images.isFetching) return;
    const displayOrder = Number(order);
    if (!Number.isSafeInteger(displayOrder) || displayOrder < 0) {
      setError("El orden debe ser un número entero mayor o igual a cero.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await adsService.createFromSupplier({ supplier_carousel_id: selected.id, display_order: displayOrder, is_active: active });
      setSelectedId(null);
      setOrder("0");
      setActive(true);
      void queryClient.invalidateQueries({ queryKey: ["ad-supplier-images"] });
      onCreated();
    } catch (cause) {
      setError(adsErrorMessage(cause));
      if (cause instanceof AdsRequestError && [404, 409].includes(cause.status)) {
        void images.refetch();
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return <form onSubmit={save} className="space-y-5">
    <fieldset disabled={saving} className="min-w-0 space-y-5 disabled:opacity-70">
      <div className="space-y-2">
        <label htmlFor="ad-supplier-search" className="text-sm font-medium text-[#004e28]">1. Busca y selecciona un proveedor</label>
        <div className="relative"><Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <input id="ad-supplier-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre del negocio" className={`${inputClass} pl-10`} />
        </div>
        {searching ? <p role="status" className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" />Buscando proveedores...</p>
          : suppliers.isError ? <p role="alert" className="text-sm text-red-700">{adsErrorMessage(suppliers.error)} <button type="button" className="underline" onClick={() => void suppliers.refetch()}>Reintentar</button></p>
          : suppliers.data?.length === 0 ? <p className="text-sm text-gray-500">No se encontraron proveedores.</p>
          : <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2" aria-label="Proveedores encontrados">
            {suppliers.data?.map((item) => <button key={item.id} type="button" aria-pressed={supplier?.id === item.id}
              onClick={() => { setSupplier(item); setSelectedId(null); setError(null); }}
              className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left focus-visible:ring-2 focus-visible:ring-[#168e00] ${supplier?.id === item.id ? "border-[#168e00] bg-green-50" : "border-gray-200 hover:bg-gray-50"}`}>
              {item.logo ? <AdImage src={item.logo} className="h-10 w-10 shrink-0" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f2f3f4] text-[#004e28]">{item.name.charAt(0)}</span>}
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold text-[#004e28]">{item.name}</span><span className="block text-xs text-gray-500">{[item.city, item.state].filter(Boolean).join(", ")}</span></span>
              {supplier?.id === item.id && <Check size={18} className="shrink-0 text-[#168e00]" />}
            </button>)}
          </div>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className={buttonClass} disabled={!query.page || searching} onClick={() => setQuery((previous) => ({ ...previous, page: previous.page - 1 }))}>Anterior</button>
          <span className="text-xs text-gray-500">Página {query.page + 1} de proveedores</span>
          <button type="button" className={buttonClass} disabled={searching || suppliers.isError || suppliers.data?.length !== LIMIT} onClick={() => setQuery((previous) => ({ ...previous, page: previous.page + 1 }))}>Siguiente</button>
        </div>
      </div>
      {supplier && <section className="space-y-3" aria-label="Imágenes del proveedor">
        <h3 className="text-sm font-semibold text-[#004e28]">2. Elige una imagen de {supplier.name}</h3>
        <p className="text-xs text-gray-500">Las imágenes con la etiqueta «Ya agregada» pertenecen a la administración de anuncios, incluso si están desactivadas.</p>
        {images.isFetching ? <p role="status" className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" />Cargando imágenes...</p>
          : images.isError ? <p role="alert" className="text-sm text-red-700">{adsErrorMessage(images.error)} <button type="button" className="underline" onClick={() => void images.refetch()}>Reintentar</button></p>
          : !gallery.length ? <p className="rounded-xl bg-[#f2f3f4] p-4 text-sm">Este proveedor todavía no tiene imágenes disponibles para publicar como anuncios.</p>
          : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((item) => <button type="button" key={item.id} disabled={item.is_selected} aria-pressed={selectedId === item.id} aria-label={`${item.title || `Imagen ${item.id}`}${item.is_selected ? ": Ya agregada" : ""}`}
              onClick={() => { setSelectedId(item.id); setError(null); }} className={`space-y-2 rounded-xl border-2 p-2 text-left focus-visible:ring-2 focus-visible:ring-[#168e00] disabled:cursor-not-allowed ${selectedId === item.id ? "border-[#168e00] bg-green-50" : "border-gray-100"}`}>
              <AdImage src={item.thumbnail || item.thumbnail_movil} fallback={item.image || item.image_movil} alt={item.title || "Imagen del proveedor"} />
              <span className="flex items-center justify-between gap-2 text-sm"><span className="break-words">{item.title || `Imagen ${item.id}`}</span><span className={`shrink-0 text-xs font-semibold ${item.is_selected ? "text-gray-500" : "text-[#168e00]"}`}>{item.is_selected ? "Ya agregada" : selectedId === item.id ? "Seleccionada ✓" : "Seleccionar"}</span></span>
            </button>)}
          </div>}
      </section>}
      {selected && <section className="space-y-3 rounded-xl bg-[#f2f3f4] p-4" aria-label="Vista previa del anuncio">
        <h3 className="text-sm font-semibold text-[#004e28]">Vista previa</h3>
        <AdImage src={selected.image || selected.image_movil} alt={selected.title || "Anuncio seleccionado"} className="max-h-72 w-full" />
        {selected.image && selected.image_movil && <><p className="text-xs text-gray-600">Versión móvil</p><AdImage src={selected.image_movil} alt="Versión móvil" className="max-h-48 w-full" /></>}
      </section>}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1"><label htmlFor="supplier-ad-order" className="text-sm font-medium">Orden de aparición</label><input id="supplier-ad-order" type="number" min="0" step="1" required value={order} onChange={(event) => setOrder(event.target.value)} className={inputClass} /></div>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="accent-[#168e00]" />Anuncio activo</label>
      </div>
    </fieldset>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <button type="submit" disabled={saving || !selected || selected.is_selected || images.isFetching || images.isError} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#168e00] px-4 py-2 text-sm font-medium text-white hover:bg-[#004e28] disabled:cursor-not-allowed disabled:opacity-50">
      {saving && <Loader2 size={16} className="animate-spin" />}{saving ? "Guardando..." : "Guardar anuncio de proveedor"}
    </button>
  </form>;
}
