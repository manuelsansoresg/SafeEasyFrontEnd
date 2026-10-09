// Ruta específica para que el rewrite externo de /api/backend no intercepte
// el registro de prospectos antes del proxy de Next.js.
export { POST } from "@/app/api/[...path]/route";
