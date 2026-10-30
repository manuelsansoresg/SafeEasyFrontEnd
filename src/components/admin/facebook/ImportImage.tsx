"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { importImage } from "@/services/facebookImportService";

export function ImportImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState({ path: "", url: "" });
  const url = loaded.path === path ? loaded.url : "";
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    void importImage(path, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ path, url: objectUrl });
    }).catch(() => {});
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  return url ? <Image src={url} alt={alt} width={1600} height={900} unoptimized className={className} /> : <div className="grid min-h-16 place-items-center rounded-lg bg-[#f2f3f4] p-3 text-xs text-gray-500">Imagen no disponible</div>;
}
