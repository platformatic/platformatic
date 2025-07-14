import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export default {
  theme: await readFile(join(import.meta.dirname, 'static', 'theme.css'), 'utf8')
}
