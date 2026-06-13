import type { MetadataRoute } from "next";
import { absoluteSiteUrl, getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/proxy/",
          "/client/",
          "/cart/",
          "/checkout/",
          "/login/",
          "/register/",
          "/support/",
          "/payment-info/",
          "/mis-pedidos/",
          "/product/*/similar/",
        ],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
    host: absoluteSiteUrl("/"),
  };
}
