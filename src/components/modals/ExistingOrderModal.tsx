import { PropsWithChildren } from "react";
import { Package } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onGo: () => void;
};

export default function ExistingOrderModal({ open, onClose, onGo }: PropsWithChildren<Props>) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center">
            <Package className="text-[#168E00] animate-pulse" size={22} />
          </div>
          <h3 className="text-lg font-semibold" style={{ fontFamily: '"Varela Round", system-ui, sans-serif' }}>
            ¡Ya tienes un proceso activo!
          </h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Detectamos que ya iniciaste una solicitud para este producto. Para evitar duplicados, puedes darle seguimiento directo en tu panel.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
          >
            Cerrar
          </button>
          <button
            onClick={onGo}
            className="px-4 py-2 rounded-lg text-sm bg-[#168E00] hover:bg-[#137500] text-white"
          >
            Ver mi orden
          </button>
        </div>
      </div>
    </div>
  );
}
