"use client";

import { useEffect } from "react";

export default function FacebookReturnPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const id = params.get("facebook_connection");
    window.history.replaceState(null, "", window.location.pathname);
    if (id && /^[a-zA-Z0-9_-]{16,64}$/.test(id)) sessionStorage.setItem("facebook-import-connection", id);
    else sessionStorage.removeItem("facebook-import-connection");
    window.location.replace("/admin/my-company/import-facebook");
  }, []);
  return <p role="status" className="p-12 text-center text-[#004e28]">Regresando a tu negocio…</p>;
}
