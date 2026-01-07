"use client";

import { useState, useEffect } from "react";
import UserForm from "@/components/admin/UserForm";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";

interface User {
  id: number;
  email: string;
  is_active: boolean;
  name?: string;
  full_name?: string;
  role?: string;
}

export default function EditUserPage() {
  const params = useParams();
  const id = params.id;
  const { token } = useAuthStore();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!token || !id) return;
      
      try {
        // Try to fetch specific user first
        const response = await fetchWithAuth(`/api/users/${id}`);
        
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
            console.warn(`Direct fetch failed (${response.status}), trying fallback via list...`);
            
            // Fallback: Fetch list and find user
            const listResponse = await fetchWithAuth(`/api/users?skip=0&limit=1000`);

            if (listResponse.ok) {
                const listData = await listResponse.json();
                let usersList: User[] = [];
                if (Array.isArray(listData)) {
                    usersList = listData;
                } else if (listData && Array.isArray(listData.items)) {
                    usersList = listData.items;
                }

                const found = usersList.find((u: User) => String(u.id) === String(id));
                
                if (found) {
                    setUser(found);
                    return;
                } else {
                    console.warn(`User ${id} not found in fallback list`);
                }
            }

            const text = await response.text();
            console.warn("Direct fetch error response:", text);
            setError(`No se pudo cargar el usuario. El servidor no permite acceso directo y no se encontró en el listado.`);
        }
      } catch (err: any) {
        console.error(err);
        setError(`Connection error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || "Usuario no encontrado"}</p>
        <Link href="/admin/users" className="text-primary hover:underline">
          Volver a la lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/users" 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Editar Usuario</h1>
          <p className="text-gray-500 mt-1">Modifica los datos del usuario {user.full_name || user.name || user.email}.</p>
        </div>
      </div>

      <UserForm initialData={user} isEditMode={true} />
    </div>
  );
}
