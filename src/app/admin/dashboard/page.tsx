"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import SupplierDashboard from "@/components/admin/SupplierDashboard";
import { PageHero } from "@/components/ui/PageHero";
import { 
  Users, 
  Store, 
  ShoppingBag, 
  AlertCircle, 
  Calendar as CalendarIcon,
  RefreshCw,
  TrendingUp,
  DollarSign
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import Link from "next/link";

interface SalesPerSeller {
  supplier_id: number;
  supplier_name: string;
  total_sales: number;
  total_orders: number;
}

interface AdminDashboardStats {
  total_users: number;
  total_sellers: number;
  total_clients: number;
  sales_per_seller: SalesPerSeller[];
  pending_orders_count: number;
}

export default function AdminDashboardPage() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: ""
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      // Ensure we have valid dates before converting to ISO string
      if (dateRange.start) {
        params.append('start_date', new Date(dateRange.start).toISOString());
      }
      if (dateRange.end) {
        // Set end date to end of day if manually selected
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        params.append('end_date', endDate.toISOString());
      }
      
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await fetchWithAuth(`/api/admin/dashboard${query}`);
      
      if (!response.ok) {
        console.warn("Error al cargar estadísticas", response.status);
        setStats(null);
        setError("No se pudieron cargar las estadísticas del panel.");
        return;
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted && user?.role === 'admin') {
      fetchStats();
    }
  }, [mounted, user, dateRange]);

  if (!mounted) {
    return <div className="p-8 text-center text-gray-500">Cargando panel...</div>;
  }

  if (user?.role === 'supplier') {
    return <SupplierDashboard />;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      <PageHero
        title="Panel de Administración"
        subtitle="Resumen general y estadísticas de la plataforma."
        actions={
          <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarIcon size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600 font-medium">Filtrar:</span>
          </div>
          <input 
            type="date" 
            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
          />
          <span className="text-gray-400">-</span>
          <input 
            type="date" 
            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
          />
          <button 
            onClick={fetchStats}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        }
      />

      {loading && !stats ? (
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="animate-spin mr-3 h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          Cargando estadísticas...
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
          Error: {error}
        </div>
      ) : stats ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:-translate-y-1">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Usuarios</p>
                <h3 className="text-2xl font-bold text-gray-800">{stats.total_users}</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:-translate-y-1">
              <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                <Store size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Vendedores</p>
                <h3 className="text-2xl font-bold text-gray-800">{stats.total_sellers}</h3>
                <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  {stats.total_users > 0 ? Math.round((stats.total_sellers / stats.total_users) * 100) : 0}% del total
                </span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:-translate-y-1">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <ShoppingBag size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Clientes</p>
                <h3 className="text-2xl font-bold text-gray-800">{stats.total_clients}</h3>
              </div>
            </div>

            <Link href="/admin/orders" className="block">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:-translate-y-1 cursor-pointer group hover:border-orange-200">
                <div className="p-3 bg-orange-50 text-orange-600 rounded-xl group-hover:bg-orange-100 transition-colors">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium group-hover:text-orange-700">Pedidos Pendientes</p>
                  <h3 className="text-2xl font-bold text-gray-800 group-hover:text-orange-800">{stats.pending_orders_count}</h3>
                </div>
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sales Chart */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <TrendingUp size={20} className="text-blue-500" />
                  Ventas por Vendedor
                </h2>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.sales_per_seller}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="supplier_name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f9fafb' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => [formatCurrency(value), 'Ventas Totales']}
                    />
                    <Legend />
                    <Bar 
                      dataKey="total_sales" 
                      name="Ventas ($)" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]} 
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Sellers List */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <DollarSign size={20} className="text-green-500" />
                Top Vendedores
              </h2>
              <div className="flex-1 overflow-auto pr-2">
                <div className="space-y-4">
                  {stats.sales_per_seller.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">No hay datos de ventas</p>
                  ) : (
                    stats.sales_per_seller
                      .sort((a, b) => b.total_sales - a.total_sales)
                      .slice(0, 5) // Top 5
                      .map((seller) => (
                        <div key={seller.supplier_id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-800 text-sm">{seller.supplier_name}</span>
                            <span className="text-xs text-gray-500">{seller.total_orders} pedidos</span>
                          </div>
                          <span className="font-bold text-green-600 text-sm">
                            {formatCurrency(seller.total_sales)}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>
              {stats.sales_per_seller.length > 5 && (
                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                  <span className="text-sm text-blue-500 hover:underline cursor-pointer">Ver todos</span>
                </div>
              )}
            </div>
          </div>

          {/* Detailed Table Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Detalle de Rendimiento</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Vendedor</th>
                    <th className="px-6 py-4 text-right">Ventas Totales</th>
                    <th className="px-6 py-4 text-center">Pedidos</th>
                    <th className="px-6 py-4 text-right">Ticket Promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.sales_per_seller.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                        No se encontraron registros
                      </td>
                    </tr>
                  ) : (
                    stats.sales_per_seller.map((seller) => (
                      <tr key={seller.supplier_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-500">#{seller.supplier_id}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-800">{seller.supplier_name}</td>
                        <td className="px-6 py-4 text-sm text-right font-bold text-gray-800">
                          {formatCurrency(seller.total_sales)}
                        </td>
                        <td className="px-6 py-4 text-sm text-center text-gray-600">
                          {seller.total_orders}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-600">
                          {seller.total_orders > 0 
                            ? formatCurrency(seller.total_sales / seller.total_orders) 
                            : '$0.00'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
