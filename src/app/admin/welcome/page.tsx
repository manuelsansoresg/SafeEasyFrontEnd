'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Store, Image, ShieldCheck, LayoutDashboard } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl w-full text-center"
      >
        <div className="mb-12 text-left">
          <PageHero
            title="Bienvenido a Drooopy"
            subtitle="Su cuenta ha sido creada exitosamente. Ahora personalice su espacio para comenzar a vender de manera profesional."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <WelcomeCard 
            href="/admin/my-company?tab=carousel"
            icon={<Image className="w-8 h-8 text-primary" />}
            title="Personalizar Sitio"
            description="Personalice el encabezado de su sitio con imágenes o video."
            delay={0.1}
          />
          
          <WelcomeCard 
            href="/admin/my-company?tab=certificates"
            icon={<ShieldCheck className="w-8 h-8 text-primary" />}
            title="Subir Certificados"
            description="Genere confianza agregando certificaciones de su empresa."
            delay={0.2}
          />
          
          <WelcomeCard 
            href="/admin/my-company?tab=info"
            icon={<Store className="w-8 h-8 text-primary" />}
            title="Datos de Empresa"
            description="Complete o edite la información de su perfil comercial."
            delay={0.3}
          />

          <WelcomeCard 
            href="/admin/dashboard"
            icon={<LayoutDashboard className="w-8 h-8 text-primary" />}
            title="Ir al Dashboard"
            description="Vea estadísticas y gestione su cuenta completa."
            delay={0.4}
          />
        </div>
      </motion.div>
    </div>
  );
}

function WelcomeCard({ href, icon, title, description, delay }: { href: string, icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <Link href={href} className="block h-full">
        <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 h-full text-left group">
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
