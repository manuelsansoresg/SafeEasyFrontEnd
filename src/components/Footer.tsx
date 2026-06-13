"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Check,
  Facebook,
  Instagram,
  LinkIcon,
  Mail,
  MessageCircle,
  Twitter,
} from "lucide-react";

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

const defaultShareUrl = "https://drooopy.com";
const publicShareUrl = process.env.NEXT_PUBLIC_SITE_URL || defaultShareUrl;

const getCurrentUrl = () => {
  if (typeof window === "undefined") {
    return defaultShareUrl;
  }

  return window.location.origin;
};

const subscribeToUrlChanges = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  window.addEventListener("hashchange", callback);

  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("hashchange", callback);
  };
};

const copyToClipboard = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

export function Footer() {
  const currentUrl = useSyncExternalStore(subscribeToUrlChanges, getCurrentUrl, () => defaultShareUrl);
  const [copied, setCopied] = useState(false);

  const encodedShareUrl = useMemo(() => encodeURIComponent(publicShareUrl), []);
  const shareText = encodeURIComponent("Conoce Drooopy, una plataforma segura para comprar y vender online.");
  const shareLinks = [
    {
      label: "Compartir en WhatsApp",
      href: `https://wa.me/?text=${shareText}%20${encodedShareUrl}`,
      icon: MessageCircle,
    },
    {
      label: "Compartir en Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`,
      icon: Facebook,
    },
    {
      label: "Compartir en X",
      href: `https://twitter.com/intent/tweet?url=${encodedShareUrl}&text=${shareText}`,
      icon: Twitter,
    },
    {
      label: "Compartir por correo",
      href: `mailto:?subject=${encodeURIComponent("Drooopy")}&body=${shareText}%0A%0A${encodedShareUrl}`,
      icon: Mail,
    },
  ];

  const copyCurrentUrl = async () => {
    try {
      await copyToClipboard(currentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-24 md:pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-5 md:gap-8 mb-12">
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

          <div>
            <h3 className="font-bold text-gray-900 mb-6">Compartir</h3>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copyCurrentUrl}
                aria-label="Copiar enlace"
                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-primary hover:text-white transition-colors"
              >
                {copied ? <Check size={20} /> : <LinkIcon size={20} />}
              </button>
              {shareLinks.map(({ label, href, icon: Icon }) => (
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
            <p className="mt-3 text-xs text-gray-400" aria-live="polite">
              {copied ? "Enlace copiado" : "Copia la URL o compártela."}
            </p>
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
