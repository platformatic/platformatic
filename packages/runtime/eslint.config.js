import { globalIgnores } from 'eslint/config'
import neostandard from 'neostandard'

export default [
  ...neostandard({ ts: true }),
  globalIgnores([...neostandard.resolveIgnoresFromGitignore(), 'test/tmp/**/*', 'dist/**/*'])
]
