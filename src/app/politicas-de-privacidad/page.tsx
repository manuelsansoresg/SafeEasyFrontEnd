import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de devoluciones, cancelaciones y reembolsos | Drooopy",
  description: "Consulta la política de devoluciones, cancelaciones y reembolsos de Drooopy.",
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
      <h3 className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-primary">{title}</h3>
      <div className="mt-3 space-y-3 text-sm leading-7 md:text-base md:leading-8">{children}</div>
    </section>
  );
}

export default function PoliticasDePrivacidadPage() {
  return (
    <main className="overflow-x-hidden bg-white">
      <section className="bg-primary text-white">
        <div className="container mx-auto px-4 pt-40 pb-16 md:pt-48 md:pb-24">
          <div className="max-w-4xl">
            <p className="mb-4 font-[family-name:var(--font-varela-round)] text-lg text-[#7ed957]">
              Política de devoluciones
            </p>
            <h1 className="font-[family-name:var(--font-varela-round)] text-4xl leading-tight md:text-6xl">
              Devoluciones, cancelaciones y reembolsos.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/85 md:text-lg">
              Lineamientos aplicables a operaciones realizadas dentro de Drooopy entre compradores y vendedores independientes.
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
                Política de devoluciones, cancelaciones y reembolsos
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
                Esta política regula las operaciones realizadas dentro de [NOMBRE DE LA PLATAFORMA], marketplace digital donde vendedores independientes ofrecen productos y servicios a compradores mediante la intermediación tecnológica de la plataforma.
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
                Al utilizar la plataforma, vendedores y compradores aceptan las presentes políticas.
              </p>
            </div>

            <div className="space-y-8">
              <LegalSection title="1. Naturaleza de la plataforma">
                <p>[NOMBRE DE LA PLATAFORMA] actúa únicamente como intermediario tecnológico entre compradores y vendedores independientes.</p>
                <p>La plataforma:</p>
                <BulletList items={["No fabrica productos.", "No es propietaria del inventario publicado.", "No garantiza calidad, disponibilidad o tiempos de entrega.", "No asume responsabilidad directa sobre productos vendidos por terceros."]} />
                <p>Cada vendedor es responsable de sus productos, políticas comerciales y atención postventa.</p>
              </LegalSection>

              <LegalSection title="2. Cancelación de pedidos por el comprador">
                <p>El comprador podrá solicitar la cancelación de un pedido únicamente cuando:</p>
                <BulletList items={["El pedido no haya sido enviado.", "El vendedor aún no haya confirmado el procesamiento.", "Exista un error evidente en la compra."]} />
                <p>Una vez que el pedido haya sido enviado o entregado al repartidor, la cancelación podrá ser rechazada.</p>
              </LegalSection>

              <LegalSection title="3. Cancelación por parte del vendedor">
                <p>El vendedor podrá cancelar pedidos cuando:</p>
                <BulletList items={["El producto no esté disponible.", "Existan errores de inventario o precio.", "Se detecte posible fraude.", "El comprador proporcione información incorrecta."]} />
                <p>En caso de cancelación aprobada, el comprador podrá recibir reembolso conforme a los tiempos de la pasarela de pago utilizada.</p>
              </LegalSection>

              <LegalSection title="4. Devoluciones">
                <p>Las devoluciones serán responsabilidad directa del vendedor independiente.</p>
                <p>El comprador podrá solicitar devolución cuando:</p>
                <BulletList items={["El producto llegue dañado.", "El producto recibido sea incorrecto.", "Existan defectos de fabricación.", "El producto no coincida sustancialmente con la descripción publicada."]} />
                <p>Para solicitar una devolución, el comprador deberá:</p>
                <BulletList items={["Presentar evidencia fotográfica.", "Proporcionar número de pedido.", "Realizar la solicitud dentro de los 30 MIN posteriores a la entrega."]} />
              </LegalSection>

              <LegalSection title="5. Productos sin devolución">
                <p>Por razones de higiene, personalización o naturaleza del producto, no aplicarán devoluciones en:</p>
                <BulletList items={["Productos personalizados.", "Productos usados o dañados por el comprador.", "Productos perecederos.", "Servicios ya realizados.", "Productos en liquidación o promociones especiales, salvo defecto comprobable."]} />
              </LegalSection>

              <LegalSection title="6. Reembolsos">
                <p>Una vez aprobada la devolución:</p>
                <BulletList items={["El vendedor podrá autorizar reemplazo, saldo a favor o reembolso.", "Los reembolsos podrán reflejarse en un periodo de [5 a 30 días hábiles] dependiendo de la institución bancaria o pasarela de pago."]} />
                <p>La plataforma podrá intervenir como mediador, pero no garantiza reembolsos automáticos.</p>
              </LegalSection>

              <LegalSection title="7. Costos de envío por devolución">
                <p>Los gastos de devolución podrán ser cubiertos:</p>
                <BulletList items={["Por el vendedor, cuando exista error o defecto.", "Por el comprador, cuando la devolución sea por motivos personales o cambios de preferencia."]} />
              </LegalSection>

              <LegalSection title="8. Responsabilidad del repartidor">
                <p>Los repartidores independientes serán responsables del manejo adecuado de los productos durante el traslado.</p>
                <p>La plataforma no será responsable por:</p>
                <BulletList items={["Accidentes.", "Retrasos por tráfico o clima.", "Pérdidas ocasionadas por terceros.", "Daños ajenos al control razonable de la plataforma."]} />
              </LegalSection>

              <LegalSection title="9. Contracargos y fraude">
                <p>En caso de:</p>
                <BulletList items={["Contracargos bancarios.", "Compras fraudulentas.", "Uso indebido de métodos de pago."]} />
                <p>La plataforma podrá:</p>
                <BulletList items={["Suspender cuentas.", "Retener fondos temporalmente.", "Solicitar documentación adicional.", "Cancelar operaciones."]} />
              </LegalSection>

              <LegalSection title="10. Disputas entre usuarios">
                <p>La plataforma podrá actuar únicamente como intermediario para facilitar la comunicación entre comprador y vendedor.</p>
                <p>Sin embargo:</p>
                <BulletList items={["La resolución final corresponderá principalmente al vendedor conforme a sus políticas internas y legislación aplicable.", "La plataforma podrá tomar medidas preventivas para proteger la seguridad del marketplace."]} />
              </LegalSection>

              <LegalSection title="11. Limitación de responsabilidad">
                <p>[NOMBRE DE LA PLATAFORMA] no será responsable por:</p>
                <BulletList items={["Pérdidas indirectas.", "Lucro cesante.", "Daños ocasionados por productos vendidos por terceros.", "Incumplimientos de vendedores independientes.", "Retrasos logísticos ajenos a la plataforma."]} />
              </LegalSection>

              <LegalSection title="12. Modificaciones">
                <p>La plataforma podrá modificar la presente política en cualquier momento.</p>
                <p>Las modificaciones surtirán efectos desde su publicación en el sitio web.</p>
              </LegalSection>

              <LegalSection title="13. Contacto">
                <p>Para dudas relacionadas con devoluciones o cancelaciones:</p>
                <p>Correo: [EMAIL]</p>
                <p>WhatsApp: [NÚMERO]</p>
                <p>Sitio web: [DOMINIO]</p>
              </LegalSection>

              <LegalSection title="14. Aceptación">
                <p>Al utilizar la plataforma, compradores y vendedores aceptan la presente Política de Devoluciones, Cancelaciones y Reembolsos.</p>
                <p className="font-semibold text-primary">He leído y acepto la Política de Devoluciones y Cancelaciones.</p>
              </LegalSection>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
