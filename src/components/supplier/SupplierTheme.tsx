import type { CSSProperties, ReactNode } from "react";
import { supplierThemeVariables, type SupplierThemeSource } from "@/lib/supplierTheme";
import "@/components/supplier/supplier-theme.css";

/** Scoped to one public portal; never installs a theme on document/body. */
export function SupplierTheme({ supplier, className = "", children }: {
  supplier: SupplierThemeSource;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`drooopy-supplier-theme ${className}`} style={supplierThemeVariables(supplier) as CSSProperties}>{children}</div>;
}
