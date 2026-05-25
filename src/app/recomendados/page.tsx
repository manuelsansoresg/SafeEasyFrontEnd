import { AdsCarousel } from "@/components/AdsCarousel";
import { RecommendedExplorer } from "@/components/RecommendedExplorer";

type SearchParams = { [key: string]: string | string[] | undefined };

const DEFAULT_KIND = "most_searched" as const;

export default function RecomendadosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const kindParam = searchParams.kind;
  const kindValue =
    typeof kindParam === "string" ? kindParam : DEFAULT_KIND;

  const kind =
    kindValue === "most_purchased" || kindValue === "best_rated"
      ? kindValue
      : DEFAULT_KIND;

  return (
    <div className="container mx-auto px-4 py-6 pt-24 md:pt-28">
      <AdsCarousel />

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Descubre productos destacados
        </h1>
        <p className="text-gray-500 text-sm">
          Explora los productos más buscados, más comprados y mejor calificados.
        </p>
      </div>

      <RecommendedExplorer initialKind={kind} />
    </div>
  );
}

