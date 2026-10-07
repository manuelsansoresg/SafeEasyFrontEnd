import { Clock3, MapPin, MessageCircle, QrCode } from "lucide-react";

export function BusinessPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`overflow-hidden border border-[#004e28]/10 bg-white shadow-[0_30px_90px_-38px_rgba(0,78,40,0.55)] ${
        compact ? "rounded-[1.75rem]" : "rounded-[2.25rem]"
      }`}
      role="img" aria-label="Ejemplo ilustrativo de un perfil de negocio con portada, ubicación, servicios, horarios y contacto"
    >
      <div className="relative h-44 overflow-hidden bg-[#083b29] sm:h-56">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(126,217,87,0.42),transparent_34%),linear-gradient(135deg,#123f2c_0%,#8f5d36_55%,#d5a868_100%)]" />
        <div className="absolute -right-7 bottom-[-2.5rem] h-44 w-44 rounded-full bg-[#f4d5a0]/60 blur-sm" />
        <div className="absolute bottom-5 left-5 flex items-end gap-3 sm:bottom-6 sm:left-7">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-[#f7efe4] text-[#004e28] shadow-xl sm:h-20 sm:w-20">
            <span className="font-[family-name:var(--font-varela-round)] text-2xl">CA</span>
          </div>
          <div className="pb-1 text-white drop-shadow-md">
            <p className="font-[family-name:var(--font-varela-round)] text-xl sm:text-2xl">Casa Alma</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/90 sm:text-sm">
              <MapPin size={13} aria-hidden="true" /> Mérida, Yucatán
            </p>
          </div>
        </div>
      </div>

      <div className={`bg-white ${compact ? "p-4" : "p-5 sm:p-7"}`}>
        <div className="grid grid-cols-3 gap-2">
          {[
            [MessageCircle, "Mensaje"],
            [MapPin, "Ubicación"],
            [QrCode, "Compartir"],
          ].map(([Icon, label]) => {
            const PreviewIcon = Icon as typeof MessageCircle;
            return (
              <div key={label as string} className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl bg-[#f2f3f4] px-2 py-2.5 text-[#004e28]">
                <PreviewIcon size={17} aria-hidden="true" />
                <span className="truncate text-[10px] font-semibold sm:text-xs">{label as string}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <p className="font-[family-name:var(--font-varela-round)] text-base text-[#004e28] sm:text-lg">Acerca de nosotros</p>
          <p className="mt-1.5 text-xs leading-5 text-[#53645b] sm:text-sm">
            Cocina artesanal, ingredientes locales y un espacio creado para disfrutar sin prisas.
          </p>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="font-[family-name:var(--font-varela-round)] text-base text-[#004e28] sm:text-lg">Servicios</p>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#168e00]">Ver todos</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {["Desayunos", "Eventos privados"].map((service, index) => (
              <div key={service} className="overflow-hidden rounded-xl border border-[#004e28]/8">
                <div className={`h-14 ${index === 0 ? "bg-[linear-gradient(135deg,#deb97f,#72482d)]" : "bg-[linear-gradient(135deg,#cfe6c0,#476a42)]"}`} />
                <p className="px-2.5 py-2 text-[11px] font-semibold text-[#263c31] sm:text-xs">{service}</p>
              </div>
            ))}
          </div>
        </div>

        {!compact ? (
          <div className="mt-5 flex items-center justify-between rounded-xl border border-[#004e28]/10 px-3.5 py-3">
            <div className="flex items-center gap-2 text-xs text-[#526158] sm:text-sm">
              <Clock3 size={16} className="text-[#168e00]" aria-hidden="true" />
              <span>Lun–Sáb · 8:00–20:00</span>
            </div>
            <span className="rounded-full bg-[#e9f6e6] px-2 py-1 text-[10px] font-bold text-[#126b05]">ABIERTO</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

