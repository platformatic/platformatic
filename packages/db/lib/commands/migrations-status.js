import { loadConfiguration } from '@platformatic/foundation'
import { transform } from '../config.js'
import { getStatus } from '../migrator.js'
import { schema } from '../schema.js'

const labels = {
  applied: 'applied',
  pending: 'pending',
  'out-of-order': 'out of order',
  'missing-file': 'applied, file missing'
}

function formatStatus ({ databaseVersion, migrations }) {
  const rows = [
    ['Version', 'File', 'Status'],
    ...migrations.map(migration => [String(migration.version), migration.file ?? '', labels[migration.status]])
  ]
  const widths = [0, 1].map(column => rows.reduce((width, row) => Math.max(width, row[column].length), 0))

  return [
    `Database version: ${databaseVersion}`,
    '',
    ...rows.map(row => `${row[0].padEnd(widths[0])}  ${row[1].padEnd(widths[1])}  ${row[2]}`)
  ].join('\n')
}

export async function migrationsStatus (logger, configFile, args, context) {
  const { parseArgs, logFatalError } = context
  const config = await loadConfiguration(configFile, schema, { transform })

  const {
    values: { json }
  } = parseArgs(
    args,
    {
      json: {
        type: 'boolean',
        short: 'j'
      }
    },
    false
  )

  let status
  try {
    status = await getStatus(logger, config)
  } catch (err) {
    if (err?.code === 'PLT_DB_MIGRATE_ERROR') {
      logFatalError(logger, err.message)
      return
    }

    /* c8 ignore next 2 */
    throw err
  }

  console.log(json ? JSON.stringify(status, null, 2) : formatStatus(status))

  if (!status.upToDate) {
    process.exitCode = 1
  }
}

export const helpFooter = `
It compares the migration files with the versions recorded in the database. It
runs no migration and does not create the versions table. Each migration is reported as applied, pending, out of order
(below the database version and not recorded as applied) or applied with its
file missing.

The exit code is 1 when there are migrations to apply, by the check the \`seed\`
command makes before it loads a seed: a file above the database version, or a
migration out of order unless \`migrations.outOfOrder\` is \`ignore\`.

You can find more details about the configuration format here:
* [Platformatic DB Configuration](https://docs.platformatic.dev/docs/reference/db/configuration)
`
