import { getSitemapSnapshot, SITEMAP_PAGE_SIZE, sitemapUrlsetXml, type SitemapSnapshot } from "@/lib/sitemapData";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ part: string }> }) {
  const { part } = await params;
  const match = /^(pages|categories|suppliers|products|services)-(0|[1-9]\d*)\.xml$/.exec(part);
  if (!match) return new Response(null, { status: 404 });
  const snapshot = await getSitemapSnapshot();
  const entries = snapshot[match[1] as keyof SitemapSnapshot];
  const page = Number(match[2]);
  if (page >= Math.ceil(entries.length / SITEMAP_PAGE_SIZE)) return new Response(null, { status: 404 });
  return new Response(sitemapUrlsetXml(entries.slice(page * SITEMAP_PAGE_SIZE, (page + 1) * SITEMAP_PAGE_SIZE)), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
