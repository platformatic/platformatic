import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default {
  logo: {
    type: 'image/svg+xml',
    content: await readFile(join(__dirname, 'static', 'logo.svg'))
  },
  theme: {
    css: [{
      filename: 'theme.css',
      content: await readFile(join(__dirname, 'static', 'theme.css'), 'utf8')
    }],
    favicon: [{
      filename: 'favicon.png',
      rel: 'icon',
      sizes: '16x16',
      type: 'image/x-icon',
      content: await readFile(join(__dirname, 'static', './favicon.ico'))
    }]
  }
}
