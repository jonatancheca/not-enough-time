import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const artifactRoot = resolve(process.cwd(), '.output/public')
const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.svg',
  '.txt',
  '.webmanifest',
  '.xml'
])
const forbiddenPatterns = [
  ['Google OAuth client secret', /\bGOCSPX-[A-Za-z0-9_-]{16,}\b/],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{30,}\b/],
  ['Google access token', /\bya29\.[A-Za-z0-9_-]{20,}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['private key', /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/],
  ['configured client secret', /client_secret\s*[:=]\s*["'][^"']+["']/i],
  ['configured refresh token', /refresh_token\s*[:=]\s*["'][^"']+["']/i],
  ['development YouTube fixture', /dev-cache-2026/]
]

const findings = []
const files = await listFiles(artifactRoot)

for (const file of files) {
  const extension = file.slice(file.lastIndexOf('.'))

  if (!textExtensions.has(extension)) {
    continue
  }

  const content = await readFile(file, 'utf8')

  for (const [label, pattern] of forbiddenPatterns) {
    if (pattern.test(content)) {
      findings.push(`${label}: ${file.slice(artifactRoot.length + 1)}`)
    }
  }
}

if (findings.length > 0) {
  throw new Error(`El artefacto contiene datos prohibidos:\n${findings.join('\n')}`)
}

console.log(`Artefacto limpio: ${files.length} archivos revisados.`)

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  }))

  return nested.flat()
}
