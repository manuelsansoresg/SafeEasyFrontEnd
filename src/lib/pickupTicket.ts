import jsPDF from "jspdf";
import { Order } from "@/services/orderService";
import { fetchWithAuth } from "@/lib/api";

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="61 193 907 197"><g fill="#7ed957"><path d="M 52.75 -110.375 L 39.4375 -110.375 L 39.4375 -20.046875 L 55.4375 -20.046875 C 63.414062 -20.046875 70.578125 -21.898438 76.921875 -25.609375 C 83.273438 -29.316406 88.304688 -34.539062 92.015625 -41.28125 C 95.722656 -48.019531 97.578125 -55.941406 97.578125 -65.046875 C 97.578125 -74.484375 95.582031 -82.597656 91.59375 -89.390625 C 87.601562 -96.191406 82.238281 -101.390625 75.5 -104.984375 C 68.757812 -108.578125 61.175781 -110.375 52.75 -110.375 Z"/></g></svg>`;

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function normalizeStatusKey(value: string) {
  const raw = String(value || "").trim();
  const ascii = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const v = ascii.toLowerCase().trim().replace(/\s+/g, "_");
  if (v === "pending" || v === "pendiente") return "pending";
  if (v === "paid" || v === "pagado" || v === "pago_verificado" || v === "validado" || v === "validated") return "paid";
  if (v === "completed" || v === "completado" || v === "delivered" || v === "entregado") return "completed";
  if (v === "shipped" || v === "enviado") return "shipped";
  if (v === "cancelled" || v === "cancelado") return "cancelled";
  return v;
}

function toStatusLabel(value: string) {
  const key = normalizeStatusKey(value);
  const map: Record<string, string> = {
    pending: "Pendiente",
    paid: "Pago verificado",
    completed: "Completado",
    shipped: "Enviado",
    cancelled: "Cancelado",
  };
  return map[key] || value;
}

function formatCurrency(amount: number | string | undefined) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (n === undefined || n === null || !Number.isFinite(n)) return "$0.00";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function formatDate(value: string | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function generatePickupCode(order: Order): string {
  return `DR-${String(order.id).padStart(4, "0")}`;
}

async function renderLogoToCanvas(): Promise<HTMLCanvasElement | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const img = new Image();
    img.src = "/logo-drooopy.svg";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load logo"));
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, 180, 40);
    return canvas;
  } catch {
    return null;
  }
}

export async function downloadPickupTicket(order: Order) {
  const [buyerAddress, supplierAddress] = await Promise.all([
    fetchBuyerAddressFromOrder(order),
    order.supplier?.id ? fetchSupplierAddress(order.supplier.id) : Promise.resolve(""),
  ]);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 220],
  });

  const pageWidth = 80;
  const margin = 6;
  const contentWidth = pageWidth - margin * 2;
  let y = 10;

  const brandGreen = "#7ed957";
  const brandDark = "#004e28";
  const grayDark = "#374151";
  const grayLight = "#9ca3af";

  const logoCanvas = await renderLogoToCanvas();
  if (logoCanvas) {
    const logoDataUrl = logoCanvas.toDataURL("image/png");
    const logoWidth = 50;
    const logoHeight = (40 / 180) * logoWidth;
    doc.addImage(logoDataUrl, "PNG", (pageWidth - logoWidth) / 2, y, logoWidth, logoHeight);
    y += logoHeight + 4;
  } else {
    doc.setFillColor(brandDark);
    doc.rect(0, 0, pageWidth, 28, "F");
    doc.setTextColor(brandGreen);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("drooopy", pageWidth / 2, 18, { align: "center" });
    y = 36;
  }

  doc.setTextColor(brandDark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Ticket de Recogida", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setDrawColor("#e5e7eb");
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(brandDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Código de recogida", margin, y);
  y += 7;

  doc.setFontSize(18);
  doc.setTextColor(brandDark);
  doc.text(generatePickupCode(order), margin, y);
  y += 10;

  doc.setDrawColor("#e5e7eb");
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(grayDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Comprador", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(order.buyer?.name || "-", margin, y);
  y += 4;
  doc.setTextColor(grayLight);
  doc.text(order.buyer?.email || "-", margin, y);
  y += 4;

  if (buyerAddress) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const buyerAddrLines = doc.splitTextToSize(buyerAddress, contentWidth);
    doc.text(buyerAddrLines, margin, y);
    y += buyerAddrLines.length * 3.5 + 2;
  }
  y += 2;

  doc.setDrawColor("#e5e7eb");
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(grayDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Tienda / Punto de recogida", margin, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(order.supplier?.name || "-", margin, y);
  y += 4;

  if (supplierAddress) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const supplierAddrLines = doc.splitTextToSize(supplierAddress, contentWidth);
    doc.text(supplierAddrLines, margin, y);
    y += supplierAddrLines.length * 3.5 + 2;
  }
  y += 2;

  doc.setDrawColor("#e5e7eb");
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(grayDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Producto", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const productLines = doc.splitTextToSize(order.product?.title || "Producto desconocido", contentWidth);
  doc.text(productLines, margin, y);
  y += productLines.length * 4 + 4;

  doc.setDrawColor("#e5e7eb");
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(grayDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Monto total", margin, y);
  y += 5;

  doc.setFontSize(14);
  doc.setTextColor(brandDark);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(order.total_amount ?? order.product?.price), margin, y);
  y += 8;

  doc.setDrawColor("#e5e7eb");
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(grayLight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Orden creada: ${formatDate(order.created_at)}`, margin, y);
  y += 4;
  doc.text(`Estado: ${toStatusLabel(order.payment_status || order.status || "")}`, margin, y);
  y += 6;

  doc.setDrawColor("#e5e7eb");
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(grayLight);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text("Presenta este código al recoger tu pedido", pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.text("drooopy.com", pageWidth / 2, y, { align: "center" });

  doc.save(`ticket-recogida-${generatePickupCode(order)}.pdf`);
}

function getPickupCode(order: Order): string {
  return `DR-${String(order.id).padStart(4, "0")}`;
}

function getDeliveryAddress(order: Order): string {
  const anyOrder = order as unknown as Record<string, unknown>;
  const raw =
    (typeof anyOrder.delivery_address === "string" && anyOrder.delivery_address) ||
    (typeof anyOrder.shipping_address === "string" && anyOrder.shipping_address) ||
    (typeof anyOrder.address === "string" && anyOrder.address) ||
    "";
  return raw && raw.trim() ? raw.trim() : order.supplier?.name || "—";
}

function getSupplierAddress(order: Order): string {
  const anyOrder = order as unknown as Record<string, unknown>;
  const raw =
    (typeof anyOrder.pickup_address === "string" && anyOrder.pickup_address) ||
    (typeof anyOrder.supplier_address === "string" && anyOrder.supplier_address) ||
    (typeof anyOrder.store_address === "string" && anyOrder.store_address) ||
    "";
  return raw && raw.trim() ? raw.trim() : order.supplier?.name || "—";
}

function getBuyerPhone(order: Order): string {
  const anyOrder = order as unknown as Record<string, unknown>;
  const raw =
    (typeof anyOrder.buyer_phone === "string" && anyOrder.buyer_phone) ||
    (typeof anyOrder.phone === "string" && anyOrder.phone) ||
    "";
  return raw && raw.trim() ? raw.trim() : "—";
}

async function fetchBuyerAddressFromOrder(order: Order): Promise<string> {
  const anyOrder = order as unknown as Record<string, unknown>;
  const raw =
    (typeof anyOrder.buyer_address === "string" && anyOrder.buyer_address) ||
    (typeof anyOrder.delivery_address === "string" && anyOrder.delivery_address) ||
    (typeof anyOrder.shipping_address === "string" && anyOrder.shipping_address) ||
    (typeof anyOrder.address === "string" && anyOrder.address) ||
    "";
  if (raw && raw.trim()) return raw.trim();
  
  if (order.buyer) {
    const b = order.buyer as Record<string, unknown>;
    const parts: string[] = [];
    const street = typeof b.address === "string" && b.address ? b.address : "";
    const extNum = typeof b.exterior_number === "string" && b.exterior_number ? b.exterior_number : "";
    const intNum = typeof b.interior_number === "string" && b.interior_number ? b.interior_number : "";
    const colonia = typeof b.neighborhood === "string" && b.neighborhood ? b.neighborhood : "";
    const city = typeof b.city === "string" && b.city ? b.city : "";
    const state = typeof b.state === "string" && b.state ? b.state : "";
    const country = typeof b.country === "string" && b.country ? b.country : "";
    const cp = typeof b.cp === "string" && b.cp ? b.cp : "";
    
    if (street) parts.push(street);
    if (extNum) parts.push(extNum);
    if (intNum) parts.push(`Int. ${intNum}`);
    if (colonia) parts.push(colonia);
    if (cp) parts.push(cp);
    if (city) parts.push(city);
    if (state) parts.push(state);
    if (country) parts.push(country);
    
    return parts.join(", ");
  }
  return "";
}

async function fetchSupplierAddress(supplierId: number): Promise<string> {
  try {
    const res = await fetchWithAuth(`/api/suppliers/${supplierId}`);
    if (!res.ok) return "";
    const data = await res.json();
    const anyData = data as Record<string, unknown>;
    
    const parts: string[] = [];
    const street = typeof anyData.address === "string" && anyData.address ? anyData.address :
                   typeof anyData.street === "string" && anyData.street ? anyData.street : "";
    const extNum = typeof anyData.exterior_number === "string" && anyData.exterior_number ? anyData.exterior_number : "";
    const intNum = typeof anyData.interior_number === "string" && anyData.interior_number ? anyData.interior_number : "";
    const colonia = typeof anyData.neighborhood === "string" && anyData.neighborhood ? anyData.neighborhood :
                    typeof anyData.colonia === "string" && anyData.colonia ? anyData.colonia : "";
    const city = typeof anyData.city === "string" && anyData.city ? anyData.city : "";
    const state = typeof anyData.state === "string" && anyData.state ? anyData.state : "";
    const country = typeof anyData.country === "string" && anyData.country ? anyData.country : "";
    const cp = typeof anyData.cp === "string" && anyData.cp ? anyData.cp :
               typeof anyData.zip_code === "string" && anyData.zip_code ? anyData.zip_code : "";
    const cross1 = typeof anyData.cross_street_1 === "string" && anyData.cross_street_1 ? anyData.cross_street_1 : "";
    const cross2 = typeof anyData.cross_street_2 === "string" && anyData.cross_street_2 ? anyData.cross_street_2 : "";
    
    if (street) parts.push(street);
    if (extNum) parts.push(extNum);
    if (intNum) parts.push(`Int. ${intNum}`);
    if (colonia) parts.push(colonia);
    if (cp) parts.push(cp);
    if (city) parts.push(city);
    if (state) parts.push(state);
    if (country) parts.push(country);
    if (cross1) parts.push(`Entre ${cross1}`);
    if (cross2) parts.push(`y ${cross2}`);
    
    return parts.join(", ");
  } catch {
    return "";
  }
}

export async function downloadShippingLabel(order: Order) {
  const [buyerAddress, supplierAddress] = await Promise.all([
    fetchBuyerAddressFromOrder(order),
    order.supplier?.id ? fetchSupplierAddress(order.supplier.id) : Promise.resolve(""),
  ]);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [100, 190],
  });

  const pageWidth = 100;
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;
  let y = 10;

  const brandGreen = "#7ed957";
  const brandDark = "#004e28";
  const grayDark = "#374151";
  const grayLight = "#9ca3af";

  doc.setFillColor(brandDark);
  doc.rect(0, 0, pageWidth, 22, "F");

  const logoCanvas = await renderLogoToCanvas();
  if (logoCanvas) {
    const logoDataUrl = logoCanvas.toDataURL("image/png");
    const logoWidth = 40;
    const logoHeight = (40 / 180) * logoWidth;
    doc.addImage(logoDataUrl, "PNG", margin, 6, logoWidth, logoHeight);
  } else {
    doc.setTextColor(brandGreen);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("drooopy", margin, 14);
  }

  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Etiqueta de Envío", pageWidth - margin, 14, { align: "right" });

  y = 30;

  doc.setTextColor(brandDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(getPickupCode(order), margin, y);
  y += 8;

  doc.setDrawColor("#e5e7eb");
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(grayDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DESTINATARIO", margin, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(order.buyer?.name || "—", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const phone = getBuyerPhone(order);
  if (phone !== "—") {
    doc.text(`Tel: ${phone}`, margin, y);
    y += 4;
  }
  doc.setTextColor(grayLight);
  doc.text(order.buyer?.email || "—", margin, y);
  y += 6;

  doc.setDrawColor("#e5e7eb");
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(grayDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DIRECCIÓN DE ENTREGA", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const deliveryAddr = buyerAddress || getDeliveryAddress(order);
  const deliveryAddrLines = doc.splitTextToSize(deliveryAddr, contentWidth);
  doc.text(deliveryAddrLines, margin, y);
  y += deliveryAddrLines.length * 4.5 + 4;

  doc.setDrawColor("#e5e7eb");
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(grayDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TIENDA / REMITENTE", margin, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(order.supplier?.name || "—", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const supplierAddr = supplierAddress || getSupplierAddress(order);
  const supplierAddrLines = doc.splitTextToSize(supplierAddr, contentWidth);
  doc.text(supplierAddrLines, margin, y);
  y += supplierAddrLines.length * 4.5 + 4;

  doc.setDrawColor("#e5e7eb");
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(grayDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PRODUCTO", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const productLines = doc.splitTextToSize(order.product?.title || "Producto desconocido", contentWidth);
  doc.text(productLines, margin, y);
  y += productLines.length * 4.5 + 4;

  doc.setDrawColor("#e5e7eb");
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(grayDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("MONTO", margin, y);
  y += 5;

  doc.setFontSize(12);
  doc.setTextColor(brandDark);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(order.total_amount ?? order.product?.price), margin, y);
  y += 8;

  doc.setDrawColor("#e5e7eb");
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(grayLight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Orden: ${formatDate(order.created_at)}`, margin, y);
  y += 4;
  doc.text("drooopy.com", pageWidth / 2, y, { align: "center" });

  doc.save(`etiqueta-envio-${getPickupCode(order)}.pdf`);
}
