import neostandard from 'neostandard'

export default neostandard({
  ts: true,
  ignores: [
    ...neostandard.resolveIgnoresFromGitignore(),
    'src/platformatic-generated-code/**/*',
  ],
})
