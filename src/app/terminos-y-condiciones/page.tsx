import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y condiciones | Drooopy",
  description: "Consulta los términos generales de uso, aviso de privacidad y políticas de Drooopy.",
};

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#168e00]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="scroll-mt-28">
      <h3 className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-primary">
        {title}
      </h3>
      <div className="mt-3 space-y-3 text-sm leading-7 md:text-base md:leading-8">{children}</div>
    </section>
  );
}

export default function TerminosYCondicionesPage() {
  return (
    <main className="overflow-x-hidden bg-white">
      <section className="bg-primary text-white">
        <div className="container mx-auto px-4 pt-40 pb-16 md:pt-48 md:pb-24">
          <div className="max-w-4xl">
            <p className="mb-4 font-[family-name:var(--font-varela-round)] text-lg text-[#7ed957]">
              Términos y condiciones
            </p>
            <h1 className="font-[family-name:var(--font-varela-round)] text-4xl leading-tight md:text-6xl">
              Reglas claras para usar Drooopy.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/85 md:text-lg">
              Esta sección reúne los términos de uso, aviso de privacidad y políticas aplicables a la plataforma.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#f8faf9] py-10 md:py-14">
        <div className="container mx-auto px-4">
          <article className="mx-auto max-w-5xl rounded-2xl bg-white px-5 py-6 text-gray-700 shadow-sm ring-1 ring-gray-100 md:px-10 md:py-10">
            <div className="mb-8 border-b border-gray-100 pb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#168e00]">Documento legal</p>
              <h2 className="mt-3 font-[family-name:var(--font-varela-round)] text-2xl font-bold text-primary md:text-3xl">
                Términos, condiciones y aviso de privacidad
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
                Documento completo de uso de la plataforma, responsabilidades, pagos, privacidad y aceptación.
              </p>
            </div>

            <div className="space-y-8">
              <LegalSection title="1. Definiciones">
                <p>Para efectos del presente documento se entenderá por:</p>
                <BulletList
                  items={[
                    "Plataforma: Sitio web y/o aplicación móvil [NOMBRE DE LA PLATAFORMA].",
                    "Usuario: Persona que navega o utiliza la plataforma.",
                    "Vendedor: Usuario independiente que publica y comercializa productos o servicios.",
                    "Comprador: Usuario que adquiere productos o servicios.",
                    "Repartidor Independiente: Persona física independiente que realiza servicios de entrega.",
                    "Contenido: fotografías, textos, logotipos, descripciones, precios, y cualquier material publicado dentro de la plataforma.",
                    "Empresa: [NOMBRE DE LA EMPRESA O RAZÓN SOCIAL].",
                  ]}
                />
              </LegalSection>

              <LegalSection title="2. Naturaleza de la plataforma">
                <p>La plataforma actúa exclusivamente como intermediario tecnológico entre compradores, vendedores y repartidores independientes.</p>
                <p>La empresa:</p>
                <BulletList
                  items={[
                    "No fabrica productos.",
                    "No es propietaria de los artículos publicados.",
                    "No garantiza ventas.",
                    "No mantiene relación laboral con vendedores o repartidores.",
                    "No presta directamente servicios de mensajería o entrega.",
                  ]}
                />
                <p>Cada vendedor y repartidor opera bajo su propia responsabilidad y autonomía.</p>
              </LegalSection>

              <LegalSection title="3. Registro de usuarios">
                <p>Para utilizar determinadas funciones será necesario registrarse proporcionando información verídica y actualizada.</p>
                <p>El usuario será responsable de:</p>
                <BulletList
                  items={[
                    "Mantener confidencialidad de su contraseña.",
                    "Toda actividad realizada desde su cuenta.",
                    "Actualizar su información personal y fiscal.",
                  ]}
                />
                <p>La plataforma podrá suspender o cancelar cuentas por:</p>
                <BulletList
                  items={[
                    "Información falsa.",
                    "Actividades fraudulentas.",
                    "Incumplimiento de políticas.",
                    "Conductas ilegales o abusivas.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="4. Espacios comerciales">
                <p>Los vendedores podrán:</p>
                <BulletList
                  items={[
                    "Crear páginas comerciales.",
                    "Publicar productos y servicios.",
                    "Subir fotografías y contenido.",
                    "Establecer precios.",
                    "Contratar publicidad dentro de la plataforma.",
                  ]}
                />
                <p>El vendedor garantiza:</p>
                <BulletList
                  items={[
                    "Ser propietario o contar con autorización sobre los productos publicados.",
                    "Que la información es real y verificable.",
                    "Cumplir con la legislación mexicana aplicable.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="5. Productos y servicios prohibidos">
                <p>Queda prohibida la publicación, promoción o comercialización de:</p>
                <BulletList
                  items={[
                    "Productos ilícitos.",
                    "Armas y explosivos.",
                    "Drogas o sustancias prohibidas.",
                    "Productos falsificados.",
                    "Contenido ilegal o fraudulento.",
                    "Productos robados.",
                    "Material que infrinja derechos de autor.",
                    "Cualquier producto prohibido por las leyes mexicanas.",
                  ]}
                />
                <p>La plataforma podrá eliminar contenido sin previo aviso.</p>
              </LegalSection>

              <LegalSection title="6. Repartidores independientes">
                <p>Los repartidores registrados dentro de la plataforma reconocen y aceptan que:</p>
                <BulletList
                  items={[
                    "Operan de manera independiente y autónoma.",
                    "No existe relación laboral con la empresa.",
                    "Administran libremente sus horarios y disponibilidad.",
                    "Son responsables de sus herramientas, vehículo, combustible, licencias, seguros y permisos.",
                    "Son responsables del cumplimiento de obligaciones fiscales y legales correspondientes.",
                  ]}
                />
                <p>La plataforma únicamente facilita la conexión tecnológica entre usuarios y repartidores.</p>
              </LegalSection>

              <LegalSection title="7. Entregas">
                <p>Los tiempos de entrega son estimados y pueden variar por:</p>
                <BulletList items={["Condiciones climáticas.", "Tráfico.", "Disponibilidad del repartidor.", "Situaciones ajenas a la plataforma."]} />
                <p>La empresa no garantiza tiempos exactos de entrega.</p>
              </LegalSection>

              <LegalSection title="8. Pagos y comisiones">
                <p>La plataforma podrá cobrar:</p>
                <BulletList items={["Comisiones por venta.", "Membresías.", "Espacios publicitarios.", "Tarifas por servicio.", "Comisiones por entrega."]} />
                <p>Los pagos serán procesados mediante plataformas externas autorizadas.</p>
                <p>Las tarifas serán informadas previamente dentro del sitio web.</p>
                <p>Los pagos realizados no son reembolsables salvo disposición expresa de la plataforma.</p>
                <p>La empresa no almacena información bancaria completa de los usuarios.</p>
              </LegalSection>

              <LegalSection title="9. Facturación e impuestos">
                <p>Cada vendedor y repartidor independiente será responsable de:</p>
                <BulletList items={["Declarar impuestos.", "Emitir facturas cuando corresponda.", "Cumplir obligaciones ante el SAT."]} />
                <p>La plataforma no será responsable por incumplimientos fiscales de terceros.</p>
              </LegalSection>

              <LegalSection title="10. Responsabilidad del vendedor">
                <p>Cada vendedor será responsable de:</p>
                <BulletList
                  items={[
                    "Calidad de productos.",
                    "Garantías.",
                    "Existencia de inventario.",
                    "Atención al cliente.",
                    "Devoluciones.",
                    "Cumplimiento de la Ley Federal de Protección al Consumidor.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="11. Responsabilidad del repartidor">
                <p>Cada repartidor independiente será responsable de:</p>
                <BulletList items={["El manejo adecuado de productos.", "Cumplimiento de normas de tránsito.", "Entregas realizadas.", "Conducta profesional con usuarios."]} />
                <p>La plataforma no será responsable por accidentes, robos o daños ocasionados por repartidores independientes.</p>
              </LegalSection>

              <LegalSection title="12. Limitación de responsabilidad">
                <p>La plataforma se proporciona “tal cual” y no garantiza:</p>
                <BulletList items={["Disponibilidad permanente.", "Funcionamiento libre de errores.", "Incremento de ventas.", "Resultados económicos específicos."]} />
                <p>La empresa no será responsable por:</p>
                <BulletList
                  items={[
                    "Pérdidas económicas.",
                    "Fraudes entre usuarios.",
                    "Daños indirectos.",
                    "Retrasos.",
                    "Fallas de terceros.",
                    "Conductas de vendedores o repartidores.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="13. Propiedad intelectual">
                <p>Todo el contenido de la plataforma:</p>
                <BulletList items={["Diseño", "Software", "Logotipos", "Bases de datos", "Marca"]} />
                <p>Está protegido por las leyes mexicanas e internacionales de propiedad intelectual.</p>
                <p>Los usuarios conservan derechos sobre el contenido publicado, otorgando autorización para su uso promocional dentro de la plataforma.</p>
              </LegalSection>

              <div className="rounded-2xl bg-[#f2f3f4] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#168e00]">Políticas de privacidad</p>
                <h3 className="mt-2 font-[family-name:var(--font-varela-round)] text-2xl font-bold text-primary">Aviso de privacidad</h3>
              </div>

              <LegalSection title="Aviso de privacidad">
                <p>
                  Bienvenido(a) a [NOMBRE DE LA PLATAFORMA], una plataforma digital que permite a las personas usuarias crear su propia página dentro del sitio, publicar, promocionar y vender artículos, así como registrarse como repartidores independientes para realizar servicios de entrega de productos.
                </p>
                <p>
                  La presente Política de Privacidad tiene como finalidad informarte cómo recopilamos, utilizamos, almacenamos, protegemos y, en su caso, compartimos tus datos personales, de conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y demás legislación aplicable en México.
                </p>
                <p>[NOMBRE DE LA EMPRESA] es responsable del tratamiento de datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.</p>
              </LegalSection>

              <LegalSection title="Datos recabados">
                <p>Podremos recopilar:</p>
                <BulletList items={["Nombre", "Correo electrónico", "Teléfono", "Dirección", "RFC", "Datos fiscales", "Datos de navegación"]} />
              </LegalSection>

              <LegalSection title="Finalidades">
                <p>Los datos serán utilizados para:</p>
                <BulletList
                  items={[
                    "Registro de cuentas",
                    "Procesamiento de pagos",
                    "Facturación",
                    "Atención al cliente",
                    "Publicación de productos",
                    "Gestión de entregas",
                    "Seguridad de la plataforma",
                    "Marketing y promociones",
                  ]}
                />
              </LegalSection>

              <LegalSection title="Derechos ARCO">
                <p>Los usuarios podrán ejercer sus derechos de:</p>
                <BulletList items={["Acceso", "Rectificación", "Cancelación", "Oposición"]} />
                <p>Mediante solicitud enviada a:</p>
                <p>[CORREO ELECTRÓNICO]</p>
              </LegalSection>

              <LegalSection title="Uso de cookies">
                <p>La plataforma utiliza cookies y tecnologías similares para:</p>
                <BulletList items={["Mejorar experiencia del usuario.", "Analizar tráfico.", "Mantener sesiones activas.", "Mostrar contenido personalizado."]} />
              </LegalSection>

              <LegalSection title="Cancelación de cuentas">
                <p>La plataforma podrá cancelar cuentas por:</p>
                <BulletList items={["Fraude.", "Conductas abusivas.", "Incumplimiento de políticas.", "Contracargos injustificados.", "Actividades ilícitas."]} />
              </LegalSection>

              <LegalSection title="Modificaciones">
                <p>La empresa podrá modificar los presentes términos y políticas en cualquier momento.</p>
                <p>Las modificaciones entrarán en vigor al publicarse en la plataforma.</p>
              </LegalSection>

              <LegalSection title="Legislación aplicable">
                <p>El presente documento se regirá conforme a las leyes de los Estados Unidos Mexicanos.</p>
                <p>Cualquier controversia será resuelta ante los tribunales competentes de [CIUDAD Y ESTADO], renunciando las partes a cualquier otro fuero.</p>
              </LegalSection>

              <LegalSection title="Contacto">
                <p>[NOMBRE DE LA EMPRESA]</p>
                <p>Correo: [EMAIL]</p>
                <p>Teléfono: [TELÉFONO]</p>
                <p>Sitio web: [DOMINIO]</p>
              </LegalSection>

              <LegalSection title="Aceptación">
                <p>Al registrarse o utilizar la plataforma, el usuario declara haber leído y aceptado los presentes Términos y Condiciones, Aviso de Privacidad y Políticas de Uso.</p>
                <p className="font-semibold text-primary">Acepto los Términos y Condiciones y el Aviso de Privacidad.</p>
              </LegalSection>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
