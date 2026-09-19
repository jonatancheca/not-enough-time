# Not Enough Time

Not Enough Time calcula la **carga de publicación** de los canales de YouTube a
los que está suscrita una cuenta y la compara con su capacidad diaria. La carga
es el tiempo que publican esos canales dentro de ventanas móviles de 24 horas,
7 días y 30 días.

La aplicación **no** consulta el historial de reproducción y no conoce qué
vídeos ha visto o tiene pendientes una persona. No es un gestor de backlog.

El proyecto se encuentra en una fase personal, limitada al responsable y a
usuarios de prueba autorizados en Google Cloud. No se presenta como un producto
público ni como una integración aprobada o auditada por Google o YouTube.

La carga de publicación, el ranking, los porcentajes por canal, las categorías
por duración, el ritmo diario y la comparación con capacidad son métricas
propias de Not Enough Time. YouTube no las proporciona, aprueba ni certifica.

## Arquitectura y lenguaje del dominio

Es una aplicación Nuxt estática desplegada en GitHub Pages. La autorización se
realiza en el navegador mediante el token model de Google Identity Services y
las peticiones REST se envían directamente a YouTube Data API. No existe un
backend de la aplicación.

- [Glosario del dominio](./CONTEXT.md)
- [ADR: integración de YouTube solo en el navegador](./docs/adr/0001-use-browser-only-youtube-integration.md)
- [Aviso de privacidad de la aplicación](https://jonatancheca.github.io/not-enough-time/privacy/)
- [Términos de uso](https://jonatancheca.github.io/not-enough-time/terms/)
- [Revisión de cumplimiento de YouTube API](./docs/compliance/youtube-api-review.md)

## Requisitos

- Node.js 22.
- pnpm 10.33.4, versión fijada en `package.json`.
- Un proyecto de Google Cloud para configurar OAuth y YouTube Data API.
- Chromium de Playwright solo para ejecutar el smoke E2E.

## Configurar Google Cloud desde cero

### 1. Crear el proyecto y activar YouTube Data API

1. Crea o selecciona un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Abre **APIs y servicios > Biblioteca**.
3. Busca **YouTube Data API v3** y actívala para el proyecto.
4. Revisa la cuota del proyecto en **APIs y servicios > YouTube Data API v3 > Cuotas**.

La aplicación usa OAuth para peticiones autenticadas. No necesita una API key
privada para leer los datos de la cuenta conectada.

### 2. Configurar Google Auth Platform

En **Google Auth Platform** del mismo proyecto:

1. Completa **Branding** con el nombre de la aplicación, correo de soporte y los
   datos que solicite Google.
2. En **Audience**, usa el estado **Testing** para esta fase personal y añade
   explícitamente cada cuenta que vaya a probar la aplicación.
3. En **Data Access**, añade solo el scope de lectura de YouTube:

   ```text
   https://www.googleapis.com/auth/youtube.readonly
   ```

4. No publiques la aplicación para una audiencia general como parte de esta
   configuración. Un lanzamiento público requiere una revisión separada de
   políticas, branding, dominio, privacidad y posible verificación.

Consulta la documentación oficial sobre [audiencia y usuarios de prueba](https://support.google.com/cloud/answer/15549945)
y el [token model de Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/use-token-model).
Testing admite como máximo 100 usuarios añadidos explícitamente. Las
autorizaciones de scopes no básicos caducan a los 7 días. Estos límites no
equivalen a una verificación para lanzamiento público.

### 3. Crear el OAuth Client ID web

1. Abre **Google Auth Platform > Clients**.
2. Crea un cliente de tipo **Web application**.
3. Añade estos **Authorized JavaScript origins**:

   ```text
   http://localhost:3000
   https://jonatancheca.github.io
   ```

   Un origen contiene protocolo, host y puerto, pero no rutas. Por eso el origen
   de GitHub Pages no incluye `/not-enough-time/`.

4. No añadas un redirect URI: esta aplicación recibe la respuesta mediante el
   callback JavaScript del token model.
5. Copia el Client ID terminado en `.apps.googleusercontent.com`.

Guía oficial: [obtener y configurar un OAuth Client ID web](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

### 4. Configurar variables

Copia `.env.example` a `.env` y asigna el Client ID:

```dotenv
NUXT_PUBLIC_GOOGLE_CLIENT_ID=1234567890-ejemplo.apps.googleusercontent.com
NUXT_PUBLIC_USE_YOUTUBE_MOCK=false
```

`NUXT_PUBLIC_GOOGLE_CLIENT_ID` es configuración pública: Nuxt la incorpora al
bundle que recibe el navegador. Un OAuth Client ID web identifica la aplicación
y no es un secreto.

Nunca guardes en `.env`, GitHub Actions, el repositorio ni el bundle:

- un OAuth client secret;
- access tokens o refresh tokens;
- una API key privada.

`NUXT_PUBLIC_USE_YOUTUBE_MOCK=true` habilita el fixture solo durante desarrollo.
Los builds de producción ignoran este modo.

## Desarrollo local

```bash
pnpm install
pnpm dev
```

Abre `http://localhost:3000`. La cuenta debe figurar como usuario de prueba del
proyecto de Google Cloud.

Comprobaciones disponibles:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm generate
pnpm test:artifact
pnpm exec playwright install chromium
pnpm test:e2e
```

- `pnpm test` ejecuta pruebas unitarias y de componentes sin cuenta Google real
  ni consumo de cuota.
- `pnpm generate` genera el sitio estático con el preset `github_pages` en
  `.output/public`.
- `pnpm test:artifact` debe ejecutarse después de generar y busca credenciales,
  tokens y fixtures prohibidos en el artefacto.
- `pnpm test:e2e` sirve el artefacto generado bajo `/not-enough-time/` y valida
  escritorio, 390 px y 320 px sin llamar a YouTube.

Para probar manualmente otro subpath, define `NUXT_APP_BASE_URL` durante la
generación. Ejemplo en PowerShell:

```powershell
$env:NUXT_APP_BASE_URL='/not-enough-time/'
pnpm generate
```

Ejemplo en bash:

```bash
NUXT_APP_BASE_URL=/not-enough-time/ pnpm generate
```

## Despliegue en GitHub Pages

1. En **Settings > Pages**, selecciona **GitHub Actions** como origen.
2. En **Settings > Secrets and variables > Actions > Variables**, crea la
   variable `NUXT_PUBLIC_GOOGLE_CLIENT_ID` solo para un despliegue de pruebas
   explícitamente restringido a test users. Usa una variable, no un secret: el
   valor termina siendo público en el frontend.
3. Ejecuta el workflow **Deploy GitHub Pages** manualmente o mediante un push a
   `master`, según `.github/workflows/deploy.yml`.

El workflow obtiene el base path desde `actions/configure-pages`, lo pasa como
`NUXT_APP_BASE_URL`, ejecuta lint, typecheck, pruebas, generación, escaneo del
artefacto y smoke E2E, y solo después publica `.output/public`.

El despliegue actual mantiene `NUXT_PUBLIC_GOOGLE_CLIENT_ID` sin configurar.
Por ello, la conexión real queda deshabilitada y la página muestra
“Configuración ausente”. No debe configurarse para una audiencia pública hasta
resolver el NO-GO documentado en la revisión de cumplimiento.

Con la configuración actual, las URLs son:

- aplicación: `https://jonatancheca.github.io/not-enough-time/`;
- privacidad: `https://jonatancheca.github.io/not-enough-time/privacy/`;
- términos: `https://jonatancheca.github.io/not-enough-time/terms/`;
- Authorized JavaScript origin: `https://jonatancheca.github.io`.

Si cambia el nombre del repositorio o se configura un dominio propio, GitHub
Pages proporciona otro base path al workflow. También deben actualizarse los
orígenes autorizados y URLs de Google Cloud cuando cambie el origen.

Un lanzamiento público requiere un dominio propio verificable. No debe
asumirse que el dominio compartido `github.io` satisface la verificación de
dominio de Google OAuth.

Guía oficial: [desplegar Nuxt en GitHub Pages](https://nuxt.com/deploy/github-pages).

## Datos locales y borrado

| Dato | Almacenamiento | Duración | Cómo se borra |
| --- | --- | --- | --- |
| Access token OAuth | Solo memoria | Hasta recarga, cierre, caducidad o desconexión | Recargar, cerrar, desconectar o borrar todos los datos |
| Reglas de contenido por canal | localStorage, por cuenta | Mientras exista consentimiento | Desconectar o “Borrar todos mis datos” |
| Capacidad diaria | localStorage, por cuenta | Mientras exista consentimiento | Desconectar o “Borrar todos mis datos” |
| Suscripciones y metadatos de publicaciones | IndexedDB, por cuenta | Frescos 1 hora; retención máxima 30 días sin renovar | Desconectar, borrar todos los datos o borrar datos del sitio desde el navegador |

La acción **Desconectar** revoca el permiso actual y borra la caché de YouTube
de la cuenta conectada. También borra las reglas por canal y la capacidad diaria
asociadas a los identificadores obtenidos mediante YouTube.

La acción **Borrar todos mis datos** elimina todas las claves de localStorage
del namespace `not-enough-time:`, borra la caché de la cuenta conectada y
desconecta YouTube. Los controles del navegador para borrar datos del sitio
eliminan cualquier almacenamiento local restante del origen.

La aplicación no guarda client secrets, API keys privadas, access tokens ni
refresh tokens. Consulta el [aviso de privacidad](https://jonatancheca.github.io/not-enough-time/privacy/)
para ver los datos consultados y los enlaces a las políticas de Google y
YouTube.

## Limitaciones deliberadas

- Sin sincronización de preferencias o caché entre dispositivos o navegadores.
- Sin refresh de datos ni autorización en segundo plano.
- Sin refresh token ni sesión OAuth persistente: una recarga o caducidad puede
  exigir una nueva autorización iniciada por la persona usuaria.
- Sin backend propio ni base de datos remota de la aplicación.
- Acceso limitado a usuarios de prueba mientras el proyecto permanezca en fase
  personal.
- Solicitud de Compliance Audit preparada, pero no enviada.
- Lanzamiento público bloqueado hasta resolver métricas derivadas, OAuth,
  dominio y branding.

## Referencias oficiales

- [YouTube Data API v3: introducción y activación](https://developers.google.com/youtube/v3/getting-started)
- [Google Identity Services: token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Google OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies)
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
- [YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service)
- [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- [Additional policies for derived metrics and data storage](https://developers.google.com/youtube/terms/derived-metrics-policy)
- [YouTube Branding Guidelines](https://developers.google.com/youtube/terms/branding-guidelines)
