"use client";

import { useState, useEffect } from "react";
import { statsService, StatsResponse, StatsParams } from "@/services/statsService";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell
} from "recharts";
import { 
  BarChart as BarChartIcon, 
  DollarSign, 
  ShoppingBag, 
  Clock, 
  AlertCircle,
  Calendar,
  Filter,
  Loader2
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
const STATUS_COLORS = {
  completed: '#10B981', // green
  pending: '#F59E0B',   // amber
  cancelled: '#EF4444'  // red
};

export default function AdminStatsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Filters
  const [interval, setInterval] = useState<StatsParams['interval']>('day');
  const [dateRange, setDateRange] = useState<'last7' | 'last30' | 'month'>('last30');

  useEffect(() => {
    setIsMounted(true);
    loadSupplier();
  }, []);

  useEffect(() => {
    if (supplierId) {
      loadStats();
    }
  }, [supplierId, interval, dateRange]);

  const loadSupplier = async () => {
    try {
      const supplier = await statsService.getCurrentSupplier();
      if (supplier) {
        setSupplierId(supplier.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error loading supplier", error);
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!supplierId) return;
    setLoading(true);
    setError(null);

    let start_date;
    let end_date = new Date().toISOString();

    const now = new Date();
    if (dateRange === 'last7') {
      start_date = subDays(now, 7).toISOString();
    } else if (dateRange === 'last30') {
      start_date = subDays(now, 30).toISOString();
    } else if (dateRange === 'month') {
      start_date = startOfMonth(now).toISOString();
      end_date = endOfMonth(now).toISOString();
    }

    try {
      const data = await statsService.getSupplierStats(supplierId, {
        start_date,
        end_date,
        interval
      });
      
      // Ensure numeric values for charts
      if (data.timeline) {
        data.timeline = data.timeline.map(item => ({
          ...item,
          amount: Number(item.amount),
          count: Number(item.count)
        }));
      }
      
      if (data.summary) {
        data.summary.total_revenue = Number(data.summary.total_revenue);
        data.summary.revenue_by_status.completed = Number(data.summary.revenue_by_status.completed);
        data.summary.revenue_by_status.pending = Number(data.summary.revenue_by_status.pending);
        data.summary.revenue_by_status.cancelled = Number(data.summary.revenue_by_status.cancelled);
      }

      setStats(data);
    } catch (error) {
      console.error("Error loading stats", error);
      setError("No se pudieron cargar las estadísticas. Por favor intenta de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMM', { locale: es });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin h-12 w-12 text-primary" />
      </div>
    );
  }

  if (!supplierId) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-gray-700">No se encontró información de proveedor</h2>
        <p className="text-gray-500">Asegúrate de tener una empresa registrada.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-500 mb-2">
          <AlertCircle className="mx-auto h-12 w-12" />
        </div>
        <h2 className="text-xl font-bold text-gray-700">Error</h2>
        <p className="text-gray-500">{error}</p>
        <button 
          onClick={loadStats}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!stats) return null;

  // Debug log to verify data
  console.log('Stats loaded:', stats);

  const pieData = [
    { name: 'Completados', value: Number(stats.summary.completed_count || 0), color: STATUS_COLORS.completed },
    { name: 'Pendientes', value: Number(stats.summary.pending_count || 0), color: STATUS_COLORS.pending },
    { name: 'Cancelados', value: Number(stats.summary.cancelled_count || 0), color: STATUS_COLORS.cancelled },
  ].filter(d => d.value > 0);

  const hasTimelineData = Array.isArray(stats.timeline) && stats.timeline.length > 0;
  const hasPieData = pieData.length > 0;

  if (!isMounted) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Estadísticas y Reportes</h1>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          <button 
            onClick={() => setDateRange('last7')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateRange === 'last7' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            7 Días
          </button>
          <button 
            onClick={() => setDateRange('last30')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateRange === 'last30' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            30 Días
          </button>
          <button 
            onClick={() => setDateRange('month')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateRange === 'month' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Este Mes
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Ventas Totales</p>
            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(stats.summary.total_revenue)}</h3>
            <p className="text-xs text-green-600 mt-1 flex items-center">
              <span className="font-medium">Ingresos confirmados</span>
            </p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-green-600">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Pedidos Totales</p>
            <h3 className="text-2xl font-bold text-gray-900">{stats.summary.total_orders}</h3>
            <p className="text-xs text-blue-600 mt-1">
              Todos los estatus
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <ShoppingBag size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Pendientes</p>
            <h3 className="text-2xl font-bold text-gray-900">{stats.summary.pending_count}</h3>
            <p className="text-xs text-amber-600 mt-1 font-medium">
              Requieren atención
            </p>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
            <Clock size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Cancelados</p>
            <h3 className="text-2xl font-bold text-gray-900">{stats.summary.cancelled_count}</h3>
            <p className="text-xs text-red-600 mt-1">
              Pedidos perdidos
            </p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-red-600">
            <AlertCircle size={24} />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800">Tendencia de Ventas</h3>
            <select 
              value={interval} 
              onChange={(e) => setInterval(e.target.value as any)}
              className="text-sm border-gray-200 rounded-md focus:ring-primary focus:border-primary"
            >
              <option value="day">Por Día</option>
              <option value="week">Por Semana</option>
              <option value="month">Por Mes</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            {hasTimelineData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.timeline}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate} 
                    stroke="#9ca3af" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#9ca3af" 
                    fontSize={12}
                    tickFormatter={(val) => `$${val}`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(value), 'Ventas']}
                    labelFormatter={(label) => formatDate(label)}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar 
                    dataKey="amount" 
                    fill="#6366f1" 
                    radius={[4, 4, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <BarChartIcon className="w-12 h-12 mb-2 opacity-20" />
                <p>No hay datos de ventas en este periodo</p>
              </div>
            )}
          </div>
        </div>

        {/* Orders Status Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Estado de Pedidos</h3>
          <div className="h-[300px] w-full flex flex-col items-center justify-center">
            {hasPieData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [value, 'Pedidos']} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-400">
                <p>No hay datos suficientes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
