<script setup lang="ts">
useSeoMeta({
  title: 'Aviso de privacidad · Not Enough Time',
  description: 'Datos que Not Enough Time consulta, conserva localmente y permite borrar.'
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
            Aviso de privacidad
          </h1>
          <p class="mt-3 text-sm text-slate-500">
            Última actualización: 19 de septiembre de 2026.
          </p>
        </header>

        <div class="space-y-8 pt-6 leading-7">
          <section aria-labelledby="privacy-scope">
            <h2 id="privacy-scope" class="text-xl font-semibold text-slate-950">
              Alcance
            </h2>
            <p class="mt-3">
              Not Enough Time es una aplicación personal, disponible solo para su responsable y
              usuarios de prueba autorizados. Mide la carga de publicación de los canales suscritos;
              no consulta el historial de reproducción ni afirma conocer vídeos pendientes de ver.
              Este aviso no supone que Google o YouTube hayan aprobado un lanzamiento público ni
              certificado el cumplimiento de sus políticas.
            </p>
            <p class="mt-3">
              Su uso también está sujeto a los
              <NuxtLink
                to="/terms/"
                class="inline-flex min-h-6 items-center py-1 font-semibold text-red-700 underline underline-offset-4"
              >términos de uso de Not Enough Time</NuxtLink>.
            </p>
          </section>

          <section aria-labelledby="privacy-derived-metrics">
            <h2 id="privacy-derived-metrics" class="text-xl font-semibold text-slate-950">
              Métricas propias
            </h2>
            <p class="mt-3">
              Carga de publicación, ranking, porcentajes por canal, categorías por duración,
              ritmo diario y comparación con capacidad son cálculos de Not Enough Time. YouTube
              no proporciona, aprueba ni certifica esas métricas. La aplicación no se abrirá al
              público mientras su revisión de políticas siga pendiente.
            </p>
          </section>

          <section aria-labelledby="privacy-access">
            <h2 id="privacy-access" class="text-xl font-semibold text-slate-950">
              Acceso a Google y YouTube
            </h2>
            <p class="mt-3">
              La conexión solicita únicamente el permiso de solo lectura
              <code class="break-all rounded bg-slate-100 px-1 py-0.5 text-sm">https://www.googleapis.com/auth/youtube.readonly</code>.
              El navegador usa Google Identity Services para obtener un access token temporal y
              llama directamente a YouTube Data API. La aplicación no tiene backend propio.
            </p>
            <p class="mt-3">
              Se consultan el identificador del canal asociado a la cuenta, sus suscripciones y
              metadatos de publicaciones necesarios para calcular la carga: identificadores,
              títulos, canales, miniaturas, fechas, duraciones y estado de emisiones en directo.
              No se solicita acceso de escritura.
            </p>
            <p class="mt-3">
              El access token existe solo en memoria. No se guarda en localStorage, IndexedDB ni
              GitHub Pages y desaparece al recargar, desconectar o cerrar la pestaña. La aplicación
              no usa client secret, refresh token ni una API key privada.
            </p>
          </section>

          <section aria-labelledby="privacy-storage">
            <h2 id="privacy-storage" class="text-xl font-semibold text-slate-950">
              Datos guardados en este navegador
            </h2>
            <div
              class="mt-4 overflow-x-auto rounded-sm"
              role="region"
              aria-label="Resumen de datos guardados"
              tabindex="0"
            >
              <table class="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr class="border-b border-slate-300 text-slate-950">
                    <th class="px-3 py-3 font-semibold">Dato</th>
                    <th class="px-3 py-3 font-semibold">Ubicación y duración</th>
                    <th class="px-3 py-3 font-semibold">Borrado</th>
                  </tr>
                </thead>
                <tbody class="align-top">
                  <tr class="border-b border-slate-200">
                    <td class="px-3 py-3">Reglas por canal y capacidad diaria, asociadas a la cuenta</td>
                    <td class="px-3 py-3">localStorage; mientras se mantenga el consentimiento</td>
                    <td class="px-3 py-3">Desconectar o “Borrar todos mis datos”</td>
                  </tr>
                  <tr class="border-b border-slate-200">
                    <td class="px-3 py-3">Instantánea de suscripciones y publicaciones</td>
                    <td class="px-3 py-3">
                      IndexedDB; fresca durante 1 hora y eliminada al alcanzar 30 días sin renovar
                    </td>
                    <td class="px-3 py-3">Desconectar o “Borrar todos mis datos”</td>
                  </tr>
                  <tr>
                    <td class="px-3 py-3">Access token de Google</td>
                    <td class="px-3 py-3">Memoria de la pestaña; nunca almacenamiento persistente</td>
                    <td class="px-3 py-3">Recargar, cerrar, desconectar o borrar todos los datos</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="mt-4">
              Los datos permanecen en el dispositivo y perfil de navegador donde se usó la
              aplicación. Google y YouTube procesan las solicitudes conforme a sus propias
              condiciones y políticas.
            </p>
          </section>

          <section aria-labelledby="privacy-controls">
            <h2 id="privacy-controls" class="text-xl font-semibold text-slate-950">
              Controles de borrado
            </h2>
            <ul class="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Desconectar</strong> revoca el permiso actual, elimina la caché de YouTube
                y borra las reglas y capacidad asociadas a la cuenta conectada.
              </li>
              <li>
                <strong>Borrar todos mis datos</strong> elimina las claves del namespace
                <code class="rounded bg-slate-100 px-1 py-0.5 text-sm">not-enough-time:</code>,
                borra la caché de la cuenta conectada y desconecta YouTube.
              </li>
              <li>
                Los controles del navegador para borrar los datos del sitio eliminan cualquier
                almacenamiento local restante de este origen.
              </li>
              <li>
                También puedes retirar el acceso desde la
                <a
                  href="https://security.google.com/settings/security/permissions"
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex min-h-6 max-w-full flex-wrap items-center py-1 font-semibold text-red-700 underline underline-offset-4"
                >configuración de seguridad de Google<span class="sr-only"> (se abre en una pestaña nueva)</span></a>.
                La aplicación elimina los datos vinculados cuando detecta la revocación.
              </li>
            </ul>
          </section>

          <section aria-labelledby="privacy-limits">
            <h2 id="privacy-limits" class="text-xl font-semibold text-slate-950">
              Limitaciones
            </h2>
            <p class="mt-3">
              No existe sincronización entre dispositivos, autorización persistente ni
              actualización en segundo plano. Cada navegador conserva su propia configuración y
              Google puede exigir una nueva autorización cuando el token caduque o se recargue la
              aplicación.
            </p>
          </section>

          <section aria-labelledby="privacy-contact">
            <h2 id="privacy-contact" class="text-xl font-semibold text-slate-950">
              Contacto y referencias
            </h2>
            <p class="mt-3">
              Para dudas o solicitudes sobre este proyecto, abre una incidencia en el
              <a
                href="https://github.com/jonatancheca/not-enough-time/issues"
                target="_blank"
                rel="noreferrer"
                class="inline-flex min-h-6 max-w-full flex-wrap items-center py-1 font-semibold text-red-700 underline underline-offset-4"
              >repositorio de Not Enough Time<span class="sr-only"> (se abre en una pestaña nueva)</span></a>.
            </p>
            <ul class="mt-3 list-disc space-y-2 pl-6">
              <li>
                <NuxtLink
                  to="/terms/"
                  class="inline-flex min-h-6 max-w-full flex-wrap items-center py-1 font-semibold text-red-700 underline underline-offset-4"
                >Términos de uso de Not Enough Time</NuxtLink>
              </li>
              <li>
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex min-h-6 max-w-full flex-wrap items-center py-1 font-semibold text-red-700 underline underline-offset-4"
                >Política de privacidad de Google<span class="sr-only"> (se abre en una pestaña nueva)</span></a>
              </li>
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
            </ul>
          </section>
        </div>
      </article>
    </main>
  </div>
</template>
