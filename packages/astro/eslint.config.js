import { globalIgnores } from 'eslint/config'
import neostandard from 'neostandard'

export default [
  ...neostandard(),
  globalIgnores(['**/.astro'])
]
