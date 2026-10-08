
#!/usr/bin/env python3

"""
Drooopy - Integracion de capacidad simultanea en Agenda.

Modifica exclusivamente:
src/app/admin/agenda/page.tsx

Requisitos:
- Ejecutar desde la raiz del frontend.
- Haber actualizado src/types/agenda.ts.
- Tener el codigo de Agenda compatible con los
  fragmentos revisados en GitHub.

No modifica backend, pagos ni reservaciones.
"""

from pathlib import Path
import sys


PAGE = Path("src/app/admin/agenda/page.tsx")

MARKER = "DROOOPY_AGENDA_CAPACITY_FIELD"


def replace_once(
    source: str,
    original: str,
    replacement: str,
    description: str,
) -> str:
    count = source.count(original)

    if count != 1:
        raise RuntimeError(
            f"No se pudo aplicar '{description}'. "
            f"Se encontraron {count} coincidencias "
            "cuando se esperaba exactamente una. "
            "El archivo no sera modificado."
        )

    return source.replace(original, replacement, 1)


def main() -> int:
    if not PAGE.is_file():
        print(
            "ERROR: No se encontro "
            "src/app/admin/agenda/page.tsx"
        )
        print(
            "Ejecuta este script desde "
            "la raiz del proyecto frontend."
        )
        return 1

    source = PAGE.read_text(encoding="utf-8")

    if MARKER in source:
        print(
            "La capacidad simultanea ya fue "
            "integrada en esta pantalla."
        )
        return 0

    if "max_simultaneous_bookings:" in source:
        print(
            "ERROR: Se detectaron modificaciones "
            "previas de capacidad en esta pantalla."
        )
        print(
            "Revisa page.tsx antes de continuar "
            "para evitar modificaciones duplicadas."
        )
        return 1

    # ----------------------------------------------
    # 1. Incorporar capacidad al payload de guardado
    # ----------------------------------------------

    original_payload = """    cancellation_notice_hours: settings.cancellation_notice_hours,
    automatic_confirmation: settings.automatic_confirmation,"""

    nuevo_payload = """    cancellation_notice_hours: settings.cancellation_notice_hours,
    max_simultaneous_bookings: settings.max_simultaneous_bookings,
    automatic_confirmation: settings.automatic_confirmation,"""

    source = replace_once(
        source,
        original_payload,
        nuevo_payload,
        "Campo en payload de configuracion",
    )

    # ----------------------------------------------
    # 2. Validar numero entero antes de guardar
    # ----------------------------------------------

    original_save = """  const saveSettings = async (successMessage = "Configuración guardada.") => {
    if (!settings) return false;

    setSaving(true);"""

    nuevo_save = """  const saveSettings = async (successMessage = "Configuración guardada.") => {
    if (!settings) return false;

    const capacity = settings.max_simultaneous_bookings;

    if (
      !Number.isSafeInteger(capacity) ||
      capacity < 1 ||
      capacity > 1000
    ) {
      setToast({
        type: "error",
        message: "La capacidad debe ser un número entero entre 1 y 1000.",
      });
      return false;
    }

    setSaving(true);"""

    source = replace_once(
        source,
        original_save,
        nuevo_save,
        "Validacion de capacidad",
    )

    # ----------------------------------------------
    # 3. Agregar seccion visual en Agenda > General
    # ----------------------------------------------

    original_ui = """            <div className="mt-6 grid gap-3 md:grid-cols-2">"""

    nueva_ui = """            {/* DROOOPY_AGENDA_CAPACITY_FIELD */}
            <div className="mt-6 rounded-2xl border border-[#168e00]/15 bg-[#f2f3f4] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#168e00]/10 text-[#168e00]">
                  <CalendarClock aria-hidden="true" size={22} />
                </span>

                <div>
                  <h3 className="font-[family-name:var(--font-varela-round)] text-lg text-[#004e28]">
                    Capacidad de atención simultánea
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    Indica cuántas citas puede atender tu negocio al mismo tiempo.
                    Esta capacidad se comparte entre todos tus servicios.
                  </p>
                </div>
              </div>

              <div className="mt-5 max-w-sm">
                <NumberField
                  label="Número máximo de citas simultáneas"
                  value={settings.max_simultaneous_bookings ?? 1}
                  min={1}
                  max={1000}
                  description="Escribe la cantidad de citas que tu negocio puede atender al mismo tiempo."
                  onChange={(value) =>
                    setSettings({
                      ...settings,
                      max_simultaneous_bookings: value,
                    })
                  }
                />
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl bg-white p-3 text-sm leading-6 text-gray-600">
                <Info
                  aria-hidden="true"
                  size={18}
                  className="mt-0.5 shrink-0 text-[#168e00]"
                />
                <p>
                  {settings.max_simultaneous_bookings === 1
                    ? "Con capacidad 1, solo se permite una cita a la vez entre todos los servicios."
                    : `Tu negocio podrá atender hasta ${settings.max_simultaneous_bookings} citas simultáneas. Cuando se alcance el límite, los horarios ocupados dejarán de estar disponibles para nuevas reservaciones.`}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">"""

    source = replace_once(
        source,
        original_ui,
        nueva_ui,
        "Campo visual de capacidad",
    )

    # ----------------------------------------------
    # 4. Comprobacion final
    # ----------------------------------------------

    required = [
        MARKER,
        "max_simultaneous_bookings: settings.max_simultaneous_bookings",
        "Number.isSafeInteger(capacity)",
        "Capacidad de atención simultánea",
    ]

    missing = [
        item
        for item in required
        if item not in source
    ]

    if missing:
        raise RuntimeError(
            "No se completaron todas las modificaciones: "
            + ", ".join(missing)
        )

    # Todos los cambios se preparan en memoria.
    # Solo se escribe si todas las validaciones pasan.
    PAGE.write_text(
        source,
        encoding="utf-8",
    )

    print("OK: Configuracion de Agenda actualizada.")
    print()
    print("Archivo modificado:")
    print(f"  {PAGE}")
    print()
    print("Cambios:")
    print("  - Campo numerico de capacidad.")
    print("  - Guardado en la API existente.")
    print("  - Validacion entre 1 y 1000.")
    print("  - Descripcion de citas simultaneas.")
    print()
    print("No se modificaron pagos ni reservaciones.")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
