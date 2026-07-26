"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Edit2,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMyDirectorySubscription } from "@/hooks/useMyDirectorySubscription";
import { servicesService } from "@/services/servicesService";
import type { SupplierService } from "@/types/services";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";

const PAGE_SIZE = 10;

type ToastState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

export default function AdminServicesPage() {
  const { isDirectory, loading: subscriptionLoading } =
    useMyDirectorySubscription();
  const [services, setServices] = useState<SupplierService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const deferredSearch = useDeferredValue(search);

  const loadServices = async () => {
    setLoading(true);
    setError(null);
    try {
      setServices(await servicesService.listMine({ skip: 0, limit: 100 }));
    } catch (requestError) {
      setServices([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar tus servicios.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subscriptionLoading) return;
    if (!isDirectory) {
      setLoading(false);
      return;
    }
    void loadServices();
  }, [isDirectory, subscriptionLoading]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredServices = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase("es");
    if (!query) return services;
    return services.filter((service) =>
      service.title.toLocaleLowerCase("es").includes(query),
    );
  }, [deferredSearch, services]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / PAGE_SIZE));
  const visibleServices = filteredServices.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [deferredSearch]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const deleteService = async (service: SupplierService) => {
    if (
      !window.confirm(
        `¿Eliminar “${service.title}”? También se borrarán todas sus imágenes.`,
      )
    ) {
      return;
    }
    setDeletingId(service.id);
    try {
      await servicesService.delete(service.id);
      setServices((current) =>
        current.filter((item) => item.id !== service.id),
      );
      setToast({ type: "success", message: "El servicio se eliminó." });
    } catch (requestError) {
      setToast({
        type: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "No se pudo eliminar el servicio.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (subscriptionLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <Loader2 className="animate-spin text-[#168e00]" size={34} />
      </div>
    );
  }

  if (!isDirectory) {
    return (
      <div className="mx-auto max-w-2xl rounded-[1.75rem] border border-amber-200 bg-white p-8 text-center shadow-sm">
        <BriefcaseBusiness
          className="mx-auto text-[#004e28]"
          size={42}
          strokeWidth={1.7}
        />
        <h1 className="mt-4 font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">
          Servicios disponibles con plan Directorio
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-600">
          Tu cuenta necesita una suscripción activa de tipo directorio para
          administrar servicios.
        </p>
        <Link
          href="/admin/my-subscription"
          className="mt-6 inline-flex rounded-xl bg-[#004e28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#168e00]"
        >
          Ver mi suscripción
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Servicios"
        subtitle="Gestiona los servicios que se mostrarán en tu directorio empresarial."
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <label className="relative block sm:w-64">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <span className="sr-only">Buscar servicio</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar servicio..."
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10"
              />
            </label>
            <Link
              href="/admin/services/create"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#004e28] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#004e28]/15 transition hover:-translate-y-0.5 hover:bg-[#168e00]"
            >
              <Plus size={19} />
              Nuevo Servicio
            </Link>
          </div>
        }
      />

      <section className="overflow-hidden rounded-[1.4rem] border border-[#004e28]/10 bg-white shadow-[0_18px_55px_-42px_rgba(0,78,40,0.65)]">
        {loading ? (
          <div className="flex min-h-56 items-center justify-center">
            <Loader2 className="animate-spin text-[#168e00]" size={30} />
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => void loadServices()}
              className="mt-4 text-sm font-semibold text-[#004e28] hover:underline"
            >
              Intentar de nuevo
            </button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-[#f2f3f4]/45">
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Imagen
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Nombre
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Precio
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Estado
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleServices.map((service) => (
                    <tr
                      key={service.id}
                      className="transition hover:bg-[#f2f3f4]/40"
                    >
                      <td className="px-6 py-4">
                        <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-gray-100 bg-[#f2f3f4]">
                          {service.cover_thumbnail_url ||
                          service.cover_image_url ? (
                            <Image
                              src={
                                service.cover_thumbnail_url ??
                                service.cover_image_url ??
                                ""
                              }
                              alt={service.title}
                              fill
                              unoptimized
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : (
                            <BriefcaseBusiness className="absolute inset-0 m-auto text-gray-300" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">
                          {service.title}
                        </p>
                        <p className="mt-1 line-clamp-1 max-w-md text-xs text-gray-500">
                          {service.description}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#004e28]">
                        {new Intl.NumberFormat("es-MX", {
                          style: "currency",
                          currency: "MXN",
                        }).format(service.price)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            service.is_active
                              ? "border-green-100 bg-green-50 text-green-700"
                              : "border-gray-200 bg-gray-50 text-gray-500"
                          }`}
                        >
                          {service.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/services/${service.id}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-[#168e00]/10 hover:text-[#004e28]"
                            aria-label={`Editar ${service.title}`}
                          >
                            <Edit2 size={17} />
                          </Link>
                          <button
                            type="button"
                            disabled={deletingId !== null}
                            onClick={() => void deleteService(service)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            aria-label={`Eliminar ${service.title}`}
                          >
                            {deletingId === service.id ? (
                              <Loader2 size={17} className="animate-spin" />
                            ) : (
                              <Trash2 size={17} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-100 md:hidden">
              {visibleServices.map((service) => (
                <article key={service.id} className="p-4">
                  <div className="flex gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-[#f2f3f4]">
                      {service.cover_thumbnail_url || service.cover_image_url ? (
                        <Image
                          src={
                            service.cover_thumbnail_url ??
                            service.cover_image_url ??
                            ""
                          }
                          alt={service.title}
                          fill
                          unoptimized
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <BriefcaseBusiness className="absolute inset-0 m-auto text-gray-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-semibold text-gray-900">
                          {service.title}
                        </h2>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                            service.is_active
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {service.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#004e28]">
                        {new Intl.NumberFormat("es-MX", {
                          style: "currency",
                          currency: "MXN",
                        }).format(service.price)}
                      </p>
                      <div className="mt-2 flex justify-end gap-2">
                        <Link
                          href={`/admin/services/${service.id}`}
                          className="rounded-lg p-2 text-gray-400 hover:bg-[#168e00]/10 hover:text-[#004e28]"
                          aria-label={`Editar ${service.title}`}
                        >
                          <Edit2 size={17} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void deleteService(service)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Eliminar ${service.title}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {visibleServices.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <BriefcaseBusiness
                  className="mx-auto text-gray-300"
                  size={38}
                />
                <p className="mt-3 text-sm font-semibold text-gray-600">
                  {search
                    ? "No hay servicios que coincidan con tu búsqueda."
                    : "Aún no tienes servicios registrados."}
                </p>
              </div>
            ) : null}

            <footer className="flex items-center justify-between border-t border-gray-100 px-4 py-4 sm:px-6">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-500">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente
              </button>
            </footer>
          </>
        )}
      </section>

      {toast ? (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}

