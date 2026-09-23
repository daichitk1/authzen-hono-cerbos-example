import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'

const root = process.cwd()

const collectMarkdownFiles = (directory) => {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(absolutePath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(absolutePath)
    }
  }

  return files
}

const markdownFiles = [
  resolve(root, 'README.md'),
  ...collectMarkdownFiles(resolve(root, 'docs')),
]

const failures = []
const markdownDestination = /!?\[[^\]]*\]\(([^)]+)\)/g

for (const markdownFile of markdownFiles) {
  const source = readFileSync(markdownFile, 'utf8')

  for (const match of source.matchAll(markdownDestination)) {
    let destination = match[1]?.trim()

    if (!destination) {
      continue
    }

    if (destination.startsWith('<') && destination.endsWith('>')) {
      destination = destination.slice(1, -1)
    }

    destination = destination.split(/\s+/u)[0] ?? destination

    if (/^(https?:|mailto:|#)/u.test(destination)) {
      continue
    }

    const [pathPart] = destination.split('#')
    if (!pathPart) {
      continue
    }

    const decodedPath = decodeURIComponent(pathPart)
    const target = resolve(dirname(markdownFile), decodedPath)

    if (!existsSync(target)) {
      failures.push(
        `${relative(root, markdownFile)} -> missing relative target: ${decodedPath}`,
      )
    }
  }
}

if (failures.length > 0) {
  process.stderr.write('Documentation link check failed:\n')
  for (const failure of failures) {
    process.stderr.write(`- ${failure}\n`)
  }
  process.exitCode = 1
} else {
  process.stdout.write(
    `Documentation link check passed for ${markdownFiles.length} Markdown files.\n`,
  )
}
