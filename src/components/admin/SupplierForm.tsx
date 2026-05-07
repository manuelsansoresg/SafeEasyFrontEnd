"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, CheckCircle, UserPlus, Users, Search } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import { loadGoogleMaps, parseMapLocation, type LatLngLiteral } from "@/lib/googleMaps";
import FileUpload from "@/components/ui/FileUpload";
import MapPicker from "@/components/ui/MapPicker";
import { Toast } from "@/components/ui/Toast";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  rfc?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  country: string;
  is_active: boolean;
  user_id: number;
  // Extended fields
  short_description?: string;
  description?: string;
  address?: string;
  exterior_number?: string;
  interior_number?: string;
  neighborhood?: string;
  zip_code?: string;
  cp?: string;
  cross_street_1?: string;
  cross_street_2?: string;
  logo?: string;
  logo_url?: string;
  about?: string;
  about_media?: string;
  about_media_url?: string;
  about_image?: string;
  about_image_url?: string;
  transfer_accepted?: boolean;
  transfer_clabe?: string;
  transfer_bank?: string;
  transfer_name?: string;
  map_location?: string | LatLngLiteral | null;
}

function parseSupplierMapLocation(value: unknown): LatLngLiteral | null {
  return parseMapLocation(value);
}

function serializeMapLocation(location: LatLngLiteral) {
  return `${Number(location.lat)},${Number(location.lng)}`;
}

interface SupplierFormProps {
  initialData?: Supplier;
  isEditMode?: boolean;
}

export default function SupplierForm({ initialData, isEditMode = false }: SupplierFormProps) {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  
  // User Management for Admin
  type UserOption = { id: number; email: string; full_name?: string; name?: string };
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userMode, setUserMode] = useState<'existing' | 'new' | 'current'>('current');
  const [selectedUserId, setSelectedUserId] = useState<number | string>("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);

  const isMyCompanyPage = String(pathname || "").startsWith("/admin/my-company");
  const roleKeyFromStore = String(user?.role || "").toLowerCase();
  const roleKeyFromStorage = (() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem("auth-storage");
      if (!raw) return "";
      const parsed = JSON.parse(raw) as unknown;
      const rec = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
      const state = rec && typeof rec.state === "object" && rec.state ? (rec.state as Record<string, unknown>) : rec;
      const storedUser =
        state && typeof state.user === "object" && state.user ? (state.user as Record<string, unknown>) : null;
      const role = storedUser && typeof storedUser.role === "string" ? storedUser.role : null;
      return String(role || "").toLowerCase();
    } catch {
      return "";
    }
  })();
  const effectiveRoleKey = roleKeyFromStore || roleKeyFromStorage;
  const isSupplierRole = ["supplier", "proveedor", "provider", "vendor", "seller"].includes(effectiveRoleKey);

  const showMercadoPagoSection = isMyCompanyPage && isSupplierRole;
  const canLoadMercadoPagoStatus = showMercadoPagoSection && !!token;

  const [mpAccount, setMpAccount] = useState<{ connected: boolean; email: string | null }>({
    connected: false,
    email: null,
  });
  const [mpStatusLoading, setMpStatusLoading] = useState(false);
  const [mpConnectLoading, setMpConnectLoading] = useState(false);
  const [mpDisconnectLoading, setMpDisconnectLoading] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Load initial user if exists
  useEffect(() => {
    if (initialData?.user_id) {
        // We need to fetch the specific user to show it in the select even if not in search results
        const fetchInitialUser = async () => {
            try {
                // Try to get specific user. Note: standard endpoint might be /api/users/{id}
                const response = await fetchWithAuth(`/api/users/${initialData.user_id}`);
                if (response.ok) {
                    const data = (await response.json().catch(() => null)) as unknown;
                    const rec =
                      data && typeof data === "object" ? (data as Record<string, unknown>) : null;
                    const id = rec && typeof rec.id === "number" ? rec.id : null;
                    if (id == null) return;
                    const email = rec && typeof rec.email === "string" ? rec.email : "";
                    const full_name =
                      rec && typeof rec.full_name === "string" ? rec.full_name : undefined;
                    const name = rec && typeof rec.name === "string" ? rec.name : undefined;
                    const loadedUser: UserOption = { id, email, full_name, name };
                    setUsers(prev => {
                        if (prev.find(u => u.id === loadedUser.id)) return prev;
                        return [loadedUser, ...prev];
                    });
                    setSelectedUserId(loadedUser.id);
                }
            } catch (e) {
                console.error("Error loading initial user", e);
            }
        };
        fetchInitialUser();
    }
  }, [initialData]);

  type NormalizedMpAccount = { connected: boolean; email: string | null };

  const normalizeMpAccount = useCallback((payload: unknown): NormalizedMpAccount | null => {
    const toRecord = (value: unknown) =>
      value && typeof value === "object" ? (value as Record<string, unknown>) : null;

    const getString = (rec: Record<string, unknown> | null, key: string) =>
      rec && typeof rec[key] === "string" ? (rec[key] as string) : null;

    const getBool = (rec: Record<string, unknown> | null, key: string) =>
      rec && typeof rec[key] === "boolean" ? (rec[key] as boolean) : null;

    const coerceConnected = (rec: Record<string, unknown> | null) => {
      const direct =
        getBool(rec, "connected") ??
        getBool(rec, "is_connected") ??
        getBool(rec, "isLinked") ??
        getBool(rec, "is_linked") ??
        getBool(rec, "linked") ??
        getBool(rec, "mp_is_linked") ??
        getBool(rec, "mpIsLinked");
      if (typeof direct === "boolean") return direct;
      const status =
        getString(rec, "status") || getString(rec, "state") || getString(rec, "connection_status");
      if (status) {
        const s = status.toLowerCase();
        if (["connected", "linked", "active", "ok"].includes(s)) return true;
        if (["disconnected", "unlinked", "inactive"].includes(s)) return false;
      }
      const hasToken =
        typeof rec?.access_token === "string" ||
        typeof rec?.token === "string" ||
        typeof rec?.refresh_token === "string";
      return hasToken ? true : null;
    };

    const coerceEmail = (rec: Record<string, unknown> | null) => {
      const direct =
        getString(rec, "email") ||
        getString(rec, "account_email") ||
        getString(rec, "payer_email") ||
        getString(rec, "connected_email") ||
        getString(rec, "mp_email") ||
        getString(rec, "mp_connected_email");
      if (direct) return direct;
      const account = toRecord(rec?.account);
      return getString(account, "email");
    };

    const normalizeFromRecord = (rec: Record<string, unknown>): NormalizedMpAccount | null => {
      const connected = coerceConnected(rec);
      if (connected == null) return null;
      return { connected, email: coerceEmail(rec) ?? null };
    };

    const normalize = (value: unknown): NormalizedMpAccount | null => {
      if (Array.isArray(value)) {
        for (const entry of value) {
          const rec = toRecord(entry);
          if (!rec) continue;
          const provider =
            (getString(rec, "provider") || getString(rec, "platform") || getString(rec, "name") || "").toLowerCase();
          const accountType = (getString(rec, "account_type") || getString(rec, "type") || "").toLowerCase();
          if (provider && !provider.includes("mercado")) continue;
          if (accountType && accountType !== "supplier") continue;
          const normalized = normalizeFromRecord(rec);
          if (normalized) return normalized;
        }
        return null;
      }

      const rec = toRecord(value);
      if (!rec) return null;

      if (Array.isArray(rec.payment_accounts)) {
        const normalized = normalize(rec.payment_accounts);
        if (normalized) return normalized;
      }

      if (Array.isArray(rec.accounts)) {
        const normalized = normalize(rec.accounts);
        if (normalized) return normalized;
      }

      return normalizeFromRecord(rec);
    };

    return normalize(payload);
  }, []);

  const loadMercadoPagoAccount = useCallback(async () => {
    if (!canLoadMercadoPagoStatus) return;
    setMpStatusLoading(true);
    try {
      const candidates = [
        "/api/mercadopago/account?account_type=supplier",
        "/api/mercadopago/status?account_type=supplier",
        "/api/mercadopago/account-status?account_type=supplier",
      ];

      for (const url of candidates) {
        const res = await fetchWithAuth(url, { headers: { Accept: "application/json" } });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const normalized = normalizeMpAccount(data);
          if (normalized) {
            setMpAccount({ connected: normalized.connected, email: normalized.email ?? null });
            return;
          }
        } else if (res.status !== 404) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Error ${res.status}`);
        }
      }

      const meRes = await fetchWithAuth("/api/users/me", { headers: { Accept: "application/json" } });
      if (!meRes.ok) {
        setMpAccount({ connected: false, email: null });
        return;
      }

      const meData = await meRes.json().catch(() => null);
      const normalized = normalizeMpAccount(meData);
      setMpAccount(
        normalized ? { connected: normalized.connected, email: normalized.email ?? null } : { connected: false, email: null }
      );
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e && typeof (e as Record<string, unknown>).message === "string"
          ? String((e as Record<string, unknown>).message)
          : "No se pudo validar la vinculación de Mercado Pago.";
      setToast({ type: "error", message: msg });
    } finally {
      setMpStatusLoading(false);
    }
  }, [canLoadMercadoPagoStatus, normalizeMpAccount]);

  useEffect(() => {
    if (!canLoadMercadoPagoStatus) return;
    loadMercadoPagoAccount();

    const onFocus = () => loadMercadoPagoAccount();
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadMercadoPagoAccount();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(loadMercadoPagoAccount, 15000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [canLoadMercadoPagoStatus, loadMercadoPagoAccount]);

  const handleMercadoPagoConnect = async () => {
    if (!showMercadoPagoSection) return;
    setMpConnectLoading(true);
    try {
      window.location.href = "/api/mercadopago/connect?account_type=supplier&redirect=true";
    } catch (e: unknown) {
      console.error("[MercadoPago Connect] Redirect failed", e);
      const msg =
        e && typeof e === "object" && "message" in e && typeof (e as Record<string, unknown>).message === "string"
          ? String((e as Record<string, unknown>).message)
          : "No se pudo iniciar la vinculación con Mercado Pago.";
      setToast({ type: "error", message: msg });
      setMpConnectLoading(false);
    }
  };

  const handleMercadoPagoDisconnect = async () => {
    if (!canLoadMercadoPagoStatus) return;
    setMpDisconnectLoading(true);
    try {
      const res = await fetchWithAuth("/api/mercadopago/disconnect?account_type=supplier", {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error ${res.status}`);
      }
      setToast({ type: "success", message: "Cuenta de Mercado Pago desconectada." });
      await loadMercadoPagoAccount();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e && typeof (e as Record<string, unknown>).message === "string"
          ? String((e as Record<string, unknown>).message)
          : "No se pudo desconectar la cuenta de Mercado Pago.";
      setToast({ type: "error", message: msg });
    } finally {
      setMpDisconnectLoading(false);
    }
  };

  const fetchUsers = useCallback(async (term: string = "") => {
      setIsSearchingUsers(true);
      try {
          // Construct query params
          const params = new URLSearchParams();
          params.append('limit', '20'); // Limit results to prevent saturation
          if (term) {
              params.append('search', term); // Assuming backend supports 'search'
              // Also sending email just in case backend filters by email specifically
              if (term.includes('@')) {
                  params.append('email', term);
              }
          }

          const response = await fetchWithAuth(`/api/users/?${params.toString()}`);
          if (response.ok) {
              const data = (await response.json().catch(() => null)) as unknown;
              const toRecord = (value: unknown) =>
                value && typeof value === "object" ? (value as Record<string, unknown>) : null;
              const toUserOption = (value: unknown): UserOption | null => {
                const rec = toRecord(value);
                if (!rec) return null;
                const id = typeof rec.id === "number" ? rec.id : null;
                if (id == null) return null;
                const email = typeof rec.email === "string" ? rec.email : "";
                const full_name = typeof rec.full_name === "string" ? rec.full_name : undefined;
                const name = typeof rec.name === "string" ? rec.name : undefined;
                return { id, email, full_name, name };
              };

              const list = Array.isArray(data)
                ? data
                : (() => {
                    const rec = toRecord(data);
                    return rec && Array.isArray(rec.items) ? rec.items : [];
                  })();

              const newUsers: UserOption[] = [];
              for (const entry of list) {
                const u = toUserOption(entry);
                if (u) newUsers.push(u);
              }
              
              setUsers(prev => {
                  // Keep the selected user in the list if it exists
                  const selected = prev.find(u => u.id === Number(selectedUserId));
                  if (selected && !newUsers.find(u => u.id === selected.id)) {
                      return [selected, ...newUsers];
                  }
                  return newUsers;
              });
          }
      } catch (e) {
          console.error("Error loading users", e);
      } finally {
          setIsSearchingUsers(false);
      }
  }, [selectedUserId]);

  // Debounced Search
  useEffect(() => {
    if (userMode !== 'existing') return;

    const delayDebounceFn = setTimeout(() => {
      fetchUsers(userSearchTerm);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [userSearchTerm, userMode, fetchUsers]);

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    short_name: initialData?.short_name || "",
    rfc: initialData?.rfc || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    country: initialData?.country || "Mexico",
    is_active: initialData?.is_active ?? true,
    // Extended
    short_description: initialData?.short_description || "",
    description: initialData?.description || "",
    address: initialData?.address || "",
    exterior_number: initialData?.exterior_number || "",
    interior_number: initialData?.interior_number || "",
    neighborhood: initialData?.neighborhood || "",
    zip_code: initialData?.zip_code || "",
    cp: initialData?.cp || initialData?.zip_code || "",
    cross_street_1: initialData?.cross_street_1 || "",
    cross_street_2: initialData?.cross_street_2 || "",
    about: initialData?.about || "",
    transfer_accepted: initialData?.transfer_accepted || false,
    transfer_clabe: initialData?.transfer_clabe || "",
    transfer_bank: initialData?.transfer_bank || "",
    transfer_name: initialData?.transfer_name || "",
  });

  const [mapLocation, setMapLocation] = useState<LatLngLiteral | null>(() =>
    parseSupplierMapLocation(initialData?.map_location ?? null),
  );

  const [logo, setLogo] = useState<File | null>(null);
  const [aboutImage, setAboutImage] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    initialData?.logo || initialData?.logo_url || null
  );
  const [aboutMediaPreviewUrl, setAboutMediaPreviewUrl] = useState<string | null>(
    initialData?.about_media ||
      initialData?.about_media_url ||
      initialData?.about_image ||
      initialData?.about_image_url ||
      null
  );
  const [clearLogo, setClearLogo] = useState(false);
  const [clearAboutMedia, setClearAboutMedia] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState("");

  useEffect(() => {
    setLogoPreviewUrl(initialData?.logo || initialData?.logo_url || null);
    setAboutMediaPreviewUrl(
      initialData?.about_media ||
        initialData?.about_media_url ||
        initialData?.about_image ||
        initialData?.about_image_url ||
        null
    );
    setMapLocation(parseSupplierMapLocation(initialData?.map_location ?? null));
  }, [initialData]);

  const buildMapAddressQuery = () => {
    const street = String(formData.address || "").trim();
    let streetPart = street;
    if (streetPart && !/^(calle|c\.|av\.?|avenida|blvd|boulevard|cerrada|privada|calzada|andador|retorno)/i.test(streetPart)) {
      streetPart = `Calle ${streetPart}`;
    }

    const exteriorNumber = String(formData.exterior_number || "").trim();
    const parts = [
      streetPart ? `${streetPart} ${exteriorNumber}`.trim() : "",
      formData.neighborhood,
      formData.cp || formData.zip_code,
      formData.city,
      formData.state,
      formData.country,
    ]
      .map((part) => String(part || "").trim())
      .filter(Boolean);

    return parts.join(", ");
  };

  const geocodeMapAddress = async (): Promise<LatLngLiteral | null> => {
    const typedMapQuery = mapSearchQuery.trim();
    const query = typedMapQuery || buildMapAddressQuery();
    if (!query) return null;

    try {
      const g = await loadGoogleMaps(["places"]);
      const geocoder = new g.maps.Geocoder();
      const result = await new Promise<{ results?: unknown[]; status?: string }>((resolve) => {
        geocoder.geocode({ address: query, region: "MX" }, (results: unknown[] | null, status: string) => {
          resolve({ results: results || [], status });
        });
      });

      if (result.status === "OK") {
        const first = result.results?.[0] as { geometry?: { location?: { lat?: () => number; lng?: () => number } } } | undefined;
        const loc = first?.geometry?.location;
        const lat = Number(loc?.lat?.());
        const lng = Number(loc?.lng?.());
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    } catch {
      // Fallback below keeps supplier editing usable if Google geocoding is unavailable.
    }

    const fallbackQueries = [
      query,
      typedMapQuery ? buildMapAddressQuery() : "",
      formData.cp || formData.zip_code ? `${formData.cp || formData.zip_code}, ${formData.city}, ${formData.state}, ${formData.country}` : "",
      `${formData.city}, ${formData.state}, ${formData.country}`,
    ].filter(Boolean);

    for (const fallbackQuery of fallbackQueries) {
      const searchParams = new URLSearchParams({
        format: "json",
        limit: "1",
        countrycodes: "mx",
        q: fallbackQuery,
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${searchParams.toString()}`, {
        headers: { Accept: "application/json" },
      }).catch(() => null);
      if (!res?.ok) continue;
      const data: unknown = await res.json().catch(() => null);
      const first = Array.isArray(data) ? (data[0] as { lat?: string; lon?: string } | undefined) : undefined;
      const lat = Number(first?.lat);
      const lng = Number(first?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => {
      // Sincronizar cp <-> zip_code
      if (name === 'cp') {
        return { ...prev, cp: String(val), zip_code: String(val) };
      }
      if (name === 'zip_code') {
        return { ...prev, zip_code: String(val), cp: String(val) };
      }
      return { ...prev, [name]: val };
    });
  };

  const handleLogoChange = (file: File | null) => {
    setLogo(file);
    if (!file && !isEditMode) {
      setLogoPreviewUrl(null);
    }
    if (!isEditMode) return;
    if (initialData?.logo || initialData?.logo_url) {
      setClearLogo(file === null || file instanceof File);
    } else {
      setClearLogo(false);
    }
  };

  const handleAboutImageChange = (file: File | null) => {
    setAboutImage(file);
    if (!file && !isEditMode) {
      setAboutMediaPreviewUrl(null);
    }
    if (!isEditMode) return;
    const hadInitial =
      initialData?.about_media ||
      initialData?.about_media_url ||
      initialData?.about_image ||
      initialData?.about_image_url;

    if (hadInitial) {
      setClearAboutMedia(file === null || file instanceof File);
    } else {
      setClearAboutMedia(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user) {
        setError("No hay sesión activa");
        return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      // Default: The current session user (for new creations by regular users)
      let finalUserId = user.id; 
      
      // If we are editing, default to the EXISTING owner of the record
      if (isEditMode && initialData?.user_id) {
          finalUserId = initialData.user_id;
      }

      if (user.role === 'admin') {
          if (userMode === 'existing') {
              if (!selectedUserId) {
                  setError("Debes seleccionar un usuario para asignar al proveedor");
                  setIsSubmitting(false);
                  return;
              }
              finalUserId = Number(selectedUserId);
          } else if (userMode === 'new') {
              if (!newUser.email || !newUser.password || !newUser.name) {
                  setError("Todos los campos del nuevo usuario son obligatorios");
                  setIsSubmitting(false);
                  return;
              }
              // Create user first
              try {
                  const userResponse = await fetchWithAuth('/api/users', {
                      method: 'POST',
                      body: JSON.stringify({
                          ...newUser,
                          role: 'supplier',
                          is_active: true
                      })
                  });
                  
                  if (!userResponse.ok) {
                      const errText = await userResponse.text();
                      let errMsg = errText;
                      try {
                          const json = JSON.parse(errText);
                          errMsg = json.detail || JSON.stringify(json);
                      } catch {}
                      throw new Error("Error al crear el usuario: " + errMsg);
                  }
                  
                  const createdUser = await userResponse.json();
                  finalUserId = createdUser.id;
              } catch (e: unknown) {
                  const msg =
                    e && typeof e === "object" && "message" in e && typeof (e as Record<string, unknown>).message === "string"
                      ? String((e as Record<string, unknown>).message)
                      : "Error al crear el usuario";
                  setError(msg);
                  setIsSubmitting(false);
                  return;
              }
          }
          // If userMode is 'current', we keep the finalUserId set at the beginning 
          // (either initialData.user_id if editing, or user.id if creating)
      }

      const slug = formData.short_name 
        ? formData.short_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        : formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const isEdit = isEditMode && initialData;

      let resolvedMapLocation = mapLocation;
      if (!resolvedMapLocation) {
        resolvedMapLocation = await geocodeMapAddress();
        if (resolvedMapLocation) {
          setMapLocation(resolvedMapLocation);
        }
      }

      if (!resolvedMapLocation && buildMapAddressQuery()) {
        setError("No se pudo obtener la ubicación del mapa. Usa 'Buscar con datos del formulario' o haz clic en el mapa antes de guardar.");
        setIsSubmitting(false);
        return;
      }

      let response: Response;

      const buildFormData = (nextMapLocation: LatLngLiteral | null) => {
        const data = new FormData();

        const appendIfPresent = (key: string, value: unknown) => {
          if (value !== null && value !== undefined && value !== "") {
            data.append(key, String(value).trim());
          }
        };

        // Transfer Data Validation
        if (formData.transfer_accepted) {
             if (!formData.transfer_clabe || !/^\d{18}$/.test(formData.transfer_clabe)) {
                 setError("La CLABE debe tener 18 dígitos numéricos.");
                 setIsSubmitting(false);
                 throw new Error("Validación fallida"); 
             }
             if (!formData.transfer_bank) {
                 setError("El nombre del banco es obligatorio.");
                 setIsSubmitting(false);
                 throw new Error("Validación fallida");
             }
             if (!formData.transfer_name) {
                 setError("El nombre del beneficiario es obligatorio.");
                 setIsSubmitting(false);
                 throw new Error("Validación fallida");
             }
             
             data.append('transfer_accepted', 'true');
             data.append('transfer_clabe', formData.transfer_clabe);
             data.append('transfer_bank', formData.transfer_bank);
             data.append('transfer_name', formData.transfer_name);
        } else {
            data.append('transfer_accepted', 'false');
            // Optional: clear other fields if not accepted, depends on backend
        }

        appendIfPresent("name", formData.name);
        data.append("short_name", slug);

        appendIfPresent("rfc", formData.rfc);
        appendIfPresent("phone", formData.phone);
        appendIfPresent("email", formData.email);
        appendIfPresent("city", formData.city);
        appendIfPresent("state", formData.state);
        appendIfPresent("country", formData.country);
        data.append("is_active", String(formData.is_active));
        appendIfPresent("short_description", formData.short_description);
        appendIfPresent("description", formData.description);
        appendIfPresent("address", formData.address);
        appendIfPresent("exterior_number", formData.exterior_number);
        appendIfPresent("interior_number", formData.interior_number);
        appendIfPresent("neighborhood", formData.neighborhood);
        appendIfPresent("zip_code", formData.zip_code);
        appendIfPresent("cp", formData.cp);
        appendIfPresent("cross_street_1", formData.cross_street_1);
        appendIfPresent("cross_street_2", formData.cross_street_2);
        appendIfPresent("about", formData.about);
        
        if (nextMapLocation) {
          data.append("map_location", serializeMapLocation(nextMapLocation));
        }

        data.append("user_id", String(finalUserId));

        if (logo) data.append("logo", logo);
        if (aboutImage) {
          data.append("about_media", aboutImage);
          data.append("about_image", aboutImage);
        }
        if (isEdit && clearLogo) {
          data.append("clear_logo", "true");
        }
        if (isEdit && clearAboutMedia) {
          data.append("clear_about_media", "true");
        }

        return data;
      };

      if (isEdit) {
        const url = `/api/suppliers/${initialData.id}`;
        const data = buildFormData(resolvedMapLocation);

        response = await fetchWithAuth(url, {
          method: "PUT",
          body: data,
        });
      } else {
        const data = buildFormData(resolvedMapLocation);

        response = await fetchWithAuth("/api/suppliers", {
          method: "POST",
          body: data,
        });
      }

      if (!response.ok) {
        const errData = await response
          .json()
          .catch(
            () =>
              ({
                detail: undefined,
                backend_response: undefined,
              }) as { detail?: unknown; backend_response?: unknown }
          );
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        
        if (errData.detail) {
          if (typeof errData.detail === 'string') {
            errorMessage = errData.detail;
          } else if (Array.isArray(errData.detail)) {
            const items = errData.detail as { loc: string[]; msg: string }[];
            errorMessage = items
              .map((err) => `${err.loc.join('.')} : ${err.msg}`)
              .join(', ');
          } else {
            errorMessage = JSON.stringify(errData.detail);
          }
        }

        if (errData.backend_response) {
          const backend =
            typeof errData.backend_response === 'string'
              ? errData.backend_response
              : JSON.stringify(errData.backend_response);
          errorMessage += ` | Detalles: ${backend}`;
        }

        setError(errorMessage);
        setIsSubmitting(false);
        return;
      }

      let updatedSupplier: unknown = null;
      try {
        updatedSupplier = await response.json();
      } catch {
        updatedSupplier = null;
      }

      if (updatedSupplier && typeof updatedSupplier === "object") {
        const rec = updatedSupplier as Record<string, unknown>;
        const newLogoUrl =
          (typeof rec.logo === "string" ? rec.logo : null) ||
          (typeof rec.logo_url === "string" ? rec.logo_url : null) ||
          null;
        const newAboutMediaUrl =
          (typeof rec.about_media === "string" ? rec.about_media : null) ||
          (typeof rec.about_media_url === "string" ? rec.about_media_url : null) ||
          (typeof rec.about_image === "string" ? rec.about_image : null) ||
          (typeof rec.about_image_url === "string" ? rec.about_image_url : null) ||
          null;
        const updatedMapLocation = parseSupplierMapLocation(rec.map_location);

        if (typeof newLogoUrl !== 'undefined') {
          setLogoPreviewUrl(newLogoUrl);
        }
        if (typeof newAboutMediaUrl !== 'undefined') {
          setAboutMediaPreviewUrl(newAboutMediaUrl);
        }
        setMapLocation(updatedMapLocation || resolvedMapLocation);
      } else if (resolvedMapLocation) {
        setMapLocation(resolvedMapLocation);
      }

      setLogo(null);
      setAboutImage(null);
      setClearLogo(false);
      setClearAboutMedia(false);

      setSuccess(true);
      if (!isEditMode) {
        router.push("/admin/suppliers");
      }
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      const msg =
        err && typeof err === "object" && "message" in err && typeof (err as Record<string, unknown>).message === "string"
          ? String((err as Record<string, unknown>).message)
          : "Ocurrió un error al guardar";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative flex items-center gap-2">
          <CheckCircle size={20} />
          <span>Información guardada correctamente</span>
        </div>
      )}

      {/* User Selection Section (Admin Only) */}
      {user?.role === 'admin' && (
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <Users size={20} />
            Asignación de Usuario
          </h3>
          
          <div className="flex flex-wrap gap-4 mb-4">
             <button
                type="button"
                onClick={() => setUserMode('existing')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    userMode === 'existing' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
             >
                Usuario Existente
             </button>
             <button
                type="button"
                onClick={() => setUserMode('new')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    userMode === 'new' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
             >
                <UserPlus size={16} />
                Crear Nuevo Usuario
             </button>
             {isEditMode && (
                 <button
                    type="button"
                    onClick={() => setUserMode('current')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        userMode === 'current' 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                 >
                    Mantener Actual
                 </button>
             )}
          </div>

          {userMode === 'existing' && (
              <div className="max-w-md">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Usuario</label>
                  <div className="mb-2 relative">
                      <input
                          type="text"
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                          placeholder="Buscar por nombre o email..."
                          className="w-full rounded-md border border-gray-300 px-3 py-2 pl-9 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      {isSearchingUsers ? (
                        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={16} />
                      ) : (
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      )}
                  </div>
                  
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar Usuario</label>
                  <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      size={5} // Show multiple items
                  >
                      {/* If nothing selected, show placeholder option */}
                      {!selectedUserId && <option value="">-- Seleccionar Usuario --</option>}
                      
                      {users.map(u => (
                          <option key={u.id} value={u.id}>
                              {u.full_name || u.name || u.email} ({u.email})
                          </option>
                      ))}
                      
                      {/* Message if no results */}
                      {!isSearchingUsers && users.length === 0 && (
                          <option disabled>No se encontraron usuarios</option>
                      )}
                  </select>
                  <p className="text-xs text-blue-600 mt-2">
                      {selectedUserId 
                        ? `Usuario seleccionado ID: ${selectedUserId}`
                        : "Usa el buscador para filtrar la lista y selecciona un usuario."}
                  </p>
              </div>
          )}

          {userMode === 'new' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                      <input
                          type="text"
                          value={newUser.name}
                          onChange={e => setNewUser({...newUser, name: e.target.value})}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Nombre del usuario"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                          type="email"
                          value={newUser.email}
                          onChange={e => setNewUser({...newUser, email: e.target.value})}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="usuario@ejemplo.com"
                      />
                  </div>
                  <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                      <input
                          type="password"
                          value={newUser.password}
                          onChange={e => setNewUser({...newUser, password: e.target.value})}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Contraseña segura"
                      />
                  </div>
                  <div className="md:col-span-2">
                       <p className="text-xs text-blue-600">
                           Se creará un usuario con rol <strong>Supplier</strong> y se le asignará este proveedor automáticamente.
                       </p>
                  </div>
              </div>
          )}
          
          {userMode === 'current' && isEditMode && (
              <div className="text-sm text-gray-600">
                  El proveedor se mantendrá asignado al usuario actual (ID: {initialData?.user_id}).
              </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Basic Info */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Datos Generales</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Empresa</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Corto (Slug)</label>
            <input
              type="text"
              name="short_name"
              value={formData.short_name}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
              <input
                type="text"
                name="rfc"
                value={formData.rfc}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Público</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {showMercadoPagoSection && (
            <div className="pt-4 mt-2 border-t border-gray-200 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-base font-semibold text-gray-900">Configuración de Cobros</h4>
                {mpStatusLoading ? (
                  <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 size={14} className="animate-spin" />
                    Validando…
                  </div>
                ) : null}
              </div>

              {!mpAccount.connected ? (
                <button
                  type="button"
                  onClick={handleMercadoPagoConnect}
                  disabled={mpConnectLoading || mpStatusLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#009EE3" }}
                >
                  {mpConnectLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {mpConnectLoading ? "Redirigiendo…" : "Conectar con Mercado Pago"}
                </button>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <CheckCircle size={18} className="text-[#168E00] mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#168E00]">Cuenta Vinculada</div>
                      {mpAccount.email ? (
                        <div className="text-xs text-gray-600 truncate">{mpAccount.email}</div>
                      ) : (
                        <div className="text-xs text-gray-500">Mercado Pago vinculado correctamente.</div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleMercadoPagoDisconnect}
                    disabled={mpDisconnectLoading || mpStatusLoading}
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {mpDisconnectLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                    Desconectar
                  </button>
                </div>
              )}
            </div>
          )}
          
           <div>
            <label className="flex items-center space-x-2 cursor-pointer mt-4">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
                className="rounded text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-gray-700">Cuenta Activa</span>
            </label>
          </div>
        </div>

        {/* Right Column: Address */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Ubicación</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Colonia</label>
              <input
                type="text"
                name="neighborhood"
                value={formData.neighborhood}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Calle</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Exterior</label>
              <input
                type="text"
                name="exterior_number"
                value={formData.exterior_number}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Interior</label>
              <input
                type="text"
                name="interior_number"
                value={formData.interior_number}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">C.P.</label>
              <input
                type="text"
                name="cp"
                value={formData.cp}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entre calle 1</label>
              <input
                type="text"
                name="cross_street_1"
                value={formData.cross_street_1}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Ej. Calle 35"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entre calle 2</label>
              <input
                type="text"
                name="cross_street_2"
                value={formData.cross_street_2}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Ej. Calle 37"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación en Mapa</label>
            <MapPicker 
              location={mapLocation} 
              onChange={setMapLocation}
              onSearchQueryChange={setMapSearchQuery}
              height="300px"
              addressContext={{
                street: formData.address,
                exteriorNumber: formData.exterior_number,
                neighborhood: formData.neighborhood,
                postalCode: formData.cp || formData.zip_code,
                city: formData.city,
                state: formData.state,
                country: formData.country
              }}
            />
            <p className="text-xs text-gray-500 mt-1">Busca una dirección o haz clic en el mapa para establecer la ubicación.</p>
          </div>
        </div>

        {/* Full Width: Description & Files */}
        <div className="md:col-span-2 space-y-4 pt-4">
           <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Perfil Detallado</h3>

           <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción Corta (SEO)</label>
            <input
              type="text"
              name="short_description"
              value={formData.short_description}
              onChange={handleInputChange}
              maxLength={160}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción Completa (HTML)</label>
            <div className="border border-gray-300 rounded-md overflow-hidden bg-white">
              <ReactQuill
                theme="snow"
                value={formData.description}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: value,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sobre Nosotros (Historia, HTML)</label>
            <div className="border border-gray-300 rounded-md overflow-hidden bg-white">
              <ReactQuill
                theme="snow"
                value={formData.about}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    about: value,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <FileUpload
              label="Logo de la Empresa"
              value={logo}
            onChange={handleLogoChange}
            currentImageUrl={logoPreviewUrl || undefined}
              helperText="Recomendado: Formato cuadrado, mín. 400x400px"
            />

            <FileUpload
              label="Imagen 'Sobre Nosotros'"
              value={aboutImage}
            onChange={handleAboutImageChange}
            accept="image/*"
            currentImageUrl={aboutMediaPreviewUrl || undefined}
            helperText="Formatos recomendados: JPG/PNG"
            />
          </div>

          <div className="pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos Bancarios para Transferencias</h3>
            
            <div className="flex items-center gap-2 mb-4">
                <input 
                    type="checkbox" 
                    id="transfer_accepted_admin"
                    name="transfer_accepted" 
                    checked={formData.transfer_accepted} 
                    onChange={handleInputChange}
                    className="h-5 w-5 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <label htmlFor="transfer_accepted_admin" className="text-gray-700 font-medium select-none cursor-pointer">
                    Acepto recibir pagos por transferencia bancaria
                </label>
            </div>

            {formData.transfer_accepted && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Beneficiario</label>
                        <input 
                            type="text" 
                            name="transfer_name" 
                            value={formData.transfer_name} 
                            onChange={handleInputChange} 
                            className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Nombre completo del titular de la cuenta"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                        <input 
                            type="text" 
                            name="transfer_bank" 
                            value={formData.transfer_bank} 
                            onChange={handleInputChange} 
                            className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Ej. BBVA, Santander"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CLABE Interbancaria</label>
                        <input 
                            type="text" 
                            name="transfer_clabe" 
                            value={formData.transfer_clabe} 
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 18);
                                setFormData(prev => ({ ...prev, transfer_clabe: val }));
                            }} 
                            className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                            placeholder="18 dígitos"
                        />
                        <p className="text-xs text-gray-500 mt-1">Debe contener exactamente 18 dígitos.</p>
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Guardando...
            </>
          ) : (
            "Guardar"
          )}
        </button>
      </div>
    </form>
  );
}
