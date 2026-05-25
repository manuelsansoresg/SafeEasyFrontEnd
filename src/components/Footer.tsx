import Link from "next/link";
import { Facebook, Instagram, Twitter } from "lucide-react";

const mainLinks = [
  { label: "Inicio", href: "/" },
  { label: "Nosotros", href: "/nosotros" },
  { label: "Contacto", href: "/contacto" },
  { label: "Vender en Drooopy", href: "/sell" },
];

const helpLinks = [
  { label: "Centro de ayuda", href: "/centro-de-ayuda" },
  { label: "Términos y condiciones", href: "/terminos-y-condiciones" },
  { label: "Política de privacidad", href: "/politicas-de-privacidad" },
];

const socialLinks = [
  { label: "Facebook", href: "https://www.facebook.com/drooopy", icon: Facebook },
  { label: "Instagram", href: "https://www.instagram.com/drooopy", icon: Instagram },
  { label: "X", href: "https://x.com/drooopy", icon: Twitter },
];

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-24 md:pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4 md:gap-8 mb-12">
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="inline-block">
              <span className="text-2xl font-bold text-primary tracking-tight">
                Drooopy
              </span>
            </Link>
            <p className="max-w-sm text-sm text-gray-500 leading-relaxed">
              Tu plataforma segura para comprar y vender online. Conectamos compradores y vendedores con confianza.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-6">Disponible</h3>
            <ul className="space-y-4">
              {mainLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-gray-500 hover:text-primary transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-6">Ayuda</h3>
            <ul className="space-y-4">
              {helpLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-gray-500 hover:text-primary transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-6">Redes sociales</h3>
            <div className="flex gap-4">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-primary hover:text-white transition-colors"
                >
                  <Icon size={20} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Drooopy. Todos los derechos reservados.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/politicas-de-privacidad" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Privacidad
            </Link>
            <Link href="/terminos-y-condiciones" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Términos
            </Link>
            <Link href="/centro-de-ayuda" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Centro de ayuda
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
