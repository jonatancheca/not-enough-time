import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'

const artifactRoot = resolve(process.cwd(), '.output/public')
const basePath = normalizeBasePath(process.env.PAGES_BASE_PATH ?? '/not-enough-time/')
const port = Number.parseInt(process.env.PORT ?? '4173', 10)
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp'
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    const decodedPath = decodeURIComponent(requestUrl.pathname)

    if (!decodedPath.startsWith(basePath)) {
      send(response, 404, 'Not found')
      return
    }

    const relativePath = decodedPath.slice(basePath.length) || 'index.html'
    const requestedFile = resolve(artifactRoot, relativePath)

    if (requestedFile !== artifactRoot && !requestedFile.startsWith(`${artifactRoot}${sep}`)) {
      send(response, 403, 'Forbidden')
      return
    }

    const file = await resolveFile(requestedFile)

    if (!file) {
      send(response, 404, 'Not found')
      return
    }

    response.statusCode = 200
    response.setHeader('Content-Type', mimeTypes[extname(file)] ?? 'application/octet-stream')

    if (request.method === 'HEAD') {
      response.end()
      return
    }

    createReadStream(file).pipe(response)
  } catch (error) {
    send(response, 500, error instanceof Error ? error.message : 'Server error')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Pages artifact: http://127.0.0.1:${port}${basePath}`)
})

function normalizeBasePath(value) {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

async function resolveFile(path) {
  try {
    const metadata = await stat(path)
    return metadata.isDirectory() ? resolve(path, 'index.html') : path
  } catch {
    return null
  }
}

function send(response, status, body) {
  response.statusCode = status
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.end(body)
}
