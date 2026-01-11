import { LayoutDashboard } from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Panel de Administración</h1>
          <p className="text-gray-500 mt-1">Bienvenido de nuevo al panel de control.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat Card 1 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-500 rounded-xl">
                <LayoutDashboard size={24} />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Total Usuarios</p>
                <h3 className="text-2xl font-bold text-gray-800">1,234</h3>
            </div>
        </div>
        
        {/* Add more stats or content here */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <LayoutDashboard size={24} />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Ventas Totales</p>
                <h3 className="text-2xl font-bold text-gray-800">$45,231</h3>
            </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Actividad Reciente</h2>
        <div className="text-center py-20 text-gray-400">
            Contenido del dashboard...
        </div>
      </div>
    </div>
  );
}
