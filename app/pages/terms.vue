<script setup lang="ts">
useSeoMeta({
  title: 'Términos de uso · Not Enough Time',
  description: 'Condiciones de uso de la fase personal y de pruebas de Not Enough Time.'
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800">
    <main class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <NuxtLink
        to="/"
        class="inline-flex min-h-10 items-center rounded-md text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600"
      >
        Volver a Not Enough Time
      </NuxtLink>

      <article class="mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
        <header class="border-b border-slate-200 pb-6">
          <p class="text-sm font-semibold uppercase tracking-wide text-red-600">
            Not Enough Time
          </p>
          <h1 class="mt-2 text-3xl font-semibold text-slate-950">
            Términos de uso
          </h1>
          <p class="mt-3 text-sm text-slate-500">
            Última actualización: 19 de septiembre de 2026.
          </p>
        </header>

        <div class="space-y-8 pt-6 leading-7">
          <section aria-labelledby="terms-scope">
            <h2 id="terms-scope" class="text-xl font-semibold text-slate-950">
              Fase personal y de pruebas
            </h2>
            <p class="mt-3">
              Not Enough Time está disponible exclusivamente para su responsable y usuarios de
              prueba autorizados en Google Cloud. No está abierto al público. Su solicitud de
              Compliance Audit está preparada, pero no enviada, y Google o YouTube no han
              aprobado ni certificado esta aplicación.
            </p>
          </section>

          <section aria-labelledby="terms-youtube">
            <h2 id="terms-youtube" class="text-xl font-semibold text-slate-950">
              Servicios de YouTube
            </h2>
            <p class="mt-3">
              Al usar funciones que acceden a YouTube Data API, aceptas quedar sujeto a los
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noreferrer"
                class="inline-flex min-h-6 max-w-full flex-wrap items-center py-1 font-semibold text-red-700 underline underline-offset-4"
              >Términos del Servicio de YouTube<span class="sr-only"> (se abre en una pestaña nueva)</span></a>.
              Google y YouTube procesan sus datos conforme a sus propios términos y políticas.
            </p>
            <p class="mt-3">
              Solo se solicita acceso de lectura. No intentes eludir límites, restricciones,
              medidas de seguridad o cuotas de Google o YouTube mediante esta aplicación.
            </p>
          </section>

          <section aria-labelledby="terms-metrics">
            <h2 id="terms-metrics" class="text-xl font-semibold text-slate-950">
              Cálculos de Not Enough Time
            </h2>
            <p class="mt-3">
              Carga de publicación, ranking, porcentajes, categorías por duración, ritmo diario y
              comparación con capacidad son métricas calculadas por Not Enough Time. No son datos,
              recomendaciones ni certificaciones proporcionados o aprobados por YouTube. La
              aplicación mide publicaciones; no conoce historial de reproducción ni vídeos
              pendientes de ver.
            </p>
          </section>

          <section aria-labelledby="terms-data">
            <h2 id="terms-data" class="text-xl font-semibold text-slate-950">
              Datos, consentimiento y borrado
            </h2>
            <p class="mt-3">
              Debes aceptar estos términos y el aviso de privacidad antes de conectar una cuenta.
              Puedes retirar el consentimiento mediante “Desconectar” o “Borrar todos mis datos”.
              Consulta el
              <NuxtLink
                to="/privacy/"
                class="inline-flex min-h-6 items-center py-1 font-semibold text-red-700 underline underline-offset-4"
              >aviso de privacidad</NuxtLink>
              para conocer datos consultados, retención y controles de borrado.
            </p>
          </section>

          <section aria-labelledby="terms-references">
            <h2 id="terms-references" class="text-xl font-semibold text-slate-950">
              Referencias aplicables
            </h2>
            <ul class="mt-3 list-disc space-y-2 pl-6">
              <li>
                <a
                  href="https://www.youtube.com/t/terms"
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex min-h-6 max-w-full flex-wrap items-center py-1 font-semibold text-red-700 underline underline-offset-4"
                >Términos del Servicio de YouTube<span class="sr-only"> (se abre en una pestaña nueva)</span></a>
              </li>
              <li>
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex min-h-6 max-w-full flex-wrap items-center py-1 font-semibold text-red-700 underline underline-offset-4"
                >Política de datos de usuario de los servicios API de Google<span class="sr-only"> (se abre en una pestaña nueva)</span></a>
              </li>
              <li>
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex min-h-6 max-w-full flex-wrap items-center py-1 font-semibold text-red-700 underline underline-offset-4"
                >Política de privacidad de Google<span class="sr-only"> (se abre en una pestaña nueva)</span></a>
              </li>
            </ul>
          </section>

          <section aria-labelledby="terms-contact">
            <h2 id="terms-contact" class="text-xl font-semibold text-slate-950">
              Contacto
            </h2>
            <p class="mt-3">
              Para consultas o solicitudes, abre una incidencia en el
              <a
                href="https://github.com/jonatancheca/not-enough-time/issues"
                target="_blank"
                rel="noreferrer"
                class="inline-flex min-h-6 max-w-full flex-wrap items-center py-1 font-semibold text-red-700 underline underline-offset-4"
              >repositorio de Not Enough Time<span class="sr-only"> (se abre en una pestaña nueva)</span></a>.
            </p>
          </section>
        </div>
      </article>
    </main>
  </div>
</template>
