import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/sitemapData.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function loadModule(fetchImpl) {
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    fetch: fetchImpl,
    AbortSignal,
    Date,
    Set,
    Map,
    Number,
    Array,
    Promise,
    encodeURIComponent,
    require(id) {
      if (id === "next/cache") return { unstable_cache: (fn) => fn };
      if (id === "@/lib/seo") return {
        absoluteSiteUrl: (path) => `https://drooopy.com${path.endsWith("/") ? path : `${path}/`}`,
        getApiBaseUrl: () => "https://api.test/api",
      };
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return exports;
}

function mockApi({ fail = false } = {}) {
  const suppliers = Array.from({ length: 1202 }, (_, index) => ({ id: index + 1, slug: `supplier-${index + 1}`, is_active: true, is_directory: index === 0 }));
  suppliers[10].is_active = false;
  const products = Array.from({ length: 1205 }, (_, index) => ({ id: index + 1, slug: `product-${index + 1}`, is_active: true, supplier: { id: index + 1 } }));
  products[20].is_active = false;
  const categories = [{ id: 1, slug: "valid", is_active: true }, { id: 2, slug: "hidden", is_active: false }];
  const services = [
    { id: "a7f31f30-32f5-477a-a798-080347929321", supplier_id: 1, is_active: true, is_agenda_only: false },
    ...Array.from({ length: 104 }, (_, index) => ({ id: String(index), supplier_id: 2, is_active: false, is_agenda_only: false })),
  ];
  const data = { suppliers, products, categories, services };
  const calls = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    const kind = parsed.pathname.split("/")[2];
    const skip = Number(parsed.searchParams.get("skip"));
    const limit = Number(parsed.searchParams.get("limit"));
    calls.push({ kind, skip, limit });
    if (fail && kind === "products" && skip === 1000) return { ok: false, status: 503 };
    return { ok: true, json: async () => data[kind].slice(skip, skip + limit) };
  };
  return { fetchImpl, calls };
}

test("sitemap recorre más de 1,000 registros, excluye los no públicos y produce XML único", async () => {
  const { fetchImpl, calls } = mockApi();
  const sitemap = loadModule(fetchImpl);
  const snapshot = await sitemap.loadSitemapSnapshot();
  assert.equal(snapshot.suppliers.length, 1201);
  assert.equal(snapshot.products.length, 1200);
  assert.equal(snapshot.categories.length, 1);
  assert.equal(snapshot.services.length, 1);
  assert(calls.some((call) => call.kind === "products" && call.skip === 1000));
  assert(calls.some((call) => call.kind === "services" && call.skip === 100));
  const xml = sitemap.sitemapUrlsetXml(snapshot.products);
  assert(xml.includes("https://drooopy.com/product/product-1202/"));
  assert(!xml.includes("https://drooopy.com/product/product-11/"));
  assert.equal((xml.match(/<loc>/g) || []).length, new Set(snapshot.products.map((entry) => entry.url)).size);
  assert(sitemap.sitemapIndexXml(snapshot).includes("/sitemaps/services-0.xml"));
});

test("un fallo en una página del API cancela la publicación completa", async () => {
  const sitemap = loadModule(mockApi({ fail: true }).fetchImpl);
  await assert.rejects(sitemap.loadSitemapSnapshot(), /HTTP 503/);
});

test("divide colecciones grandes en archivos de 10,000 URLs", () => {
  const sitemap = loadModule(async () => ({ ok: true, json: async () => [] }));
  const snapshot = { pages: [{ url: "https://drooopy.com/" }], categories: [], suppliers: [], products: Array.from({ length: 20001 }, (_, index) => ({ url: `https://drooopy.com/product/${index}/` })), services: [] };
  const parts = sitemap.sitemapParts(snapshot);
  assert.equal(parts.filter((part) => part.kind === "products").length, 3);
  assert.equal(snapshot.products.slice(20000).length, 1);
});
