import { getSitemapSnapshot, sitemapIndexXml } from "@/lib/sitemapData";

export const dynamic = "force-dynamic";

export async function GET() {
  const xml = sitemapIndexXml(await getSitemapSnapshot());
  return new Response(xml, { headers: {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60, stale-if-error=86400",
  } });
}
