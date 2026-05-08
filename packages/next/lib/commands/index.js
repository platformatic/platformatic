import { packCommand, helpFooter as packHelpFooter } from './pack.js'

export function createCommands (id) {
  return {
    commands: {
      [`${id}:pack`]: packCommand
    },
    help: {
      [`${id}:pack`]: {
        usage: `${id}:pack`,
        description: 'Create a self-contained standalone bundle for a Next.js application',
        footer: packHelpFooter,
        options: [
          {
            usage: '-o, --output <path>',
            description: 'Output directory for the packed bundle'
          },
          {
            usage: '--no-build',
            description: 'Fail if the standalone build output is missing instead of building it first'
          }
        ]
      }
    }
  }
}
