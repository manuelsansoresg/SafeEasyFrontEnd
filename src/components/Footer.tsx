import Link from "next/link";
import { Facebook, Instagram, Twitter, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-24 md:pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <Link href="/" className="inline-block">
              <span className="text-2xl font-bold text-primary tracking-tight">
                SafeEasy
              </span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              Tu plataforma segura para compras y ventas online. Conectamos compradores y vendedores con total confianza.
            </p>
            <div className="flex gap-4">
              <button className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-primary hover:text-white transition-colors">
                <Facebook size={20} />
              </button>
              <button className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-primary hover:text-white transition-colors">
                <Instagram size={20} />
              </button>
              <button className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-primary hover:text-white transition-colors">
                <Twitter size={20} />
              </button>
            </div>
          </div>

          {/* Links Column 1 */}
          <div>
            <h3 className="font-bold text-gray-900 mb-6">Acerca de</h3>
            <ul className="space-y-4">
              {["Sobre Nosotros"].map((item) => (
                <li key={item}>
                  <span className="text-sm text-gray-500 hover:text-primary cursor-pointer transition-colors">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Links Column 2 */}
          <div>
            <h3 className="font-bold text-gray-900 mb-6">Ayuda</h3>
            <ul className="space-y-4">
              {["Centro de Ayuda", "Seguridad", "Términos y Condiciones", "Política de Privacidad"].map((item) => (
                <li key={item}>
                  <span className="text-sm text-gray-500 hover:text-primary cursor-pointer transition-colors">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Links Column 3 */}
          <div>
            <h3 className="font-bold text-gray-900 mb-6">Comunidad</h3>
            <ul className="space-y-4">
              {["Para Vendedores", "Para Compradores", "Reglas de Publicación"].map((item) => (
                <li key={item}>
                  <span className="text-sm text-gray-500 hover:text-primary cursor-pointer transition-colors">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} SafeEasy. Todos los derechos reservados.
          </p>
          <div className="flex gap-6">
            <span className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">Privacidad</span>
            <span className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">Términos</span>
            <span className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">Mapa del sitio</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
