import neostandard from 'neostandard'

export default neostandard({
  ts: true,
  ignores: [
    ...neostandard.resolveIgnoresFromGitignore(),
    'test/tmp/**/*',
    'test/fixtures/*/dist/**/*',
    '**/dist/*',
    'tmp/**/*'
  ]
})
