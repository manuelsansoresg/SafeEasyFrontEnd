"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Store, Image, ShieldCheck, Package } from 'lucide-react';

export default function SupplierDashboard() {
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl w-full text-center"
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          ¡Bienvenido a SafeEasy!
        </h1>
        <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
          Gestione su empresa, personalice su sitio y administre sus productos desde aquí.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <DashboardCard 
            href="/admin/my-company?tab=carousel"
            icon={<Image className="w-8 h-8 text-primary" />}
            title="Personalizar Sitio"
            description="Personalice el encabezado de su sitio con imágenes o video."
            delay={0.1}
          />
          
          <DashboardCard 
            href="/admin/my-company?tab=certificates"
            icon={<ShieldCheck className="w-8 h-8 text-primary" />}
            title="Subir Certificados"
            description="Genere confianza agregando certificaciones de su empresa."
            delay={0.2}
          />
          
          <DashboardCard 
            href="/admin/my-company?tab=info"
            icon={<Store className="w-8 h-8 text-primary" />}
            title="Datos de Empresa"
            description="Complete o edite la información de su perfil comercial."
            delay={0.3}
          />

          <DashboardCard 
            href="/admin/products"
            icon={<Package className="w-8 h-8 text-primary" />}
            title="Mis Productos"
            description="Administre su inventario de productos."
            delay={0.4}
          />
        </div>
      </motion.div>
    </div>
  );
}

function DashboardCard({ href, icon, title, description, delay }: { href: string, icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <Link href={href} className="block h-full">
        <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 h-full text-left group hover:border-primary/30">
          <div className="bg-primary/5 w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
            {icon}
          </div>
          <h3 className="font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </Link>
    </motion.div>
  );
}
