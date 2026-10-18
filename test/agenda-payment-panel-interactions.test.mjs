// Execute the real panel handlers with a small hook host; no browser or external API.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
registerHooks({
  resolve(specifier,context,next) {
    const mocks={
      react:'export const useMemo=(...a)=>globalThis.__panelHooks.computed(...a); export const useState=(...a)=>globalThis.__panelHooks.state(...a); export const useRef=(...a)=>globalThis.__panelHooks.ref(...a); export const useCallback=(...a)=>globalThis.__panelHooks.memo(...a); export const useEffect=(...a)=>globalThis.__panelHooks.effect(...a);',
      'react/jsx-runtime':'export const jsx=(type,props,key)=>({type,props:props??{},key});export const jsxs=jsx;export const Fragment=Symbol.for("react.fragment");',
      'lucide-react':'export const ChevronDown=()=>null;',
      '@/lib/api':'export const fetchWithAuth=(...args)=>globalThis.__panelFetch(...args);',
      '@/store/useAuthStore':'export const useAuthStore=selector=>selector({user:{id:42}});',
      '@/store/useChatStore':'export const useChatStore=selector=>selector({subscribeToInboxEvents:globalThis.__panelSubscribe});',
    };
    if (mocks[specifier])return {url:`data:text/javascript,${encodeURIComponent(mocks[specifier])}`,shortCircuit:true};
    if(specifier.startsWith('@/components/'))return {url:'data:text/javascript,export default function Child(){};export const AgendaCancellationResult=()=>null;',shortCircuit:true};
    if(specifier.startsWith('@/'))return {url:new URL(`../src/${specifier.slice(2)}.ts`,import.meta.url).href,shortCircuit:true};
    return next(specifier,context);
  },
  load(url,context,next) {
    if(url.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};
    return next(url,context);
  },
});
const {default:Panel}=await import('../src/components/agenda/AgendaFinancialPanel.tsx');
const {default:Retry}=await import('../src/components/agenda/AgendaPaymentRetry.tsx');
const summary={booking_id:7,ledger_version:2,total:200,initial_required:10,deposit_confirmed:0,gross_collected:0,balance_due:200,settlement_status:'pending',payment_state:'rejected',review_required:false,allowed_manual_methods:[]};
const booking={id:7,finance_version:2,status:'pending',start_at:'2099-01-01T12:00:00Z',updated_at:'2026-01-01'};
function host(provider=false,component=Panel,retrySummary=null) {
  const cells=[];let cursor=0,effects=[],tree;
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  globalThis.__panelSubscribe=()=>()=>{};
  const storage=new Map();globalThis.__panelRedirects=[];
  globalThis.window={location:{assign:url=>globalThis.__panelRedirects.push(url)},sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}};
  globalThis.document={visibilityState:'visible',addEventListener:()=>{},removeEventListener:()=>{}};
  globalThis.__panelHooks={
    state(initial){const index=cursor++;cells[index]??={value:typeof initial==='function'?initial():initial};return [cells[index].value,value=>{cells[index].value=typeof value==='function'?value(cells[index].value):value;}];},
    ref(initial){const index=cursor++;cells[index]??={current:initial};return cells[index];},
    computed(fn,deps){const index=cursor++;if(!same(cells[index]?.deps,deps))cells[index]={value:fn(),deps};return cells[index].value;},
    memo(fn,deps){const index=cursor++;if(!same(cells[index]?.deps,deps))cells[index]={value:fn,deps};return cells[index].value;},
    effect(fn,deps){const index=cursor++;if(!same(cells[index]?.deps,deps)){effects.push(()=>{cells[index]?.cleanup?.();cells[index]={deps,cleanup:fn()};});}},
  };
  return {
    render(){cursor=0;tree=component===Panel?Panel({booking,provider,managementToken:provider?undefined:'guest-token'}):Retry({booking,summary:retrySummary,managementToken:'guest-token',disabled:false,onBusy:()=>{},verification:0});const pending=effects;effects=[];pending.forEach(fn=>fn());return tree;},
    unmount(){for(const cell of cells)cell?.cleanup?.();},
  };
}
function find(tree,predicate){if(!tree||typeof tree!=='object')return null;if(predicate(tree))return tree;for(const child of [tree.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}return null;}
const text=tree=>typeof tree==='string'?tree:[tree?.props?.children].flat(Infinity).map(child=>typeof child==='string'?child:'').join('');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
for(const provider of [false,true])test(`botón real de ${provider?'proveedor':'cliente'} ejecuta POST y actualiza el resumen`,async()=>{
  const calls=[];globalThis.__panelFetch=async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/payments')?{operations:[],intents:[],refunds:[],events:[]}:options.method==='POST'?{...summary,payment_state:'approved',balance_due:190,gross_collected:10}:summary);};
  const view=host(provider);
  try {
    view.render();await settle();let tree=view.render();
    const button=find(tree,node=>node.type==='button'&&text(node)==='Actualizar estado');assert(button);assert.equal(button.props.disabled,false);button.props.onClick();await settle();tree=view.render();
    const request=calls.find(call=>call.options.method==='POST');assert.equal(request.url,provider?'/proxy/agenda/appointments/7/financial-summary/refresh':'/proxy/public/agenda/bookings/7/financial-summary/refresh?management_token=guest-token');
    const displayed=find(tree,node=>node.props?.summary?.payment_state==='approved');assert.equal(displayed.props.summary.balance_due,190);
    if(provider)assert(calls.filter(call=>call.url.endsWith('/payments')).length>=2);
  }finally{view.unmount();}
});
test('doble clic real no solapa POST y muestra estado de carga',async()=>{
  let release;const pending=new Promise(resolve=>release=resolve);let count=0;
  globalThis.__panelFetch=async(url,options)=>{if(options.method==='POST'){count++;return pending;}return Response.json(summary);};
  const view=host();
  try{view.render();await settle();let tree=view.render();const button=find(tree,node=>node.type==='button'&&text(node)==='Actualizar estado');button.props.onClick();button.props.onClick();tree=view.render();const busy=find(tree,node=>node.type==='button'&&text(node)==='Consultando Mercado Pago…');assert(busy.props.disabled);assert.equal(count,1);release(Response.json(summary));await settle();}finally{view.unmount();}
});
for(const status of [409,429,502])test(`fallo real ${status} conserva cifras y presenta un mensaje seguro`,async()=>{
  globalThis.__panelFetch=async(url,options)=>options.method==='POST'?Response.json({detail:{code:'payment_pending',message:'PRIVATE'}},{status}):Response.json(summary);
  const view=host();try{view.render();await settle();let tree=view.render();find(tree,node=>node.type==='button'&&text(node)==='Actualizar estado').props.onClick();await settle();tree=view.render();assert(find(tree,node=>node.props?.summary?.balance_due===200));const alert=find(tree,node=>node.props?.role==='alert');assert(alert);assert(!text(alert).includes('PRIVATE'));}finally{view.unmount();}
});
test('timer real de polling consulta GET sin conciliación remota',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const calls=[];globalThis.__panelFetch=async(url,options)=>{calls.push({url,options});return Response.json(summary);};const view=host();
  try{view.render();await settle();view.render();t.mock.timers.tick(15000);await settle();view.render();assert(calls.length>=2);assert(calls.every(call=>!call.options.method));}finally{view.unmount();}
});

const retrySummary={...summary,can_retry_payment:true,retry_strategy:'reuse_existing_checkout'};
const retryResponse=()=>({booking_id:7,payment_intent_id:12,preference_id:'existing',checkout_url:'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=existing',amount:'10.00',currency:'MXN',expires_at:new Date(Date.now()+3600000).toISOString(),strategy:'reuse_existing_checkout'});
const drain=async()=>{for(let i=0;i<20;i++)await settle();};
test('clic real en reintento espera autorización y usa token invitado sin duplicar reserva',async()=>{
  const calls=[];globalThis.__panelFetch=async(url,options)=>{calls.push({url,options});return Response.json(retryResponse());};const view=host(false,Retry,retrySummary);
  try{let tree=view.render();const button=find(tree,node=>node.type==='button');button.props.onClick();button.props.onClick();await drain();assert.equal(calls.length,1);assert.equal(calls[0].url,'/proxy/public/agenda/bookings/7/payments/retry?management_token=guest-token');assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body)),['idempotency_key']);assert.deepEqual(globalThis.__panelRedirects,[retryResponse().checkout_url]);}finally{view.unmount();}
});
for(const code of ['payment_pending','payment_already_confirmed'])test(`botón real bloqueado por 409 ${code} no redirige`,async()=>{
  globalThis.__panelFetch=async()=>Response.json({detail:{code,message:'PRIVATE'}},{status:409});const view=host(false,Retry,retrySummary);
  try{view.render().props.children[0].props.onClick();await drain();const tree=view.render();assert.equal(globalThis.__panelRedirects.length,0);assert(!find(tree,node=>node.type==='button'));assert(find(tree,node=>node.props?.role==='alert'));}finally{view.unmount();}
});
test('pago en revisión no presenta botón real de reintento',()=>{
  const view=host(false,Retry,{...retrySummary,payment_state:'in_process',has_active_review:true});try{assert(!find(view.render(),node=>node.type==='button'));}finally{view.unmount();}
});
