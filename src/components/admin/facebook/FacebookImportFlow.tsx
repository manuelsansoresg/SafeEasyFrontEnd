"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Facebook, Loader2, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { resolveCurrentSupplier } from '@/lib/currentSupplier';
import { importRequest, connectionPath, FacebookImportError, type FacebookPage, type Preview, type FieldKey, type Connection } from '@/services/facebookImportService';
import { draftRequest, fieldValue, type Draft, type DraftSummary, type Edits, type Step, type Operation, type TextField } from '@/services/facebookDraftService';
import { ImportImage } from '@/components/admin/facebook/ImportImage';

const steps: { id: Step; title: string; detail: string }[] = [{ id: 'page', title: 'Tu página', detail: 'Elige el origen' }, { id: 'information', title: 'Información', detail: 'Completa tu perfil' }, { id: 'images', title: 'Logo y banner', detail: 'Dale tu estilo' }, { id: 'review', title: 'Revisar y guardar', detail: 'Tú decides' }];
const labels: Record<FieldKey, string> = { name: 'Nombre del negocio', short_description: 'Descripción corta', description: 'Descripción completa', title_about: 'Título de Sobre nosotros', subtitle_about: 'Subtítulo de Sobre nosotros', about: 'Sobre nosotros', phone: 'Teléfono', address: 'Dirección', country: 'País', state: 'Estado', city: 'Ciudad', cp: 'Código postal', latitude: 'Latitud', longitude: 'Longitud', facebook_url: 'Página de Facebook' };
const textFields: TextField[] = ['short_description', 'description', 'title_about', 'subtitle_about', 'about'];
const buttonBase = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors enabled:hover:border-[#004e28]/25 enabled:hover:bg-green-50 enabled:hover:text-[#004e28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00] disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-[#f2f3f4] disabled:text-gray-600';
const btn = buttonBase + ' border-[#004e28]/20 bg-white text-[#004e28]';
const primary = buttonBase + ' border-[#004e28] bg-[#004e28] text-white';
const input = 'w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-black focus:outline-2 focus:outline-[#168e00]';
const visibleFields = (Object.keys(labels) as FieldKey[]).filter(key => !['latitude', 'longitude'].includes(key));
function includedFields(draft: Draft, edits: Edits): FieldKey[] {
  return (Object.keys(labels) as FieldKey[]).filter(key => String(fieldValue(draft, edits, key)).trim() !== '');
}
const json = (value: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
function plain(value: unknown) { return typeof value === 'string' ? new DOMParser().parseFromString(value, 'text/html').body.textContent || '' : String(value ?? ''); }

export default function FacebookImportFlow() {
  const user = useAuthStore(s => s.user);
  const [supplier, setSupplier] = useState<number>();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [edits, setEdits] = useState<Edits | null>(null);
  const [summaries, setSummaries] = useState<DraftSummary[]>([]);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [connection, setConnection] = useState('');
  const [busy, setBusy] = useState('Preparando tu espacio…');
  const [error, setError] = useState('');
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [ack, setAck] = useState('');
  const current = useRef<Draft | null>(null);
  const local = useRef<Edits | null>(null);
  const saved = useRef('');
  const blocked = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const active = useRef(true);
  const lock = useRef(false);
  const pendingGeneration = useRef<{ draftId: string; key: string; body: RequestInit } | null>(null);

  const load = useCallback((next: Draft) => {
    const prepared = next.status === 'active' ? { ...next.edits, selected_fields: includedFields(next, next.edits) } : next.edits;
    current.current = next; local.current = prepared; saved.current = JSON.stringify(next.edits);
    blocked.current = false; setConflict(false); setDraft(next); setEdits(prepared); setOperations(next.operations);
    sessionStorage.setItem('facebook-import-draft', next.id);
    const url = new URL(window.location.href); url.searchParams.set('draft', next.id); url.searchParams.set('supplier_id', String(next.supplier_id)); window.history.replaceState(null, '', url);
  }, []);
  function change(next: Edits) {
    const prepared = current.current ? { ...next, selected_fields: includedFields(current.current, next) } : next;
    local.current = prepared; setEdits(prepared);
  }
  function navigate(step: Step) {
    void run('Guardando tu avance…', async () => {
      if (!local.current) return;
      const previous = local.current.step;
      local.current = { ...local.current, step };
      try {
        await flush();
        setEdits(local.current);
      } catch (error) {
        if (local.current) { local.current = { ...local.current, step: previous }; setEdits(local.current); }
        throw error;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  const flush = useCallback(async (): Promise<Draft> => {
    const task = queue.current.catch(() => {}).then(async () => {
      if (blocked.current) throw new Error('Recupera la versión guardada antes de continuar.');
      let value = current.current;
      if (!value || !local.current) throw new Error('Selecciona un borrador para continuar.');
      while (saved.current !== JSON.stringify(local.current)) {
        const snapshot = local.current;
        setSaving(true);
        try {
          value = await draftRequest<Draft>(`/${value.id}`, { ...json({ version: value.version, edits: snapshot }), method: 'PATCH' });
          if (!active.current) return value;
          current.current = value; saved.current = JSON.stringify(snapshot); setDraft(value);
        } catch (e) {
          if (e instanceof FacebookImportError && e.code === 'draft_version_conflict') { blocked.current = true; setConflict(true); }
          throw e;
        } finally { if (active.current) setSaving(false); }
      }
      return value;
    });
    queue.current = task;
    return task;
  }, []);
  async function run(label: string, work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(label); setError('');
    try { await work(); } catch (e) {
      if (active.current) {
        setError(e instanceof Error ? e.message : 'No pudimos completar la operación.');
        if (e instanceof FacebookImportError && ['meta_revalidation_required', 'meta_reconnect_required', 'connection_expired', 'connection_not_found', 'meta_permissions_missing'].includes(e.code)) setNeedsReconnect(true);
        if (e instanceof FacebookImportError && ['draft_expired', 'draft_revoked'].includes(e.code)) {
          current.current = null; local.current = null; setDraft(null); setEdits(null); setOperations([]); sessionStorage.removeItem('facebook-import-draft');
        }
      }
    } finally { lock.current = false; if (active.current) setBusy(''); }
  }
  useEffect(() => {
    active.current = true;
    void (async () => {
      try {
        const query = new URLSearchParams(window.location.search);
        const id = Number(query.get('supplier_id') || sessionStorage.getItem('facebook-import-supplier')) || (await resolveCurrentSupplier(user))?.id;
        if (!id) throw new Error('Regresa a Mi negocio y abre la importación desde tu empresa.');
        if (!active.current) return;
        setSupplier(id);
        const existing = await draftRequest<DraftSummary[]>(`?supplier_id=${id}`);
        if (!active.current) return;
        setSummaries(existing);
        const draftId = query.get('draft') || sessionStorage.getItem('facebook-import-draft');
        if (draftId && existing.some(d => d.id === draftId && d.status !== 'revoked')) load(await draftRequest<Draft>(`/${encodeURIComponent(draftId)}`));
        const connectionId = sessionStorage.getItem('facebook-import-connection');
        if (connectionId) {
          const c = await importRequest<Connection>(connectionPath(connectionId));
          if (c.supplier_id === id && c.status === 'connected') {
            setConnection(connectionId); setNeedsReconnect(false);
            // Returning to a draft only revalidates authorization; it does not replace its contents.
            if (!draftId || !existing.some(d => d.id === draftId)) setPages((await importRequest<{ pages: FacebookPage[] }>(connectionPath(connectionId) + '/pages')).pages);
          }
        }
      } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'No se pudo recuperar la importación.'); }
      finally { if (active.current) setBusy(''); }
    })();
    return () => { active.current = false; };
    // Auth hydration is handled by the surrounding protected workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  useEffect(() => {
    if (!edits || !draft || draft.status !== 'active' || conflict || saved.current === JSON.stringify(edits)) return;
    const timer = setTimeout(() => { void flush().catch(e => { if (active.current) setError(e.message); }); }, 800);
    return () => clearTimeout(timer);
  }, [edits, draft, conflict, flush]);
  useEffect(() => {
    if (!draft || !operations.some(o => o.status === 'processing')) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void Promise.all(operations.filter(o => o.status === 'processing').map(o => draftRequest<Operation>(`/${draft.id}/operations/${o.operation_id}`))).then(results => {
        if (cancelled) return;
        setOperations(old => old.map(o => results.find(r => r.operation_id === o.operation_id) || o));
        if (current.current?.id === draft.id) { current.current = { ...current.current, operations: current.current.operations.map(o => results.find(r => r.operation_id === o.operation_id) || o), assets: [...current.current.assets.filter(a => !results.some(r => r.asset?.id === a.id)), ...results.flatMap(r => r.asset ? [r.asset] : [])] }; setDraft(current.current); }
      }).catch(e => { if (!cancelled) setError(e.message); });
    }, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [draft, operations]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (local.current && saved.current !== JSON.stringify(local.current)) e.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, []);

  function connect(changePage = false) {
    void run('Abriendo Facebook…', async () => {
      if (current.current) await flush();
      sessionStorage.setItem('facebook-import-supplier', String(supplier));
      if (changePage) { sessionStorage.removeItem('facebook-import-draft'); const url = new URL(window.location.href); url.searchParams.delete('draft'); window.history.replaceState(null, '', url); }
      const result = await importRequest<{ authorization_url: string }>(`?supplier_id=${supplier}`, { method: 'POST' });
      const url = new URL(result.authorization_url);
      if (url.protocol !== 'https:' || !/(^|\.)facebook\.com$/.test(url.hostname)) throw new Error('No se pudo verificar el enlace de Facebook.');
      window.location.assign(url.href);
    });
  }
  function selectPage(page: FacebookPage) {
    void run('Preparando los datos de tu página…', async () => {
      const preview = await importRequest<Preview>(connectionPath(connection) + `/pages/${encodeURIComponent(page.id)}/preview`, { method: 'POST' });
      const value = await draftRequest<Draft>('', json({ supplier_id: supplier, connection_id: connection, preview_id: preview.preview_id }));
      load(value); setPages([]);
      change({ ...value.edits, step: 'information', save_hours: !!value.original.business_hours?.length, selected_fields: Object.keys(value.original.fields || {}).filter(k => plain(value.original.fields?.[k as FieldKey]).trim()) as FieldKey[] });
    });
  }
  async function generate(kind: 'texts' | 'logo' | 'banner', options: Record<string, unknown> = {}) {
    await run('Preparando tu propuesta. Puedes seguir navegando entre pasos…', async () => {
      if (pendingGeneration.current) throw new Error('Comprueba la solicitud de IA anterior antes de generar otra propuesta.');
      const value = await flush();
      const body = json({ version: value.version, kind, ...options });
      const key = crypto.randomUUID(); body.headers = { ...body.headers, 'Idempotency-Key': key };
      pendingGeneration.current = { draftId: value.id, key, body };
      const op = await draftRequest<Operation>(`/${value.id}/operations`, body);
      pendingGeneration.current = null;
      const fresh = await draftRequest<Draft>(`/${value.id}`);
      current.current = fresh; setDraft(fresh); setOperations(fresh.operations);
      if (op.status !== 'succeeded' && op.status !== 'processing') setError(op.message || 'No se generó una propuesta. Puedes continuar sin IA.');
      else setNotice('La propuesta está disponible para revisarla. Usa «Aplicar propuesta» para incluirla.');
    });
  }
  function applyTexts(op: Operation) {
    if (!local.current || !op.proposal) return;
    const next = structuredClone(local.current);
    for (const key of textFields) if (op.proposal[key]?.trim()) { next.text_selections[key] = { source: 'proposal', operation_id: op.operation_id }; if (!next.selected_fields.includes(key)) next.selected_fields.push(key); }
    change(next); setNotice('Los textos propuestos ya aparecen en los campos. Puedes editarlos o restaurar el original.');
  }
  function updateField(key: FieldKey, raw: string) {
    if (!local.current) return;
    const next = structuredClone(local.current);
    if (key === 'latitude' || key === 'longitude') { if (raw === '') delete next.reviewed_fields[key]; else next.reviewed_fields[key] = Number(raw); }
    else next.reviewed_fields[key] = raw;
    if (textFields.includes(key as TextField)) next.text_selections[key as TextField] = { source: 'reviewed' };
    if (!next.selected_fields.includes(key)) next.selected_fields.push(key);
    change(next);
  }
  function confirm() {
    void run('Revisando y guardando tu negocio…', async () => {
      const value = await flush();
      const fresh = await draftRequest<Draft>(`/${value.id}`);
      current.current = fresh; setDraft(fresh);
      if (fresh.supplier_changed && ack !== fresh.supplier_revision) { setError('Tu negocio cambió desde que abriste el borrador. Compara los valores actuales y confirma su revisión.'); return; }
      await draftRequest(`/${value.id}/confirm`, json({ version: value.version, supplier_revision: fresh.supplier_revision, ...(connection ? { connection_id: connection } : {}) }));
      load(await draftRequest<Draft>(`/${value.id}`));
    });
  }
  const step = edits?.step || 'page';
  const index = steps.findIndex(s => s.id === step);
  const mutable = draft?.status === 'active';
  const workingAI = operations.some(o => o.status === 'processing');
  const unsaved = !!edits && saved.current !== JSON.stringify(edits);
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
    <header className="rounded-3xl border border-[#004e28]/10 bg-white p-6 md:p-8">
      <Link href="/admin/my-company" className="inline-flex items-center gap-2 text-sm text-[#004e28] underline"><ArrowLeft size={16} /> Mi negocio</Link>
      <div className="mt-6 flex items-center gap-4"><span className="rounded-2xl bg-[#004e28] p-3 text-white"><Facebook size={28} /></span><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#168e00]">Tu negocio, más fácil</p><h1 className="mt-1 text-2xl text-[#004e28] md:text-3xl">Importar y personalizar</h1></div></div>
      <p className="mt-4 text-sm text-gray-600">Trae tu información, dale tu estilo y revisa antes de guardar. Sin correo, RFC ni datos bancarios.</p>
      <nav aria-label="Pasos de importación" className="mt-7 grid grid-cols-2 gap-2 md:grid-cols-4">{steps.map((s, i) => <button key={s.id} disabled={!draft || !mutable || conflict || saving || !!busy} aria-current={step === s.id ? 'step' : undefined} onClick={() => navigate(s.id)} className={`flex items-center gap-3 rounded-xl p-3 text-left transition-colors enabled:hover:bg-green-50 enabled:hover:text-[#004e28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00] disabled:cursor-not-allowed disabled:opacity-60 ${step === s.id ? 'bg-[#004e28] text-white' : 'bg-[#f2f3f4] text-[#004e28]'}`}><span className="grid size-7 shrink-0 place-items-center rounded-full border border-current text-xs">{i + 1}</span><span><span className="block text-sm font-semibold">{s.title}</span><span className="hidden text-xs opacity-75 md:block">{s.detail}</span></span></button>)}</nav>
      {draft && <p role="status" className="mt-4 text-xs text-gray-600">{conflict ? 'Revisión necesaria: otra pestaña modificó el borrador.' : saving || unsaved ? 'Guardando tu avance…' : 'Avance guardado'} · Disponible hasta {new Date(draft.expires_at).toLocaleDateString('es-MX')}</p>}
    </header>
    {busy && <p role="status" className="flex items-center gap-2 text-sm text-[#004e28]"><Loader2 className="animate-spin" size={18} />{busy}</p>}
    {error && <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{error}{conflict && <button className={btn + ' mt-3 block'} onClick={() => void run('Recuperando versión guardada…', async () => { if (draft) load(await draftRequest<Draft>(`/${draft.id}`)); })}>Descartar mis cambios sin guardar y recuperar versión guardada</button>}{needsReconnect && <button className={btn + ' ml-3'} onClick={() => connect()}>Volver a autorizar</button>}</div>}
    {notice && <p role="status" className="rounded-2xl bg-green-50 p-4 text-sm text-[#004e28]">{notice}</p>}
    {pendingGeneration.current && !busy && <button className={btn} onClick={() => void run('Comprobando la solicitud anterior…', async () => { const p = pendingGeneration.current; if (!p) return; await draftRequest<Operation>(`/${p.draftId}/operations`, p.body); pendingGeneration.current = null; const fresh = await draftRequest<Draft>(`/${p.draftId}`); current.current = fresh; setDraft(fresh); setOperations(fresh.operations); })}>Comprobar la solicitud de IA anterior sin generar otra</button>}
    {draft?.status === 'confirmed' ? <section className="rounded-3xl bg-white p-8 text-center"><Check className="mx-auto text-[#168e00]" size={40} /><h2 className="my-4 text-2xl text-[#004e28]">Tu negocio está actualizado</h2><Link className={primary} href="/admin/my-company">Volver a Mi negocio</Link></section> : <>
    {step === 'page' && <section className="space-y-6 rounded-3xl border border-gray-200 bg-white p-6 md:p-8"><h2 className="text-xl text-[#004e28]">¿De dónde traemos tu información?</h2>{draft && <div className="rounded-xl bg-green-50 p-4 text-sm"><p>Este borrador conserva tus datos y propuestas. Puedes ir a cualquier paso sin volver a conectar.</p><button className={primary + ' mt-3'} onClick={() => navigate('information')}>Continuar este borrador</button></div>}
      {pages.map(p => <button key={p.id} disabled={!!busy} className={btn + ' w-full justify-start p-4'} onClick={() => selectPage(p)}>{p.photo_path && <ImportImage path={p.photo_path} alt="" className="size-12 rounded-lg object-contain" />}<span>{p.name || 'Página sin nombre'}</span><ArrowRight size={18} className="ml-auto" /></button>)}
      <div className="flex flex-wrap gap-3"><button disabled={!!busy || !supplier} className={primary} onClick={() => connect(!!draft)}><Facebook size={18} />{draft || pages.length ? 'Elegir otra página en Facebook' : 'Conectar con Facebook'}</button><button disabled={!!busy || !supplier} className={btn} onClick={() => void run('Creando tu borrador…', async () => load(await draftRequest<Draft>('', json({ supplier_id: supplier }))))}>Empezar con mis propios datos</button></div>
      {!draft && summaries.filter(d => d.status === 'active').length > 0 && <div className="border-t pt-5"><h3 className="mb-3 font-medium text-[#004e28]">Continúa donde te quedaste</h3>{summaries.filter(d => d.status === 'active').map(d => <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3"><span className="text-sm text-gray-600">Borrador · vence {new Date(d.expires_at).toLocaleDateString('es-MX')}</span><div className="flex gap-2"><button className={btn} disabled={!!busy} onClick={() => void run('Abriendo borrador…', async () => load(await draftRequest<Draft>(`/${d.id}`)))}>Retomar</button><button className={btn} disabled={!!busy} onClick={() => { if (window.confirm('¿Descartar este borrador y sus imágenes temporales? Los datos publicados se conservan.')) void run('Descartando…', async () => { await draftRequest(`/${d.id}?version=${d.version}`, { method: 'DELETE' }); setSummaries(old => old.filter(x => x.id !== d.id)); }); }}>Descartar</button></div></div>)}</div>}
    </section>}
    {draft?.original.warnings?.map(w => <p key={w} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{w}</p>)}
    {draft && edits && step === 'information' && <section className="space-y-6 rounded-3xl border border-gray-200 bg-white p-6 md:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl text-[#004e28]">Cuéntales sobre tu negocio</h2><p className="mt-2 text-sm text-gray-600">Revisa y edita lo que necesites. Al continuar guardamos todo tu avance; los campos vacíos conservan la información actual.</p></div><button disabled={!!busy || workingAI || conflict} className={primary} onClick={() => void generate('texts')}><Sparkles size={18} />Completar y mejorar con IA</button></div>
      {operations.filter(o => o.kind === 'texts').map(o => <div key={o.operation_id} className="space-y-3 rounded-2xl bg-[#f2f3f4] p-4"><p className="text-sm">{o.status === 'processing' ? 'Preparando tus textos… Puedes visitar los otros pasos.' : o.message}</p>{o.status === 'succeeded' && o.proposal && <><details><summary className="cursor-pointer text-sm text-[#004e28]">Ver textos propuestos</summary>{Object.entries(o.proposal).map(([k, v]) => <p className="mt-3 text-sm" key={k}><strong>{labels[k as FieldKey]}: </strong>{plain(v)}</p>)}</details><button disabled={conflict} className={btn} onClick={() => applyTexts(o)}>Aplicar propuesta a los campos</button></>}{o.pending_fields?.map(p => <p key={p.field} className="text-sm text-amber-900">{p.question}</p>)}{o.warnings?.map(w => <p key={w} className="text-sm text-amber-900">{w}</p>)}</div>)}
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">{visibleFields.map(key => { const val = fieldValue(draft, edits, key); const long = ['description', 'about', 'short_description'].includes(key); const existing = plain(draft.source.current_supplier[key]); const display = plain(val) || (edits.reviewed_fields[key] === undefined && !edits.text_selections[key as TextField] ? existing : ''); return <div key={key} className={['description', 'about'].includes(key) ? 'md:col-span-2' : ''}><label htmlFor={`field-${key}`} className="mb-2 block text-sm font-medium text-[#004e28]">{labels[key]}</label>{long ? <textarea id={`field-${key}`} disabled={conflict} className={input} rows={key === 'short_description' ? 3 : 5} value={display} maxLength={key === 'short_description' ? 255 : 20000} onChange={e => updateField(key, e.target.value)} /> : <input id={`field-${key}`} disabled={conflict} className={input} maxLength={key === 'phone' ? 20 : key === 'cp' ? 10 : ['country', 'state', 'city'].includes(key) ? 100 : key === 'facebook_url' ? 500 : 255} value={display} onChange={e => updateField(key, e.target.value)} />}</div>; })}</div>
      {!!draft.original.business_hours?.length && <div className="rounded-2xl border p-4"><label className="flex items-center gap-2 font-medium text-[#004e28]"><input type="checkbox" checked={edits.save_hours} onChange={e => change({ ...edits, save_hours: e.target.checked })} className="accent-[#168e00]" />Guardar horarios de Facebook</label>{draft.original.business_hours.map(h => <p key={h.day_of_week} className="mt-2 text-sm">{['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][h.day_of_week]}: {h.is_closed ? 'Cerrado' : `${h.open_time} – ${h.close_time}`}</p>)}</div>}
    </section>}
    {draft && edits && step === 'images' && <section className="space-y-8 rounded-3xl border border-gray-200 bg-white p-6 md:p-8"><div><h2 className="text-xl text-[#004e28]">Dale tu estilo</h2><p className="mt-2 text-sm text-gray-600">Conserva tus imágenes, usa Facebook o crea una propuesta con IA. Nada cambia en tu negocio hasta guardar.</p></div>{(['logo', 'banner'] as const).map(kind => <ImagePanel key={`${draft.id}-${kind}`} kind={kind} draft={draft} edits={edits} change={change} disabled={!!busy || workingAI || conflict} generate={generate} upload={file => run('Subiendo tu imagen…', async () => { const value = await flush(); await draftRequest(`/${value.id}/assets/${kind}?version=${value.version}`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file }); const fresh = await draftRequest<Draft>(`/${value.id}`); current.current = fresh; setDraft(fresh); })} />)}{operations.filter(o => o.kind !== 'texts').map(o => <p role="status" className="text-sm text-[#004e28]" key={o.operation_id}>{o.status === 'processing' ? 'Generando imagen… Puedes seguir revisando tu información.' : o.message}</p>)}</section>}
    {draft && edits && step === 'review' && <section className="space-y-6 rounded-3xl border border-gray-200 bg-white p-6 md:p-8"><h2 className="text-xl text-[#004e28]">Así se actualizará tu negocio</h2><p className="text-sm text-gray-600">Guardaremos los datos que revisaste y las imágenes que elegiste. Los campos vacíos conservan tu información actual.</p><dl className="divide-y">{edits.selected_fields.map(key => <div key={key} className="grid gap-2 py-4 md:grid-cols-[200px_1fr]"><dt className="text-sm font-medium text-[#004e28]">{labels[key]}</dt><dd className="whitespace-pre-wrap break-words text-sm">{plain(fieldValue(draft, edits, key)) || 'Vacío: se conserva el actual'}<p className="mt-2 text-xs text-gray-500">Actual: {plain(draft.source.current_supplier[key]) || 'Sin información'}</p></dd></div>)}</dl>{(['logo', 'banner'] as const).map(kind => { const asset = draft.assets.find(a => a.id === edits[kind].asset_id); return <div key={kind} className="rounded-xl bg-[#f2f3f4] p-4"><p className="mb-3 text-sm font-medium">{kind === 'logo' ? 'Logo' : 'Banner'}: {edits[kind].action === 'import' ? 'Usar imagen seleccionada' : 'Conservar imagen actual'}</p>{edits[kind].action === 'import' && asset && <ImportImage path={asset.path} alt={kind} className={kind === 'logo' ? 'size-28 object-contain' : 'aspect-[2100/740] w-full object-contain'} />}</div>; })}<p className="text-sm">Horarios: {edits.save_hours ? 'Guardar horarios seleccionados de Facebook' : 'Conservar horarios actuales'}</p>{draft.supplier_changed && <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"><input type="checkbox" className="mt-1" checked={ack === draft.supplier_revision} onChange={e => setAck(e.target.checked ? draft.supplier_revision : '')} />Revisé los valores actuales del negocio y confirmo guardar la información revisada.</label>}<button className={primary} disabled={!!busy || conflict || (draft.supplier_changed && ack !== draft.supplier_revision)} onClick={confirm}><Check size={18} />Guardar en mi negocio</button></section>}
    {draft && edits && mutable && <footer className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-4"><button className={btn} disabled={index === 0 || conflict || saving || !!busy} onClick={() => navigate(steps[index - 1].id)}><ArrowLeft size={16} />Anterior</button><span className="text-xs text-gray-500">Paso {index + 1} de 4</span>{index < 3 ? <button className={primary} disabled={conflict || saving || !!busy} onClick={() => navigate(steps[index + 1].id)}>Continuar<ArrowRight size={16} /></button> : <button className={btn} onClick={() => navigate('information')}>Editar información</button>}</footer>}
    </>}
  </main>;
}

function ImagePanel({ kind, draft, edits, change, disabled, generate, upload }: { kind: 'logo' | 'banner'; draft: Draft; edits: Edits; change: (e: Edits) => void; disabled: boolean; generate: (kind: 'logo' | 'banner', options: Record<string, unknown>) => Promise<void>; upload: (file: File) => Promise<void> }) {
  const [mode, setMode] = useState('create');
  const [reference, setReference] = useState('');
  const [instructions, setInstructions] = useState('');
  const [color, setColor] = useState('#004e28');
  const [transparent, setTransparent] = useState(false);
  const [mobile, setMobile] = useState(false);
  const assets = draft.assets.filter(a => a.kind === kind);
  const selected = assets.find(a => a.id === edits[kind].asset_id);
  return <div className="space-y-4 border-t pt-6"><h3 className="text-lg font-semibold text-[#004e28]">{kind === 'logo' ? 'Logo' : 'Banner'}</h3>{(kind === 'logo' ? draft.source.current_supplier.logo : draft.source.current_supplier.header_image || draft.source.current_supplier.banner) && <details><summary className="cursor-pointer text-sm text-[#004e28]">Ver imagen actual del negocio</summary><Image unoptimized width={1200} height={420} src={(kind === 'logo' ? draft.source.current_supplier.logo : draft.source.current_supplier.header_image || draft.source.current_supplier.banner)!} alt="Imagen actual del negocio" className="mt-3 max-h-48 w-full rounded-xl object-contain" /></details>}<div className="grid gap-3 sm:grid-cols-3"><button aria-pressed={edits[kind].action !== 'import'} className={btn + (edits[kind].action !== 'import' ? ' ring-2 ring-[#168e00]' : '')} onClick={() => change({ ...edits, [kind]: { action: 'keep' } })}>Conservar imagen actual</button>{assets.map(a => <button key={a.id} aria-pressed={edits[kind].asset_id === a.id && edits[kind].action === 'import'} className={`rounded-xl border p-3 text-left text-[#004e28] transition-colors hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-[#168e00] ${edits[kind].asset_id === a.id && edits[kind].action === 'import' ? 'border-[#168e00] ring-2 ring-[#168e00]' : 'border-gray-200'}`} onClick={() => change({ ...edits, [kind]: { action: 'import', asset_id: a.id } })}><ImportImage path={a.path} alt={kind === 'logo' ? 'Alternativa de logo' : 'Alternativa de banner'} className="h-28 w-full rounded-lg bg-[#f2f3f4] object-contain" /><span className="mt-2 block text-xs text-[#004e28]">{a.source === 'facebook' ? 'De Facebook' : a.source === 'ai' ? 'Propuesta de IA' : 'Tu imagen'} · {edits[kind].asset_id === a.id && edits[kind].action === 'import' ? 'Seleccionada' : 'Usar esta imagen'}</span></button>)}</div>
    {selected && edits[kind].action === 'import' && <div className="rounded-xl bg-[#f2f3f4] p-4">{kind === 'banner' && <div className="mb-3 flex gap-2"><button className={btn} aria-pressed={!mobile} onClick={() => setMobile(false)}>Computadora</button><button className={btn} aria-pressed={mobile} onClick={() => setMobile(true)}>Celular</button></div>}<ImportImage path={selected.path} alt="Vista previa de la imagen seleccionada" className={kind === 'logo' ? 'mx-auto size-48 object-contain' : mobile ? 'mx-auto aspect-[9/16] w-56 object-cover object-center' : 'aspect-[2100/740] w-full object-contain'} />{kind === 'banner' && <p className="mt-3 text-xs text-gray-600">En computadora se conserva la imagen completa, con relleno si hace falta. En celular se muestra el centro: revisa que el texto y lo importante queden visibles.</p>}</div>}
    <label className={btn + ' cursor-pointer'}>Subir imagen propia<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ''; }} /></label>
    <details className="rounded-2xl border border-[#168e00]/20 bg-green-50/40 p-4"><summary className="cursor-pointer font-medium text-[#004e28]">Crear o mejorar {kind === 'logo' ? 'mi logo' : 'mi banner'} con IA</summary><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="space-y-2 text-sm">¿Qué quieres hacer?<select className={input} value={mode} onChange={e => setMode(e.target.value)}><option value="create">Crear una imagen nueva</option><option value="improve">Mejorar una imagen existente</option><option value="redesign">Rediseñar su estilo</option></select></label>{mode !== 'create' && <label className="space-y-2 text-sm">Imagen de referencia<select className={input} value={reference} onChange={e => setReference(e.target.value)}><option value="">{mode === 'improve' ? 'Elige una imagen' : 'Sin referencia'}</option>{assets.map(a => <option key={a.id} value={a.id}>{a.source === 'facebook' ? 'Facebook' : a.source === 'ai' ? 'Propuesta IA' : 'Imagen propia'} · {assets.indexOf(a) + 1}</option>)}</select></label>}<label className="space-y-2 text-sm md:col-span-2">Describe el estilo que buscas<textarea rows={3} maxLength={1000} className={input} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder={kind === 'logo' ? 'Por ejemplo: sencillo, elegante y con el nombre del negocio.' : 'Por ejemplo: limpio y moderno, con lo importante al centro para verlo en celular.'} /></label><label className="flex items-center gap-3 text-sm">Color principal<input type="color" value={color} onChange={e => setColor(e.target.value)} /></label>{kind === 'logo' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={transparent} onChange={e => setTransparent(e.target.checked)} />Fondo transparente</label>}<p className="text-xs text-gray-600 md:col-span-2">Se usará la información de tu negocio como contexto. Cada generación consume tu cuota de IA y crea una alternativa para revisar.</p><button disabled={disabled || (mode === 'improve' && !reference)} className={primary} onClick={() => void generate(kind, { mode, instructions, colors: [color], ...(mode !== 'create' && reference ? { reference_asset_id: reference } : {}), ...(kind === 'logo' ? { transparent } : {}) })}><Sparkles size={18} />Generar propuesta de {kind === 'logo' ? 'logo' : 'banner'}</button></div></details>
  </div>;
}
