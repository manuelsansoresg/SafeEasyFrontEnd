import type { Metadata } from "next";
import { DirectoryLanding } from "@/components/directorio/DirectoryLanding";
import { MetaPixel } from "@/components/directorio/MetaPixel";
import { buildMetadata, getApiBaseUrl, listFromPayload } from "@/lib/seo";
import type { Plan } from "@/types/subscriptions";

type SearchParams = Record<string, string | string[] | undefined>;

const title = "Directorio de negocios | Da visibilidad a tu negocio";
const description =
  "Crea un espacio para tu negocio dentro del directorio de Drooopy y muestra tus servicios, información, imágenes y formas de contacto.";

export const metadata: Metadata = buildMetadata({
  title,
  description,
  path: "/directorio",
});

const toEntries = (searchParams: SearchParams): Array<[string, string]> =>
  Object.entries(searchParams).flatMap(([key, value]) => {
    if (typeof value === "string") return [[key, value] as [string, string]];
    if (Array.isArray(value)) return value.map((item) => [key, item] as [string, string]);
    return [];
  });

const getDirectoryPlan = async (accessCode: string): Promise<Plan | null> => {
  const params = new URLSearchParams({
    skip: "0",
    limit: "1000",
    only_active: "true",
  });

  if (accessCode) {
    params.set("access_code", accessCode);
    params.set("is_demo", "true");
  } else {
    params.set("is_listed", "true");
    params.set("is_demo", "false");
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/plans/?${params.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return listFromPayload<Plan>(payload).find((plan) => plan.is_active && plan.is_directory) ?? null;
  } catch {
    return null;
  }
};

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const entries = toEntries(resolvedSearchParams);
  const accessCode =
    typeof resolvedSearchParams.code === "string" ? resolvedSearchParams.code.trim() : "";
  const directoryPlan = await getDirectoryPlan(accessCode);

  return (
    <>
      <MetaPixel />
      <DirectoryLanding
        initialPlan={directoryPlan}
        campaignParams={entries}
      />
    </>
  );
}
