"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Check, Facebook, Loader2, Sparkles } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { resolveCurrentSupplier } from "@/lib/currentSupplier";
import { importRequest, connectionPath, FacebookImportError, type Connection, type FacebookPage, type Preview, type ImportFields, type FieldKey, type Proposal, type Crop, type ImageChoice, type BusinessHour } from "@/services/facebookImportService";
import { ImportImage } from "@/components/admin/facebook/ImportImage";

const KEY = "facebook-import-connection";
const labels: Record<FieldKey, string> = { name: "Nombre del negocio", short_description: "Descripción corta", description: "Descripción completa", title_about: "Título de Sobre nosotros", subtitle_about: "Subtítulo de Sobre nosotros", about: "Sobre nosotros", phone: "Teléfono", address: "Dirección", country: "País", state: "Estado", city: "Ciudad", cp: "Código postal", latitude: "Latitud", longitude: "Longitud", facebook_url: "Facebook" };
const textKeys: FieldKey[] = ["name", "short_description", "description", "title_about", "subtitle_about", "about"];
const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const input = "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-[#168e00] focus:outline-none focus:ring-2 focus:ring-[#168e00]/20";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#004e28]/20 px-4 py-2.5 text-sm font-semibold text-[#004e28] transition hover:bg-[#f2f3f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00] disabled:cursor-not-allowed disabled:opacity-50";
const primary = button + " bg-[#004e28] text-white hover:bg-[#168e00]";
function plain(text: string) {
  const doc = new DOMParser().parseFromString(text, "text/html");
  return doc.body.textContent || "";
}
function normalizeFields(fields: ImportFields): ImportFields {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, typeof value === "string" ? plain(value) : value]));
}
function fieldLimit(key: FieldKey) {
  if (key === "description" || key === "about") return 20000;
  if (key === "facebook_url") return 500;
  if (key === "phone") return 20;
  if (key === "cp") return 10;
  if (["country", "state", "city"].includes(key)) return 100;
  return 255;
}

export default function FacebookImportFlow() {
  const user = useAuthStore(state => state.user);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [pages, setPages] = useState<FacebookPage[] | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState<ImportFields>({});
  const [selected, setSelected] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [proposal, setProposal] = useState<ImportFields | null>(null);
  const [reviewed, setReviewed] = useState<ImportFields | null>(null);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [hourDays, setHourDays] = useState<number[]>([]);
  const [logo, setLogo] = useState<ImageChoice>({ action: "keep" });
  const [banner, setBanner] = useState<ImageChoice>({ action: "keep" });
  const [busy, setBusy] = useState("Preparando importación…");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(false);
  const mounted = useRef(true);
  const locked = useRef(false);
  const aiAction = useRef<{ key: string; body: string } | null>(null);
  const aiController = useRef<AbortController | null>(null);
  const generation = useRef(0);

  async function loadConnection(id: string) {
    const state = await importRequest<Connection>(connectionPath(id));
    if (!mounted.current) return;
    setConnection(state);
    if (state.status === "confirmed") { sessionStorage.removeItem(KEY); setDone(true); return; }
    if (state.status !== "connected") {
      setExpired(true);
      throw new Error(({ pending: "La autorización no terminó. Vuelve a conectar Facebook.", processing: "Facebook sigue procesando la autorización. Comprueba el estado en unos segundos.", cancelled: "Cancelaste la autorización. Puedes volver a conectar Facebook.", denied: "Facebook no concedió los permisos necesarios. Autoriza la página al reconectar.", expired: "La conexión venció. Vuelve a conectar Facebook." } as Record<string, string>)[state.status] || "No se pudo completar la conexión con Facebook.");
    }
    const result = await importRequest<{ pages: FacebookPage[]; diagnostic: { code: string } }>(connectionPath(id) + "/pages");
    if (mounted.current) {
      setPages(result.pages);
      if (!result.pages.length) setNotice("No encontramos páginas autorizadas. Comprueba tu acceso a la página en Facebook y vuelve a conectar seleccionándola y aceptando ambos permisos.");
    }
  }

  useEffect(() => {
    mounted.current = true;
    const id = sessionStorage.getItem(KEY);
    if (!id) { setBusy(""); return; }
    void loadConnection(id).catch(e => { if (mounted.current) { setError(e.message); setExpired(true); } }).finally(() => { if (mounted.current) setBusy(""); });
    return () => { mounted.current = false; aiController.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!connection || done) return;
    const remaining = Date.parse(connection.expires_at) - Date.now();
    const timer = setTimeout(() => { setExpired(true); setError("La conexión venció. Tus revisiones permanecen aquí; cópialas antes de volver a conectar."); }, Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [connection, done]);

  async function run(label: string, work: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(label); setError("");
    try { await work(); } catch (e) {
      if (mounted.current) {
        if (!(e instanceof Error && e.name === "AbortError")) { setError(e instanceof Error ? e.message : "No se pudo completar la operación."); window.scrollTo({ top: 0, behavior: "smooth" }); }
        if (e instanceof FacebookImportError && e.code.startsWith("ai_") && !["ai_generation_in_progress", "ai_idempotency_conflict"].includes(e.code)) aiAction.current = null;
        if (e instanceof FacebookImportError && [404, 410].includes(e.status)) setExpired(true);
      }
    } finally { locked.current = false; if (mounted.current) setBusy(""); }
  }

  function connect() {
    void run("Conectando con Facebook…", async () => {
      if (window.location.protocol !== "https:") throw new Error("Abre Drooopy con HTTPS para conectar Facebook de forma segura.");
      if (connection && connection.status !== "confirmed") await importRequest(connectionPath(connection.connection_id), { method: "DELETE" }).catch(() => {});
      const queryId = Number(new URLSearchParams(window.location.search).get("supplier_id"));
      const supplierId = Number.isSafeInteger(queryId) && queryId > 0 ? queryId : (await resolveCurrentSupplier(user))?.id;
      if (!supplierId) throw new Error("No encontramos tu empresa. Regresa a Mi negocio e intenta otra vez.");
      const result = await importRequest<{ connection_id: string; authorization_url: string }>(`?supplier_id=${supplierId}`, { method: "POST" });
      const url = new URL(result.authorization_url);
      if (url.protocol !== "https:" || !["www.facebook.com", "facebook.com"].includes(url.hostname)) throw new Error("La dirección de autorización no es válida.");
      sessionStorage.setItem(KEY, result.connection_id);
      window.location.assign(url.href);
    });
  }

  function choosePage(page: FacebookPage) {
    if (!connection) return;
    void run("Preparando datos e imágenes…", async () => {
      const result = await importRequest<Preview>(connectionPath(connection.connection_id) + `/pages/${encodeURIComponent(page.id)}/preview`, { method: "POST" });
      if (!mounted.current) return;
      const fields = normalizeFields(result.fields);
      setPreview(result); setDraft(fields); setSelected(Object.fromEntries(Object.keys(fields).map(key => [key, ["latitude", "longitude"].includes(key) ? !result.current_map_location : !result.current[key as FieldKey]])));
      setProposal(null); setReviewed(null); aiAction.current = null;
      setHours(result.business_hours); setHourDays([]);
      setLogo({ action: result.current_images.logo ? "keep" : result.images.logo ? "import" : "keep" });
      setBanner({ action: result.current_images.banner ? "keep" : result.images.banner ? "import" : "keep" });
      setNotice("");
    });
  }

  function improve() {
    if (!connection || !preview) return;
    void run("Mejorando textos…", async () => {
      const reviewedTexts = Object.fromEntries(textKeys.filter(key => typeof draft[key] === "string").map(key => [key, draft[key]]));
      const body = JSON.stringify({ preview_id: preview.preview_id, reviewed_texts: reviewedTexts });
      if (!aiAction.current || aiAction.current.body !== body) aiAction.current = { key: crypto.randomUUID(), body };
      const action = aiAction.current;
      const controller = new AbortController();
      aiController.current = controller;
      const version = ++generation.current;
      for (let attempt = 0; attempt < 60; attempt++) {
        const result = await importRequest<Proposal>(connectionPath(connection.connection_id) + "/text-proposals", { method: "POST", headers: { "Idempotency-Key": action.key }, body: action.body, signal: controller.signal });
        if (!mounted.current || version !== generation.current) return;
        if (result.status === "processing") {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => { controller.signal.removeEventListener("abort", abort); resolve(); }, Math.max(2, Math.min(30, result.retry_after_seconds || 2)) * 1000);
            function abort() { clearTimeout(timer); reject(new DOMException("Cancelado", "AbortError")); }
            controller.signal.addEventListener("abort", abort, { once: true });
            if (controller.signal.aborted) abort();
          });
          continue;
        }
        if (result.status !== "succeeded" || !result.proposal) {
          aiAction.current = null;
          throw new Error("No se pudo generar una propuesta. Puedes conservar los originales o volver a intentarlo.");
        }
        await importRequest<Connection>(connectionPath(connection.connection_id));
        setReviewed({ ...draft }); setProposal(result.proposal);
        setNotice("Propuesta lista. Elige qué texto usar en cada campo; los datos aún no se han guardado.");
        return;
      }
      throw new Error("La mejora sigue pendiente. Pulsa de nuevo para consultar el resultado sin generar otra solicitud.");
    });
  }

  function toggle(key: FieldKey, checked: boolean) {
    setSelected(previous => ({ ...previous, [key]: checked, ...(["latitude", "longitude"].includes(key) ? { latitude: checked, longitude: checked } : {}) }));
  }
  function save() {
    if (!connection || !preview) return;
    void run("Guardando en tu negocio…", async () => {
      for (const key of Object.keys(draft) as FieldKey[]) {
        if (!selected[key]) continue;
        const value = draft[key];
        if (typeof value === "string" && value.length > fieldLimit(key)) throw new Error(`Revisa la longitud de ${labels[key]}.`);
        if (key === "latitude" || key === "longitude") {
          if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > (key === "latitude" ? 90 : 180)) throw new Error("Revisa ambas coordenadas del mapa.");
        }
      }
      const fields = Object.fromEntries(Object.entries(draft).filter(([key, value]) => selected[key as FieldKey] && value !== ""));
      if (!Object.keys(fields).length && !hourDays.length && logo.action !== "import" && banner.action !== "import") throw new Error("Selecciona al menos un dato o imagen para importar.");
      const path = connectionPath(connection.connection_id);
      // A lost confirm response must not cause a second write.
      const status = await importRequest<Connection>(path);
      if (status.status !== "confirmed") await importRequest(path + "/confirm", { method: "POST", body: JSON.stringify({ preview_id: preview.preview_id, fields, business_hours: hours.filter(h => hourDays.includes(h.day_of_week)), logo, banner }) });
      sessionStorage.removeItem(KEY); setDone(true); setPreview(null);
    });
  }
  function cancel() {
    void run("Cerrando importación…", async () => {
      if (connection) await importRequest(connectionPath(connection.connection_id), { method: "DELETE" });
      sessionStorage.removeItem(KEY);
      window.location.assign("/admin/my-company");
    });
  }

  const fieldKeys = (Object.keys(labels) as FieldKey[]).filter(key => draft[key] !== undefined || proposal?.[key] || ["description", "title_about", "subtitle_about", "about", "country", "state", "city"].includes(key));
  return <div className="mx-auto max-w-5xl space-y-6 pb-12">
    <header className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
      <Link href="/admin/my-company" className="text-sm text-[#004e28] underline underline-offset-4">Volver a Mi negocio</Link>
      <div className="mt-6 flex items-start gap-4"><div className="rounded-2xl bg-[#004e28] p-3 text-white"><Facebook aria-hidden="true" size={26} /></div><div><p className="text-xs font-semibold uppercase tracking-widest text-[#168e00]">Tu negocio, más fácil</p><h1 className="mt-1 font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28] sm:text-3xl">Importar desde Facebook</h1><p className="mt-2 text-sm leading-6 text-gray-600">Trae los datos de tu página y decide qué usar en Drooopy.</p></div></div>
      <ol className="mt-6 flex flex-wrap gap-4 text-xs text-gray-600" aria-label="Pasos de importación">{["Conectar", "Elegir página", "Revisar y guardar"].map((step, i) => <li key={step} className={i === (preview ? 2 : pages ? 1 : 0) ? "font-semibold text-[#004e28]" : ""}>{i + 1}. {step}</li>)}</ol>
    </header>
    {busy ? <p role="status" className="flex items-center gap-3 rounded-xl bg-[#004e28]/5 p-4 text-sm text-[#004e28]"><Loader2 className="shrink-0 animate-spin" size={20} />{busy}</p> : null}
    {busy.startsWith("Mejorando") ? <button className={button} onClick={() => aiController.current?.abort()}>Continuar sin IA</button> : null}
    {error ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{error}</div> : null}
    {notice ? <p role="status" className="rounded-xl bg-[#f2f3f4] p-4 text-sm leading-6 text-gray-700">{notice}</p> : null}
    {done ? <section className="rounded-2xl border border-green-200 bg-white p-8 text-center"><Check className="mx-auto text-[#168e00]" size={36} /><h2 className="mt-3 text-2xl text-[#004e28]">Tu negocio está actualizado</h2><p className="my-4 text-sm text-gray-600">Guardamos los datos e imágenes que elegiste.</p><Link className={primary} href="/admin/my-company">Ver mi negocio</Link></section> : <>
      {!preview && (!pages || !pages.length || expired) ? <section className="rounded-2xl border border-gray-200 bg-white p-6"><h2 className="text-xl text-[#004e28]">Conecta la página de tu negocio</h2><p className="my-4 text-sm leading-6 text-gray-600">Facebook te permitirá elegir las páginas que autorizas. Después podrás revisar los datos antes de guardar. No importamos correo, RFC ni datos bancarios.</p><button className={primary} disabled={!!busy} onClick={connect}><Facebook size={18} />{connection ? "Volver a conectar Facebook" : "Conectar con Facebook"}</button></section> : null}
      {!preview && pages?.length && !expired ? <section className="rounded-2xl border border-gray-200 bg-white p-6"><h2 className="text-xl text-[#004e28]">¿Qué página quieres importar?</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{pages.map(page => <button key={page.id} disabled={!!busy} onClick={() => choosePage(page)} className={button + " justify-start text-left"}>{page.photo_path ? <div className="w-14 shrink-0"><ImportImage path={page.photo_path} alt="" className="h-14 w-14 rounded-lg object-contain" /></div> : <Facebook size={24} />}<span>{page.name || "Página sin nombre"}<span className="mt-1 block text-xs font-normal text-gray-500">Seleccionar página</span></span></button>)}</div><button disabled={!!busy} className={button + " mt-5"} onClick={connect}>Autorizar otras páginas</button></section> : null}
      {preview ? <fieldset disabled={!!busy || expired} className="min-w-0 space-y-6 disabled:opacity-70">
        <section className="rounded-2xl border border-gray-200 bg-white p-6"><h2 className="text-xl text-[#004e28]">¿Cómo quieres preparar tus textos?</h2><p className="mt-2 text-sm text-gray-600">Puedes importar tal como están o pedir una propuesta. Revisa siempre lo que vas a guardar.</p><div className="mt-4 flex flex-wrap gap-3"><button className={button} onClick={() => { setProposal(null); setNotice("Puedes revisar y guardar los datos sin usar IA."); }}>Solo importar</button><button className={primary} onClick={improve}><Sparkles size={17} />Importar y mejorar textos con IA</button></div></section>
        <section className="rounded-2xl border border-gray-200 bg-white p-6"><h2 className="text-xl text-[#004e28]">Revisa los datos</h2><p className="mt-2 text-sm text-gray-600">Marca lo que quieras guardar. Los datos que ya tienes se conservan si no los seleccionas. Dejar un campo vacío no lo borra.</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">{fieldKeys.map(key => <div key={key} className={["description", "about"].includes(key) ? "sm:col-span-2" : ""}>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800"><input type="checkbox" checked={!!selected[key]} onChange={e => toggle(key, e.target.checked)} className="h-4 w-4 accent-[#168e00]" />{labels[key]}</label>
            {["description", "about", "short_description"].includes(key) ? <textarea aria-label={labels[key]} className={input} rows={key === "short_description" ? 2 : 4} maxLength={fieldLimit(key)} value={draft[key] ?? ""} onChange={e => setDraft(p => ({ ...p, [key]: e.target.value }))} /> : <input aria-label={labels[key]} className={input} type={key === "latitude" || key === "longitude" ? "number" : "text"} step="any" min={key === "latitude" ? -90 : key === "longitude" ? -180 : undefined} max={key === "latitude" ? 90 : key === "longitude" ? 180 : undefined} maxLength={fieldLimit(key)} value={draft[key] ?? ""} onChange={e => setDraft(p => ({ ...p, [key]: ["latitude", "longitude"].includes(key) ? e.target.value === "" ? undefined : Number(e.target.value) : e.target.value }))} />}
            {preview.current[key] != null ? <p className="mt-1 break-words text-xs text-gray-500">Actual: {plain(String(preview.current[key])).slice(0, 240)}</p> : null}
            {typeof draft[key] === "string" && String(draft[key]).length > fieldLimit(key) ? <p className="text-xs text-red-700">Reduce el texto a {fieldLimit(key)} caracteres antes de guardar.</p> : null}
            {textKeys.includes(key) ? <div className="mt-2 flex flex-wrap gap-3 text-xs"><button className="text-[#004e28] underline" onClick={() => setDraft(p => ({ ...p, [key]: plain(String(preview.fields[key] || "")) }))}>Usar original</button>{reviewed ? <button className="text-[#004e28] underline" onClick={() => setDraft(p => ({ ...p, [key]: reviewed[key] || "" }))}>Usar mi revisión</button> : null}{proposal?.[key] ? <button className="font-semibold text-[#168e00] underline" onClick={() => { setDraft(p => ({ ...p, [key]: proposal[key] })); toggle(key, true); }}>Usar propuesta</button> : null}</div> : null}
            {proposal?.[key] ? <p className="mt-2 whitespace-pre-wrap rounded-lg bg-[#168e00]/5 p-3 text-sm leading-6 text-[#004e28]">Propuesta: {proposal[key]}</p> : null}
          </div>)}</div>
          {preview.fields.address ? <p className="mt-5 text-xs leading-5 text-gray-500">La dirección se conserva como la escribió la página. Revisa calle, número y referencias en Información después de importar.</p> : null}
          {preview.category_suggestions.length ? <p className="mt-4 text-sm text-gray-600">Categorías de Facebook: {preview.category_suggestions.map(c => c.name).join(", ")}. Podrás elegir la clasificación de Drooopy en Mi negocio.</p> : null}
          {preview.warnings.length ? <p className="mt-4 text-sm text-amber-800">Algunos datos o imágenes necesitan revisión. Puedes omitirlos y conservar los actuales.</p> : null}
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-6"><h2 className="text-xl text-[#004e28]">Logo y banner</h2><p className="mt-2 text-sm text-gray-600">Usamos las imágenes de Facebook. No generamos imágenes con IA.</p><div className="mt-5 grid gap-6 md:grid-cols-[1fr_2fr]">
          <ImageEditor key={preview.preview_id + "logo"} kind="logo" preview={preview} choice={logo} onChange={setLogo} />
          <ImageEditor key={preview.preview_id + "banner"} kind="banner" preview={preview} choice={banner} onChange={setBanner} />
        </div></section>
        <section className="rounded-2xl border border-gray-200 bg-white p-6"><h2 className="text-xl text-[#004e28]">Horarios</h2><p className="mt-2 text-sm text-gray-600">Solo se reemplazan los días marcados. Un día sin datos conserva sus horarios.</p>{days.map((day, dayIndex) => {
          const entries = hours.map((hour, index) => ({ hour, index })).filter(({ hour }) => hour.day_of_week === dayIndex);
          if (!entries.length) return null;
          return <div className="mt-4 border-t border-gray-100 pt-4" key={day}><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="accent-[#168e00]" checked={hourDays.includes(dayIndex)} onChange={e => setHourDays(p => e.target.checked ? [...p, dayIndex] : p.filter(d => d !== dayIndex))} />{day}</label>{preview.current_business_hours.some(h => h.day_of_week === dayIndex) ? <p className="mt-1 text-xs text-gray-500">Actual: {preview.current_business_hours.filter(h => h.day_of_week === dayIndex).map(h => h.is_closed ? "Cerrado" : `${h.open_time} – ${h.close_time}`).join(", ")}</p> : null}{entries.map(({ hour, index }) => <div className="mt-2 flex flex-wrap items-center gap-3" key={index}><label className="text-sm"><input type="checkbox" checked={hour.is_closed} onChange={e => setHours(p => p.map((h, i) => i !== index ? h : { ...h, is_closed: e.target.checked, open_time: e.target.checked ? null : "09:00", close_time: e.target.checked ? null : "18:00" }))} /> Cerrado</label>{!hour.is_closed ? <><input aria-label={`Apertura ${day} ${index + 1}`} className={input + " max-w-36"} type="time" value={hour.open_time || ""} onChange={e => setHours(p => p.map((h, i) => i === index ? { ...h, open_time: e.target.value } : h))} /><span>–</span><input aria-label={`Cierre ${day} ${index + 1}`} className={input + " max-w-36"} type="time" value={hour.close_time || ""} onChange={e => setHours(p => p.map((h, i) => i === index ? { ...h, close_time: e.target.value } : h))} /></> : null}</div>)}</div>;
        })}{!hours.length ? <p className="mt-4 text-sm text-gray-500">Facebook no proporcionó horarios. Conservaremos los actuales.</p> : null}</section>
        <div className="flex flex-wrap justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5"><button className={button} onClick={() => { setPreview(null); setProposal(null); }}>Elegir otra página</button><button className={primary} onClick={save}><Check size={18} />Guardar en mi negocio</button></div>
      </fieldset> : null}
      {expired && preview ? <button className={primary} disabled={!!busy} onClick={connect}>Volver a conectar Facebook</button> : null}
      <div className="flex flex-wrap gap-3"><button className={button} disabled={!!busy} onClick={cancel}>Cancelar importación</button>{connection ? <button className={button} disabled={!!busy} onClick={() => void run("Comprobando conexión…", () => loadConnection(connection.connection_id))}>Comprobar conexión</button> : null}</div>
    </>}
  </div>;
}

function ImageEditor({ kind, preview, choice, onChange }: { kind: "logo" | "banner"; preview: Preview; choice: ImageChoice; onChange: (value: ImageChoice) => void }) {
  const image = preview.images[kind];
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(1);
  const [mobile, setMobile] = useState(false);
  const title = kind === "logo" ? "Logo" : "Banner";
  const currentPath = preview.current_images[kind];
  const currentUrl = currentPath?.startsWith("https://") ? currentPath : currentPath?.startsWith("/") ? `${(process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api").replace(/\/$/, "")}${currentPath}` : null;
  let visibleCrop = choice.crop;
  if (mobile && image) {
    const source = choice.crop || { x: 0, y: 0, width: image.width, height: image.height };
    const ratio = 9 / 16;
    const width = Math.min(source.width, source.height * ratio);
    const height = Math.min(source.height, source.width / ratio);
    visibleCrop = { x: source.x + (source.width - width) / 2, y: source.y + (source.height - height) / 2, width, height };
  }
  function recrop(nextPosition = position, nextZoom = zoom) {
    if (!image) return;
    const ratio = 2100 / 740;
    const width = Math.max(1, Math.floor(Math.min(image.width, image.height * ratio) / nextZoom));
    const height = Math.max(1, Math.floor(width / ratio));
    const crop: Crop = { width, height, x: Math.round((image.width - width) * nextPosition.x / 100), y: Math.round((image.height - height) * nextPosition.y / 100) };
    onChange({ action: "import", crop });
  }
  return <div><h3 className="mb-3 text-sm font-semibold text-[#004e28]">{title}</h3>{image ? <>
    {kind === "banner" ? <div className="mb-3 flex gap-3 text-xs"><button className={!mobile ? "font-semibold text-[#004e28] underline" : "text-gray-500"} aria-pressed={!mobile} onClick={() => setMobile(false)}>Computadora</button><button className={mobile ? "font-semibold text-[#004e28] underline" : "text-gray-500"} aria-pressed={mobile} onClick={() => setMobile(true)}>Celular (aproximado)</button></div> : null}
    {visibleCrop ? <div className="relative mx-auto overflow-hidden rounded-xl bg-[#f2f3f4]" style={{ aspectRatio: `${visibleCrop.width}/${visibleCrop.height}`, maxWidth: mobile ? 180 : undefined }}><div className="absolute" style={{ width: `${image.width / visibleCrop.width * 100}%`, left: `${-visibleCrop.x / visibleCrop.width * 100}%`, top: `${-visibleCrop.y / visibleCrop.height * 100}%` }}><ImportImage path={image.path} alt={`${title} propuesto`} className="block h-auto w-full" /></div></div> : <ImportImage path={image.path} alt={`${title} de Facebook`} className={kind === "logo" ? "h-36 w-full rounded-xl bg-[#f2f3f4] object-contain p-3" : "h-auto max-h-64 w-full rounded-xl bg-[#f2f3f4] object-contain"} />}
    {currentUrl ? <details className="mt-3 text-xs text-gray-600"><summary className="cursor-pointer">Ver imagen actual</summary><Image src={currentUrl} alt={`${title} actual`} width={800} height={400} unoptimized className="mt-2 max-h-40 w-full rounded-lg bg-[#f2f3f4] object-contain" /></details> : null}
    <label className="mt-3 block text-sm">Qué imagen usar<select className={input + " mt-1"} value={choice.action} onChange={e => onChange({ action: e.target.value as ImageChoice["action"] })}><option value="keep">Conservar imagen actual / no importar</option><option value="import">Importar imagen de Facebook</option></select></label>
    {kind === "banner" && choice.action === "import" ? <><label className="mt-3 block text-sm">Encuadre<select className={input + " mt-1"} value={choice.crop ? "crop" : "full"} onChange={e => e.target.value === "full" ? onChange({ action: "import" }) : recrop()}><option value="full">Conservar imagen completa</option><option value="crop">Recortar para escritorio (2100 × 740)</option></select></label>{choice.crop ? <div className="mt-3 space-y-2">{(["x", "y"] as const).map(axis => <label className="block text-xs" key={axis}>{axis === "x" ? "Posición horizontal" : "Posición vertical"}<input className="mt-1 w-full accent-[#168e00]" type="range" min="0" max="100" value={position[axis]} onChange={e => { const next = { ...position, [axis]: Number(e.target.value) }; setPosition(next); recrop(next); }} /></label>)}<label className="block text-xs">Acercamiento<input className="mt-1 w-full accent-[#168e00]" type="range" min="1" max="3" step="0.05" value={zoom} onChange={e => { setZoom(Number(e.target.value)); recrop(position, Number(e.target.value)); }} /></label></div> : null}<p className="mt-3 text-xs leading-5 text-gray-500">En celular se muestra la parte central del banner como fondo vertical. Mantén lo importante en el centro y evita texto cerca de los bordes.</p></> : null}
  </> : <p className="rounded-xl bg-[#f2f3f4] p-4 text-sm text-gray-500">Sin {title.toLowerCase()} disponible. Se conserva el actual.</p>}</div>;
}
