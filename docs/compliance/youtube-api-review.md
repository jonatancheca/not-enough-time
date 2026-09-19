# Revisión de cumplimiento de YouTube API

**Fecha de revisión:** 19 de septiembre de 2026

**Estado del producto:** uso personal y usuarios de prueba conocidos

**Decisión:** GO condicionado para uso personal; NO-GO para lanzamiento público

**Solicitud de Compliance Audit:** preparada, no enviada

## Alcance y límite de esta revisión

Esta revisión contrasta las funciones de Not Enough Time con las políticas
oficiales vigentes de YouTube API Services y Google OAuth. No constituye una
aprobación de Google o YouTube. Las dudas de interpretación están preparadas
para el formulario oficial de Analytics & Reporting, pero todavía no se han
enviado.

La aplicación no debe abrirse a usuarios desconocidos hasta recibir una
respuesta favorable sobre las métricas derivadas, completar la verificación
OAuth aplicable y usar un dominio público verificable.

## Fuentes oficiales

- [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- [Complying with YouTube's Developer Policies](https://developers.google.com/youtube/terms/developer-policies-guide)
- [Additional policies for derived metrics and data storage](https://developers.google.com/youtube/terms/derived-metrics-policy)
- [YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service)
- [YouTube API Services Branding Guidelines](https://developers.google.com/youtube/terms/branding-guidelines)
- [Audit and Quota Extension Form](https://support.google.com/youtube/contact/yt_api_form)
- [Quota and Compliance Audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- [YouTube Data API Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [Google OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies)
- [Google OAuth verification requirements](https://support.google.com/cloud/answer/13464321)
- [Google OAuth production compliance](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance)
- [When OAuth verification is not needed](https://support.google.com/cloud/answer/13464323)
- [Manage App Audience](https://support.google.com/cloud/answer/15549945)
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)

## Matriz de datos y métricas

| Dato o métrica | Origen y cálculo | Política relevante | Dictamen preliminar |
| --- | --- | --- | --- |
| Lista de suscripciones | `subscriptions.list(mine=true)` con OAuth | Es Authorized Data. Solo debe mostrarse al usuario autorizante o a sus representantes aprobados. | Permitido con consentimiento, privacidad, seguridad y borrado. |
| Identificador de la cuenta | ID del canal obtenido mediante una petición autorizada | Se usa para aislar caché y preferencias. Debe eliminarse al retirar el consentimiento. | Permitido mientras exista consentimiento activo. |
| Canal, título, miniatura, fecha, duración y URL | `channels.list`, `playlistItems.list` y `videos.list` | Son API Data. Deben permanecer actualizados, atribuidos y sin alterar. Los metadatos deben refrescarse o borrarse antes de 30 días. | Permitido con retención, atribución y enlaces correctos. |
| Estado de directo | `liveStreamingDetails` | Es un campo proporcionado por YouTube. | Permitido como dato de origen YouTube. |
| Categorías “corto” y “largo” | Clasificación propia: menos de 5 minutos o 5 minutos y más | La política base restringe inferir tipos de contenido. La política adicional contempla categorización propia para casos aprobados. | Requiere confirmación y permiso; debe etiquetarse como clasificación propia. |
| Carga de 24 horas, 7 días y 30 días | Suma de duraciones de vídeos publicados por canales de distintos propietarios | III.E.2.a prohíbe agregar API Data de distintos content owners. El formulario Analytics & Reporting puede enmendar III.E.2.a para casos aceptados. | Requiere Compliance Audit y aceptación expresa antes de uso público. |
| Total mensual por canal | Suma de duración de publicaciones de cada canal, mostrada al suscriptor | Es una agregación mostrada a alguien distinto del content owner. | Requiere permiso para el caso Analytics & Reporting. |
| Ranking por canal | Orden descendente por duración mensual calculada | Es un leaderboard basado en una métrica derivada. Las políticas adicionales lo contemplan para casos aprobados. | Requiere permiso y etiqueta clara de métrica propia. |
| Porcentaje mensual por canal | Duración del canal dividida por duración total | Es un custom channel ratio. | Requiere permiso y etiqueta clara de métrica propia. |
| Ritmo diario requerido | Carga de 30 días dividida entre 30 | La guía admite aritmética simple, pero el cálculo parte de agregación entre propietarios y crea una métrica propia. | Tratar como métrica sujeta a Compliance Audit. |
| Duración media | Duración total dividida entre número de vídeos | La guía incluye “average video duration” como ejemplo simple, pero persiste la duda de agregación entre propietarios. | Solicitar confirmación en el audit. |
| Capacidad diaria | Minutos introducidos directamente por el usuario | Es información propia del usuario, no API Data. | Permitida si se distingue de YouTube. |
| Diferencia y porcentaje capacidad/ritmo | Combina capacidad introducida por usuario con ritmo derivado de API Data | La guía indica que las métricas simples aceptables deben usar solo API Data y no fuentes externas. | Riesgo alto; necesita respuesta expresa. |
| Exclusiones por canal y categoría | Preferencias explícitas del usuario aplicadas al cálculo | El usuario conoce y controla el filtro, pero el resultado sigue siendo una métrica derivada. | Preferencia permitida; resultado condicionado por aprobación de métricas. |
| Fecha de sincronización y estados de error | Estado operativo generado por la aplicación | No procede de YouTube. | Permitido si se presenta como información propia. |

### Interpretación conservadora

La guía de cumplimiento enumera cálculos simples aceptables, pero indica que no
sustituye las Developer Policies. La política general prohíbe la agregación
entre content owners y las métricas derivadas. Desde el 1 de junio de 2026, la
política adicional permite solicitar una enmienda para casos auditados de
Analytics & Reporting. Por ello, Not Enough Time no considera la aritmética
simple suficiente para autorizar su lanzamiento público.

## Retención, revocación y borrado

| Clase de dato | Implementación y límite | Dictamen |
| --- | --- | --- |
| Access token | Solo en memoria; desaparece al recargar o cerrar. Se revoca al desconectar. | Cumple el diseño de mínima persistencia. |
| Caché de suscripciones y vídeos | IndexedDB; TTL de 1 hora; purga física al alcanzar 30 días sin refrescar. | Cumple el máximo general de 30 días. |
| Datos mostrados | La sincronización actualiza caché y fecha de generación. | Deben seguir mostrando la versión más reciente disponible. |
| Reglas y capacidad asociadas a cuenta/canal | localStorage mientras exista consentimiento. | Se borran al completar la revocación para no retener IDs de cuenta o canal obtenidos mediante la API. |
| Desconexión | Revocación programática; después se eliminan caché, reglas, capacidad y datos de sesión de la cuenta. | Cumple de forma conservadora el borrado de Authorized Data. |
| Revocación detectada desde Google | Error de permiso dispara borrado de caché y datos locales vinculados a la cuenta. | Evita conservar datos después de detectar retirada de autorización. |
| Borrar todos mis datos | Elimina el namespace local de la aplicación, caché y autorización. | Proporciona mecanismo visible de borrado. |

Los datos permanecen en el navegador, pero el almacenamiento local sigue
sujeto a las políticas. El carácter frontend-only no elimina obligaciones de
retención, revocación o borrado.

## OAuth, audiencia y dominio

La fase actual debe usar Google Auth Platform en estado **Testing** y permitir
solo cuentas añadidas explícitamente como test users. La aplicación solicita
únicamente `https://www.googleapis.com/auth/youtube.readonly` y mantiene el
token en memoria.

La aplicación exige aceptación explícita del aviso de privacidad y de los
términos antes de iniciar OAuth. Sin `NUXT_PUBLIC_GOOGLE_CLIENT_ID`, el botón de
conexión permanece deshabilitado. La configuración actual no habilita acceso
público.

Antes de un lanzamiento público deben completarse, como mínimo:

1. Proyecto Google Cloud de producción separado de desarrollo y testing.
2. Homepage pública que describa la aplicación y no requiera login.
3. Dominio propio verificable para homepage, privacidad, términos y orígenes.
4. Privacy Policy y Terms accesibles desde la aplicación y desde OAuth consent.
5. Verificación de marca y del scope que indique Google Cloud Console.
6. Justificación del scope mínimo y vídeo de demostración del flujo completo.
7. Contactos de soporte y del proyecto actualizados.
8. Aprobación de Analytics & Reporting para las métricas de esta matriz.

El dominio compartido `github.io` no debe asumirse como suficiente para una
verificación pública. La guía OAuth recomienda mapear los servicios alojados en
dominios compartidos a un dominio propio verificable.

Google permite uso personal por menos de 100 personas conocidas sin completar
la verificación pública, sujeto a advertencias y límites. En estado Testing,
solo los test users autorizados pueden acceder, con un máximo de 100. Esta
excepción no convierte la aplicación en un producto público verificado.

## Privacidad y términos

La interfaz y la documentación deben mantener visibles estos puntos:

- la aplicación usa YouTube API Services;
- el historial de reproducción no se consulta;
- el token no se guarda de forma persistente;
- la caché y los datos vinculados se borran al retirar consentimiento;
- el usuario puede revocar acceso desde la aplicación y desde su cuenta Google;
- la privacidad enlaza la Política de privacidad de Google;
- los términos enlazan los Términos del Servicio de YouTube y declaran que el
  uso de las funciones de YouTube queda sujeto a ellos;
- las métricas calculadas por Not Enough Time no son proporcionadas, aprobadas
  ni certificadas por YouTube.

## Branding y atribución

Toda pantalla que muestre contenido de YouTube debe atribuir claramente su
origen. La aplicación usa una atribución textual clicable hacia YouTube y
enlaces directos en vídeos y canales. No inventa, redibuja ni modifica un logo
oficial.

Si posteriormente se incorpora el logo “Developed with YouTube”, debe usarse el
activo oficial, ser clicable, mantener proporciones, colores, contraste y tamaño
mínimo, y no convertirse en el elemento más prominente de la página.

El nombre “Not Enough Time” no incorpora “YouTube”, “YT” ni una variante de la
marca.

## Cuota

El cliente evita `search.list`. Los métodos previstos `subscriptions.list`,
`channels.list`, `playlistItems.list` y `videos.list` cuestan 1 unidad por
petición o página según el calculador vigente. El proyecto dispone por defecto
de 10.000 unidades diarias para esos endpoints.

La fase personal probablemente no necesita una ampliación. Esto no elimina la
necesidad del Compliance Audit para solicitar la enmienda de métricas derivadas.
El formulario permite mantener la cuota predeterminada y solicitar el permiso
de Analytics & Reporting.

## Preguntas preparadas para Analytics & Reporting

**Estado: no enviadas.** Deben remitirse mediante el formulario oficial antes
de cualquier lanzamiento público.

1. “May an API Client, visible only to the authorizing subscriber, sum `contentDetails.duration` for public uploads published during rolling 24-hour, 7-day, and 30-day windows across all channels in that user’s subscription list, when those channels have different content owners?”

2. “Does acceptance of the Additional Policies for Derived Metrics amend section III.E.2.a sufficiently to allow this cross-content-owner aggregation for the authorizing subscriber?”

3. “May the API Client display: (a) each channel’s total published duration during 30 days, (b) a ranking ordered by that duration, (c) each channel’s percentage of the total duration, (d) the total duration divided by 30 as a required daily pace, and (e) average video duration?”

4. “May the API Client compare the API-derived required daily pace with a daily viewing-capacity value manually entered by the user and display the difference and percentage? Does this constitute combining API Data with another data source?”

5. “May the API Client classify completed non-live videos into app-defined duration bands of less than five minutes and five minutes or longer, while classifying live broadcasts only from `liveStreamingDetails`, if those labels are clearly identified as app-defined and not YouTube categories?”

6. “After OAuth revocation or in-app disconnection, may local preferences survive if they contain only user selections keyed by YouTube account and channel IDs, while all tokens and cached API metadata are deleted immediately? Are those identifiers Authorized Data that must also be deleted?”

7. “Is approval through the Analytics and Reporting section required for these features even when the Client remains within the default quota and requests no quota increase?”

8. “For a single-page dashboard entirely dependent on YouTube API Data, is one clickable ‘Developed with YouTube’ logo adjacent to the dashboard sufficient attribution when every displayed video and channel also links directly to YouTube?”

9. “Does a one-hour local cache with a hard 30-day refresh-or-delete limit comply when the cache is also deleted immediately on in-app disconnection?”

## Decisión de lanzamiento

### GO condicionado

- Uso personal por el responsable.
- Usuarios conocidos incluidos como test users en Google Cloud.
- OAuth Client ID configurado solo en entornos de prueba autorizados.
- Avisos, términos, consentimiento, retención y borrado descritos en este documento.

### NO-GO

- Usuarios desconocidos o audiencia general.
- Publicación del OAuth consent screen como producto público.
- Cualquier afirmación de aprobación, certificación o auditoría superada.
- Uso público de carga agregada, ranking, porcentajes, ritmo, capacidad comparada
  o categorías propias sin respuesta favorable de YouTube.

Si YouTube no acepta el caso, el producto deberá permanecer personal o retirar
las métricas y agregaciones afectadas antes de reconsiderar un lanzamiento.
