import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const root = process.cwd()
const skippedDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.vitepress',
])
const publishedDocuments = new Set([
  'docs/.vitepress/config.mts',
  'docs/api/frontend-api.md',
  'docs/design.md',
  'docs/evidence/README.md',
  'docs/index.md',
  'docs/learning/README.md',
  'docs/learning/repository-learning-guide.md',
  'docs/requirements.md',
  'docs/security/boundaries.md',
])
const errors = []

const visit = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name)
    const path = relative(root, fullPath).replaceAll('\\', '/')

    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name) || path === 'docs/.vitepress')
        visit(fullPath)
      continue
    }

    if (
      path.startsWith('docs/') &&
      /\.(?:md|mts)$/u.test(path) &&
      !publishedDocuments.has(path)
    )
      errors.push(`Unexpected document: ${path}`)
    if (!/\.(?:md|ts|tsx|js|mjs|mts|json|jsonc|yaml|yml)$/u.test(path)) continue

    const content = readFileSync(fullPath, 'utf8')
    if (/\b(?:PR|Issue)\s+#\d+\b|\bCI run\s+\d+\b/iu.test(content))
      errors.push(`Development record: ${path}`)
  }
}

visit(root)

if (errors.length) {
  process.stderr.write(`${errors.join('\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write('Public content check passed.\n')
}
