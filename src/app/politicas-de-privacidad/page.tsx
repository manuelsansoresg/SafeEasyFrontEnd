import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | Drooopy",
  description:
    "Conoce qué información utiliza Drooopy, cómo la protegemos y qué opciones tienes sobre tus datos personales.",
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

function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-28">
      <h3 className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-primary">
        {title}
      </h3>
      <div className="mt-3 space-y-3 text-sm leading-7 md:text-base md:leading-8">
        {children}
      </div>
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
              Tu privacidad importa
            </p>

            <h1 className="font-[family-name:var(--font-varela-round)] text-4xl leading-tight md:text-6xl">
              Política de Privacidad.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/85 md:text-lg">
              Queremos que sepas de forma clara qué información utilizamos en
              Drooopy, para qué la necesitamos y qué puedes hacer con tus datos.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#f8faf9] py-10 md:py-14">
        <div className="container mx-auto px-4">
          <article className="mx-auto max-w-5xl rounded-2xl bg-white px-5 py-6 text-gray-700 shadow-sm ring-1 ring-gray-100 md:px-10 md:py-10">
            <div className="mb-8 border-b border-gray-100 pb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#168e00]">
                Privacidad y datos
              </p>

              <h2 className="mt-3 font-[family-name:var(--font-varela-round)] text-2xl font-bold text-primary md:text-3xl">
                Política de Privacidad de Drooopy
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
                Última actualización: 27 de agosto de 2026.
              </p>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
                Esta política explica qué información podemos recopilar cuando
                utilizas Drooopy desde nuestro sitio web o aplicaciones móviles,
                cómo la utilizamos y las opciones que tienes sobre tus datos.
              </p>
            </div>

            <div className="space-y-8">
              <LegalSection title="1. ¿Qué es Drooopy?">
                <p>
                  Drooopy es una plataforma que conecta a personas que buscan
                  productos o servicios con proveedores que los ofrecen.
                </p>

                <p>
                  Dependiendo de cómo utilices la plataforma, puedes participar
                  como cliente, proveedor u otro usuario autorizado.
                </p>

                <p>
                  Algunas funciones, como realizar pedidos, administrar
                  publicaciones, utilizar el chat, recibir notificaciones o
                  consultar información de una cuenta, requieren iniciar sesión.
                </p>
              </LegalSection>

              <LegalSection title="2. Información que podemos recopilar">
                <p>
                  Solo recopilamos la información necesaria para ofrecer,
                  proteger y mejorar las funciones de Drooopy.
                </p>

                <p>Dependiendo de cómo utilices la plataforma, podemos tratar:</p>

                <BulletList
                  items={[
                    "Nombre y apellidos.",
                    "Correo electrónico.",
                    "Número de teléfono.",
                    "Información de perfil.",
                    "Fotografía de perfil, cuando decidas proporcionarla.",
                    "Tipo de usuario o rol dentro de Drooopy.",
                    "Direcciones o ubicaciones relacionadas con entregas.",
                    "Información sobre pedidos y compras.",
                    "Mensajes, archivos o contenido enviado mediante el chat.",
                    "Información relacionada con productos o servicios publicados.",
                    "Información técnica necesaria para notificaciones y funcionamiento de la aplicación.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="3. Datos de tu cuenta">
                <p>
                  Cuando creas o utilizas una cuenta en Drooopy podemos guardar
                  la información necesaria para identificarte y permitirte usar
                  las funciones correspondientes a tu perfil.
                </p>

                <BulletList
                  items={[
                    "Nombre y apellidos.",
                    "Correo electrónico.",
                    "Teléfono.",
                    "Información de acceso y autenticación.",
                    "Datos que agregues o modifiques desde tu perfil.",
                  ]}
                />

                <p>
                  Las contraseñas no se almacenan como texto visible. Nuestro
                  sistema utiliza mecanismos de protección para gestionar las
                  credenciales de acceso.
                </p>
              </LegalSection>

              <LegalSection title="4. Información de proveedores">
                <p>
                  Si utilizas Drooopy como proveedor, podemos tratar además
                  información relacionada con tu negocio.
                </p>

                <BulletList
                  items={[
                    "Nombre comercial.",
                    "Descripción del negocio.",
                    "Logotipo e imágenes.",
                    "Dirección o ubicación del negocio.",
                    "Productos o servicios publicados.",
                    "Información relacionada con tu plan dentro de Drooopy.",
                    "Información necesaria para atender pedidos y clientes.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="5. Compras, pedidos y entregas">
                <p>
                  Cuando realizas una compra o solicitud dentro de Drooopy,
                  podemos guardar la información necesaria para gestionar esa
                  operación.
                </p>

                <BulletList
                  items={[
                    "Productos o servicios adquiridos.",
                    "Importe de la operación.",
                    "Proveedor relacionado con la compra.",
                    "Método de entrega.",
                    "Dirección o ubicación de entrega.",
                    "Estado del pedido.",
                    "Historial de compras y pedidos.",
                    "Información necesaria para confirmar y completar una entrega.",
                  ]}
                />

                <p>
                  Esta información permite dar seguimiento a tus operaciones,
                  coordinar entregas, resolver problemas y mantener un historial
                  de tus pedidos.
                </p>
              </LegalSection>

              <LegalSection title="6. Pagos">
                <p>
                  Algunas operaciones realizadas dentro de Drooopy pueden ser
                  procesadas mediante proveedores externos de pago, como Mercado
                  Pago.
                </p>

                <p>
                  Cuando utilizas una pasarela de pago, determinados datos
                  financieros pueden ser procesados directamente por ese
                  proveedor conforme a sus propias políticas de privacidad y
                  seguridad.
                </p>

                <p>
                  Drooopy no necesita almacenar directamente los datos completos
                  de tu tarjeta bancaria cuando estos son gestionados por la
                  pasarela de pago.
                </p>
              </LegalSection>

              <LegalSection title="7. Ubicación y direcciones">
                <p>
                  Algunas funciones de Drooopy necesitan una dirección o
                  ubicación para poder funcionar correctamente.
                </p>

                <p>Por ejemplo, podemos utilizarla para:</p>

                <BulletList
                  items={[
                    "Definir dónde debe entregarse un pedido.",
                    "Mostrar información relacionada con proveedores o productos según una zona.",
                    "Calcular o gestionar una entrega.",
                    "Mostrar información dentro de mapas.",
                    "Facilitar el seguimiento de determinadas operaciones logísticas.",
                  ]}
                />

                <p>
                  Dependiendo de la función, la ubicación puede ser seleccionada
                  directamente por ti o procesada mediante servicios de mapas.
                </p>

                <p>
                  No utilizamos tu ubicación con el propósito de seguir tus
                  movimientos fuera de las funciones necesarias para prestar los
                  servicios de Drooopy.
                </p>
              </LegalSection>

              <LegalSection title="8. Chat, mensajes y archivos">
                <p>
                  Drooopy permite la comunicación entre determinados usuarios
                  mediante herramientas de chat.
                </p>

                <p>En estas funciones podemos almacenar:</p>

                <BulletList
                  items={[
                    "Mensajes enviados y recibidos.",
                    "Fecha y hora de los mensajes.",
                    "Usuarios participantes en una conversación.",
                    "Imágenes, documentos u otros archivos adjuntos enviados voluntariamente.",
                  ]}
                />

                <p>
                  Esta información se utiliza para permitir la comunicación
                  dentro de la plataforma y para atender reportes relacionados
                  con seguridad, fraude, abuso o incumplimientos.
                </p>
              </LegalSection>

              <LegalSection title="9. Reportes y bloqueo de usuarios">
                <p>
                  Drooopy cuenta con herramientas para reportar y bloquear
                  usuarios dentro de determinadas interacciones.
                </p>

                <p>
                  Cuando realizas un reporte, personal autorizado puede revisar
                  la información necesaria para analizar la situación.
                </p>

                <p>Los reportes pueden utilizarse para:</p>

                <BulletList
                  items={[
                    "Investigar posibles abusos.",
                    "Detectar fraude o comportamiento inapropiado.",
                    "Proteger a otros usuarios.",
                    "Aplicar medidas de moderación cuando corresponda.",
                    "Conservar evidencia relacionada con acciones de seguridad.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="10. Notificaciones">
                <p>
                  Drooopy puede enviarte notificaciones relacionadas con tu
                  actividad dentro de la plataforma.
                </p>

                <p>Estas pueden incluir avisos sobre:</p>

                <BulletList
                  items={[
                    "Pedidos.",
                    "Mensajes.",
                    "Entregas.",
                    "Cambios importantes en tu cuenta.",
                    "Actividad relevante relacionada con los servicios de Drooopy.",
                  ]}
                />

                <p>
                  Para enviar estas notificaciones podemos utilizar servicios
                  como Firebase Cloud Messaging.
                </p>

                <p>
                  Tu dispositivo puede generar un identificador o token técnico
                  utilizado para poder entregar las notificaciones.
                </p>

                <p>
                  Puedes administrar o desactivar las notificaciones desde la
                  configuración de tu dispositivo.
                </p>
              </LegalSection>

              <LegalSection title="11. Inicio de sesión con servicios externos">
                <p>
                  En algunas plataformas Drooopy puede permitir iniciar sesión
                  mediante servicios externos, como Google.
                </p>

                <p>
                  Si eliges utilizar esta opción, podemos recibir información
                  básica necesaria para crear o identificar tu cuenta, como:
                </p>

                <BulletList
                  items={[
                    "Nombre.",
                    "Correo electrónico.",
                    "Identificador proporcionado por el servicio de autenticación.",
                  ]}
                />

                <p>Drooopy no recibe tu contraseña de Google.</p>
              </LegalSection>

              <LegalSection title="12. ¿Para qué utilizamos tu información?">
                <p>
                  Utilizamos tus datos principalmente para que Drooopy pueda
                  ofrecer sus servicios de manera segura y funcional.
                </p>

                <BulletList
                  items={[
                    "Crear y administrar tu cuenta.",
                    "Identificarte cuando inicias sesión.",
                    "Mostrar productos y servicios.",
                    "Gestionar compras y pedidos.",
                    "Coordinar entregas.",
                    "Permitir la comunicación entre usuarios.",
                    "Enviar notificaciones.",
                    "Brindar soporte.",
                    "Investigar reportes.",
                    "Prevenir fraude, abuso o accesos no autorizados.",
                    "Mantener la seguridad de Drooopy.",
                    "Mejorar la experiencia y funcionamiento de la plataforma.",
                    "Cumplir obligaciones legales cuando corresponda.",
                  ]}
                />

                <p className="font-semibold text-primary">
                  Drooopy no vende tu información personal.
                </p>
              </LegalSection>

              <LegalSection title="13. ¿Con quién podemos compartir información?">
                <p>
                  No compartimos tus datos personales sin una razón relacionada
                  con el funcionamiento, seguridad o cumplimiento legal de
                  Drooopy.
                </p>

                <p>
                  Sin embargo, determinadas operaciones requieren compartir
                  información limitada con otras partes.
                </p>

                <p className="font-semibold text-primary">Proveedores</p>

                <p>
                  Cuando realizas un pedido, el proveedor puede recibir la
                  información necesaria para prepararlo, atenderlo y completar
                  la operación.
                </p>

                <p className="font-semibold text-primary">Repartidores</p>

                <p>
                  Cuando una operación requiere entrega, el repartidor puede
                  recibir la información necesaria para completar esa entrega.
                </p>

                <p className="font-semibold text-primary">
                  Proveedores tecnológicos
                </p>

                <p>
                  Podemos utilizar servicios externos necesarios para operar
                  Drooopy, entre ellos:
                </p>

                <BulletList
                  items={[
                    "Servicios de alojamiento e infraestructura.",
                    "Firebase.",
                    "Google Maps.",
                    "Servicios de notificaciones.",
                    "Servicios de autenticación.",
                    "Servicios de almacenamiento de archivos.",
                    "Pasarelas de pago como Mercado Pago.",
                  ]}
                />

                <p>
                  Estos proveedores pueden procesar información en la medida
                  necesaria para prestar sus servicios.
                </p>
              </LegalSection>

              <LegalSection title="14. Seguridad de tu información">
                <p>
                  Aplicamos medidas técnicas y organizativas para reducir el
                  riesgo de acceso no autorizado, pérdida, alteración o uso
                  indebido de la información.
                </p>

                <p>Entre estas medidas podemos utilizar:</p>

                <BulletList
                  items={[
                    "Comunicaciones mediante HTTPS.",
                    "Autenticación de usuarios.",
                    "Controles de acceso.",
                    "Protección de credenciales.",
                    "Restricciones de acceso a información sensible.",
                    "Monitoreo y medidas de seguridad dentro de la plataforma.",
                  ]}
                />

                <p>
                  Ningún sistema conectado a Internet puede garantizar una
                  seguridad absoluta, pero trabajamos para mantener medidas
                  razonables de protección.
                </p>
              </LegalSection>

              <LegalSection title="15. Conservación de los datos">
                <p>
                  Conservamos la información mientras sea necesaria para prestar
                  los servicios de Drooopy o cumplir con obligaciones
                  relacionadas con tus operaciones.
                </p>

                <p>Por ejemplo, algunos datos pueden conservarse para:</p>

                <BulletList
                  items={[
                    "Mantener tu cuenta.",
                    "Gestionar pedidos y operaciones activas.",
                    "Resolver disputas.",
                    "Atender reportes.",
                    "Prevenir fraude o abuso.",
                    "Cumplir obligaciones legales, fiscales o contables cuando corresponda.",
                  ]}
                />

                <p>
                  Cuando la información deja de ser necesaria, puede ser
                  eliminada, anonimizada o conservada únicamente en los casos
                  permitidos o requeridos legalmente.
                </p>
              </LegalSection>

              <LegalSection title="16. Eliminación de tu cuenta">
                <p>
                  Puedes solicitar la eliminación de tu cuenta directamente
                  desde la aplicación Drooopy.
                </p>

                <p>
                  Dentro de tu perfil encontrarás la opción{" "}
                  <strong>Eliminar cuenta</strong>.
                </p>

                <p>
                  También puedes iniciar el proceso desde nuestro sitio web.
                </p>

                <p>Cuando solicitas la eliminación:</p>

                <BulletList
                  items={[
                    "Tu cuenta puede bloquearse para impedir nuevos accesos.",
                    "Las sesiones activas se cierran.",
                    "Se programa el proceso de eliminación.",
                    "Puedes recibir un correo que te permita cancelar la solicitud durante el periodo permitido.",
                  ]}
                />

                <p>
                  Si existen operaciones activas que puedan afectar a otras
                  personas, como pedidos todavía en proceso, la eliminación
                  definitiva puede esperar hasta que esas obligaciones hayan
                  finalizado.
                </p>

                <p>
                  Una vez completado el proceso, la información personal que ya
                  no sea necesario conservar será eliminada o anonimizada.
                </p>
              </LegalSection>

              <LegalSection title="17. Datos que pueden conservarse después de eliminar una cuenta">
                <p>
                  Eliminar una cuenta no siempre significa que absolutamente
                  todos los registros relacionados deban desaparecer de forma
                  inmediata.
                </p>

                <p>
                  Podemos conservar información limitada cuando sea necesaria
                  para:
                </p>

                <BulletList
                  items={[
                    "Cumplir obligaciones legales.",
                    "Mantener registros de operaciones comerciales.",
                    "Atender disputas o reclamaciones.",
                    "Investigar fraude o abuso.",
                    "Conservar evidencia relacionada con reportes o acciones de moderación.",
                  ]}
                />

                <p>
                  Siempre que sea posible, la información personal asociada a
                  estos registros será eliminada o anonimizada.
                </p>
              </LegalSection>

              <LegalSection title="18. Tus derechos sobre tus datos">
                <p>
                  Dependiendo de la legislación aplicable, puedes solicitar
                  información o ejercer derechos relacionados con tus datos
                  personales.
                </p>

                <p>Estos pueden incluir:</p>

                <BulletList
                  items={[
                    "Acceso a tus datos personales.",
                    "Corrección de información incorrecta.",
                    "Actualización de tus datos.",
                    "Eliminación de tu cuenta.",
                    "Información sobre cómo utilizamos tus datos.",
                    "Oposición o limitación de determinados tratamientos cuando corresponda.",
                  ]}
                />

                <p>
                  Muchos datos pueden modificarse directamente desde tu perfil
                  de usuario.
                </p>
              </LegalSection>

              <LegalSection title="19. Privacidad de menores">
                <p>
                  Drooopy no está diseñado específicamente como un servicio
                  dirigido a niños.
                </p>

                <p>
                  Los usuarios deben cumplir con la edad mínima requerida por la
                  legislación aplicable y por las tiendas de aplicaciones desde
                  las que utilicen Drooopy.
                </p>

                <p>
                  Si detectamos que se ha proporcionado información de un menor
                  de manera indebida, podremos tomar las medidas necesarias para
                  eliminarla o restringir la cuenta.
                </p>
              </LegalSection>

              <LegalSection title="20. Servicios y enlaces de terceros">
                <p>
                  Drooopy utiliza o puede enlazar servicios proporcionados por
                  terceros.
                </p>

                <p>
                  Estos servicios pueden tener sus propias políticas de
                  privacidad y condiciones de uso.
                </p>

                <p>
                  Te recomendamos consultar las políticas correspondientes
                  cuando utilices servicios externos como Google, Firebase,
                  Google Maps o Mercado Pago.
                </p>
              </LegalSection>

              <LegalSection title="21. Cambios a esta política">
                <p>
                  Podemos actualizar esta Política de Privacidad cuando sea
                  necesario, por ejemplo si agregamos nuevas funciones,
                  modificamos nuestros servicios o cambian requisitos legales.
                </p>

                <p>
                  Cuando exista un cambio importante podremos informarlo dentro
                  de Drooopy, mediante nuestro sitio web o por otros medios
                  apropiados.
                </p>

                <p>
                  La versión vigente estará disponible siempre en esta página.
                </p>
              </LegalSection>

              <LegalSection title="22. Contacto">
                <p>
                  Si tienes dudas sobre esta Política de Privacidad, el uso de
                  tus datos o la eliminación de tu cuenta, puedes comunicarte
                  con Drooopy mediante nuestros canales oficiales.
                </p>

                <p>
                  Sitio web:{" "}
                  <a
                    href="https://drooopy.com"
                    className="font-semibold text-primary hover:underline"
                  >
                    drooopy.com
                  </a>
                </p>

                <p>
                  También puedes utilizar nuestra sección de contacto disponible
                  en el sitio web.
                </p>
              </LegalSection>

              <LegalSection title="23. Aceptación">
                <p>
                  Al utilizar Drooopy reconoces que has tenido acceso a esta
                  Política de Privacidad y entiendes cómo tratamos la información
                  necesaria para prestar nuestros servicios.
                </p>

                <p className="font-semibold text-primary">
                  Nuestro objetivo es utilizar únicamente la información
                  necesaria para que Drooopy funcione de manera segura,
                  transparente y útil para sus usuarios.
                </p>
              </LegalSection>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}