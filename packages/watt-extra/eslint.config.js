import neostandard from 'neostandard'

export default neostandard({
  ignores: [
    ...neostandard.resolveIgnoresFromGitignore(),
    'clients/**/*',
    'test/fixtures/**/*',
    'test/tmp/**/*',
    'node_modules/**/*'
  ]
})
