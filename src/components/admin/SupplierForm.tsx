"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, UserPlus, Users, Search } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import FileUpload from "@/components/ui/FileUpload";
import MapPicker from "@/components/ui/MapPicker";
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
  about_image?: string;
  about_image_url?: string;
  transfer_accepted?: boolean;
  transfer_clabe?: string;
  transfer_bank?: string;
  transfer_name?: string;
  map_location?: string;
}

interface SupplierFormProps {
  initialData?: Supplier;
  isEditMode?: boolean;
}

export default function SupplierForm({ initialData, isEditMode = false }: SupplierFormProps) {
  const { token, user } = useAuthStore();
  const router = useRouter();
  
  // User Management for Admin
  const [users, setUsers] = useState<{id: number, email: string, full_name?: string, name?: string}[]>([]);
  const [userMode, setUserMode] = useState<'existing' | 'new' | 'current'>('current');
  const [selectedUserId, setSelectedUserId] = useState<number | string>("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: ""
  });

  // Load initial user if exists
  useEffect(() => {
    if (initialData?.user_id) {
        // We need to fetch the specific user to show it in the select even if not in search results
        const fetchInitialUser = async () => {
            try {
                // Try to get specific user. Note: standard endpoint might be /api/users/{id}
                const response = await fetchWithAuth(`/api/users/${initialData.user_id}`);
                if (response.ok) {
                    const user = await response.json();
                    setUsers(prev => {
                        if (prev.find(u => u.id === user.id)) return prev;
                        return [user, ...prev];
                    });
                    setSelectedUserId(user.id);
                }
            } catch (e) {
                console.error("Error loading initial user", e);
            }
        };
        fetchInitialUser();
    }
  }, [initialData]);

  // Debounced Search
  useEffect(() => {
    if (userMode !== 'existing') return;

    const delayDebounceFn = setTimeout(() => {
      fetchUsers(userSearchTerm);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [userSearchTerm, userMode]);

  const fetchUsers = async (term: string = "") => {
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
              const data = await response.json();
              let newUsers: any[] = [];
              if (Array.isArray(data)) {
                  newUsers = data;
              } else if (data && Array.isArray(data.items)) {
                  newUsers = data.items;
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
  };

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
    cp: (initialData as any)?.cp || initialData?.zip_code || "",
    cross_street_1: initialData?.cross_street_1 || "",
    cross_street_2: initialData?.cross_street_2 || "",
    about: initialData?.about || "",
    transfer_accepted: initialData?.transfer_accepted || false,
    transfer_clabe: initialData?.transfer_clabe || "",
    transfer_bank: initialData?.transfer_bank || "",
    transfer_name: initialData?.transfer_name || "",
  });

  const [mapLocation, setMapLocation] = useState<{lat: number, lng: number} | null>(() => {
    if (initialData?.map_location) {
      try {
        // Handle if it's already an object or a string
        return typeof initialData.map_location === 'string' 
          ? JSON.parse(initialData.map_location) 
          : initialData.map_location;
      } catch (e) {
        console.error("Error parsing map_location", e);
        return null;
      }
    }
    return null;
  });

  const [logo, setLogo] = useState<File | null>(null);
  const [aboutImage, setAboutImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (f: File | null) => void) => {
    if (e.target.files && e.target.files[0]) {
      setter(e.target.files[0]);
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
              } catch (e: any) {
                  setError(e.message);
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

      let response: Response;

      const buildFormData = () => {
        const data = new FormData();

        const appendIfPresent = (key: string, value: any) => {
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
        
        if (mapLocation) {
          data.append("map_location", JSON.stringify(mapLocation));
        }

        data.append("user_id", String(finalUserId));

        if (logo) data.append("logo", logo);
        if (aboutImage) data.append("about_image", aboutImage);

        return data;
      };

      if (isEdit) {
        const url = `/api/suppliers/${initialData.id}/`;
        const data = buildFormData();

        response = await fetchWithAuth(url, {
          method: "PUT",
          body: data,
        });
      } else {
        const data = buildFormData();

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

      setSuccess(true);
      if (!isEditMode) {
        router.push("/admin/suppliers");
      }
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error al guardar");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
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
              onChange={setLogo}
              currentImageUrl={initialData?.logo || initialData?.logo_url || undefined}
              helperText="Recomendado: Formato cuadrado, mín. 400x400px"
            />

            <FileUpload
              label="Imagen 'Sobre Nosotros'"
              value={aboutImage}
              onChange={setAboutImage}
              currentImageUrl={initialData?.about_image || initialData?.about_image_url || undefined}
              helperText="Imagen representativa para su perfil"
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
            "Guardar Cambios"
          )}
        </button>
      </div>
    </form>
  );
}
