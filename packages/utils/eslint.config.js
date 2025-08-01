import neostandard from 'neostandard'

const noInternalPackages = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow internal dependencies in package.json', category: 'Best Practices' }
  },
  create (context) {
    return {
      Program (node) {
        const json = JSON.parse(
          context
            .getSourceCode()
            .getText()
            .replace(/^export default /, '')
        )

        for (const section of ['dependencies', 'devDependencies']) {
          const deps = Object.keys(json[section])

          let pkg

          if (deps.includes('platformatic')) {
            pkg = 'platformatic'
          } else if (deps.includes('wattpm')) {
            pkg = 'wattpm'
          } else {
            pkg = deps.find(d => d.startsWith('@platformatic/'))
          }

          if (pkg) {
            context.report({ node, message: `@platformatic/utils cannot depend on ${pkg} (${section})` })
          }
        }
      }
    }
  }
}

export default [
  ...neostandard({}),
  {
    files: ['./package.json'],
    processor: {
      preprocess (text) {
        // Make it parse as Javascript
        return [`export default ${text}`]
      },
      postprocess (messages) {
        return messages[0].filter(m => m.ruleId === 'custom/no-internal-packages')
      }
    },
    plugins: {
      custom: {
        rules: {
          'no-internal-packages': noInternalPackages
        }
      }
    },
    rules: {
      'custom/no-internal-packages': ['error']
    }
  }
]
