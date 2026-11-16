import type { AgendaBusinessType } from "@/lib/agendaTitle";

export function catalogLabels(businessType?: AgendaBusinessType | null) {
  const identifiers = typeof businessType === "string"
    ? [businessType]
    : [businessType?.slug, businessType?.name, businessType?.title, businessType?.label];
  const isRealEstate = identifiers.some((value) =>
    /^inmuebles?$/.test(value?.trim().toLowerCase() ?? ""),
  );

  return isRealEstate
    ? {
        isRealEstate,
        singular: "propiedad",
        plural: "propiedades",
        title: "Propiedades",
        myCatalog: "Mis propiedades",
        add: "Agregar propiedad",
        view: "Ver propiedades",
        reference: "Referencia",
        active: "Propiedad activa",
        notFound: "Propiedad no encontrada",
        thisItem: "esta propiedad",
        theItem: "la propiedad",
        theItems: "las propiedades",
      }
    : {
        isRealEstate,
        singular: "producto",
        plural: "productos",
        title: "Productos",
        myCatalog: "Mis Productos",
        add: "Nuevo Producto",
        view: "Ver Catálogo",
        reference: "SKU",
        active: "Producto Activo",
        notFound: "Producto no encontrado",
        thisItem: "este producto",
        theItem: "el producto",
        theItems: "los productos",
      };
}
