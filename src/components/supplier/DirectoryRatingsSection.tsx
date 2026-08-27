"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, LockKeyhole, MessageCircle } from "lucide-react";
import StarRating from "@/components/StarRating";
import { supplierRatingsService } from "@/services/supplierRatingsService";
import { useAuthStore } from "@/store/useAuthStore";
import type { SupplierDirectoryRatingsResponse } from "@/types/supplierRatings";

export function DirectoryRatingsSection({ slug }: { slug: string }) {
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const [data, setData] = useState<SupplierDirectoryRatingsResponse | null>(
    null,
  );
  const [selectedRating, setSelectedRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supplierRatingsService
      .list(slug)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudieron cargar las opiniones.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, token]);

  const submitRating = async () => {
    if (!selectedRating || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await supplierRatingsService.create(slug, {
        rating: selectedRating,
        comment: comment.trim(),
      });
      const refreshed = await supplierRatingsService.list(slug);
      setData(refreshed);
      setComment("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar tu calificación.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="experiencia"
      className="scroll-mt-20 border-t border-gray-100 bg-white py-20 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <span className="text-sm font-bold uppercase tracking-[0.16em] text-[#168e00]">
              Experiencias reales
            </span>
            <h2 className="mt-3 font-[family-name:var(--font-varela-round)] text-3xl font-black text-[#004e28] md:text-4xl">
              Califica al negocio
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600">
              Cada usuario puede compartir una sola calificación sobre este
              negocio.
            </p>

            <div className="mt-7 flex items-end gap-4">
              <span className="font-[family-name:var(--font-varela-round)] text-5xl font-black text-[#004e28]">
                {(data?.average ?? 0).toFixed(1)}
              </span>
              <div className="pb-1">
                <StarRating rating={data?.average ?? 0} size={20} />
                <p className="mt-1 text-xs text-gray-500">
                  {data?.total ?? 0}{" "}
                  {(data?.total ?? 0) === 1 ? "opinión" : "opiniones"}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-[#004e28]/10 bg-[#f7f9f8] p-5">
              {!token ? (
                <div className="text-center">
                  <LockKeyhole className="mx-auto text-[#168e00]" size={26} />
                  <p className="mt-3 text-sm font-semibold text-[#004e28]">
                    Inicia sesión para calificar
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    La sesión activa permite asegurar una sola opinión por
                    usuario.
                  </p>
                  <Link
                    href={`/login?redirect=${encodeURIComponent(pathname)}`}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#004e28] px-5 text-sm font-semibold text-white transition hover:bg-[#168e00]"
                  >
                    Iniciar sesión
                  </Link>
                </div>
              ) : data?.my_rating ? (
                <div>
                  <div className="flex items-center gap-2 text-[#168e00]">
                    <CheckCircle2 size={20} />
                    <p className="font-semibold">Tu calificación fue registrada</p>
                  </div>
                  <div className="mt-3">
                    <StarRating rating={data.my_rating.rating} size={20} />
                  </div>
                  {data.my_rating.comment ? (
                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      “{data.my_rating.comment}”
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-gray-400">
                    Solo se permite una calificación por negocio.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-[#004e28]">
                    ¿Cómo fue tu experiencia?
                  </p>
                  <div className="mt-3">
                    <StarRating
                      rating={selectedRating}
                      size={28}
                      interactive
                      onRatingChange={setSelectedRating}
                    />
                  </div>
                  <label className="mt-4 block">
                    <span className="sr-only">Comentario</span>
                    <textarea
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      maxLength={1000}
                      rows={4}
                      placeholder="Cuéntanos tu experiencia (opcional)"
                      className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={submitRating}
                    disabled={!selectedRating || submitting}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#004e28] px-5 text-sm font-semibold text-white transition hover:bg-[#168e00] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : null}
                    Publicar calificación
                  </button>
                </div>
              )}
              {error ? (
                <p className="mt-3 text-center text-xs font-medium text-red-600">
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-[#004e28]">
                Opiniones del negocio
              </h3>
            </div>
            {loading ? (
              <div className="grid gap-5 md:grid-cols-2">
                {[1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-52 animate-pulse rounded-[1.5rem] bg-[#f2f3f4]"
                  />
                ))}
              </div>
            ) : data?.ratings.length ? (
              <div className="grid gap-5 md:grid-cols-2">
                {data.ratings.map((rating) => (
                  <article
                    key={rating.id}
                    className="rounded-[1.5rem] border border-gray-100 bg-[#f7f9f8] p-6"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#004e28] font-bold text-white">
                        {rating.user_name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {rating.user_name}
                        </p>
                        <StarRating rating={rating.rating} size={15} />
                      </div>
                    </div>
                    <p className="mt-5 text-sm leading-6 text-gray-600">
                      {rating.comment || "Calificación sin comentario."}
                    </p>
                    <p className="mt-5 text-xs text-gray-400">
                      {new Date(rating.created_at).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-[2rem] bg-[#f7f9f8] px-6 text-center">
                <MessageCircle className="text-gray-300" size={44} />
                <p className="mt-4 font-semibold text-[#004e28]">
                  Aún no hay opiniones
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Sé la primera persona en compartir su experiencia.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
