'use strict'

const { parseArgs } = require('node:util')
const { table, getBorderCharacters } = require('table')
const errors = require('./errors')
const {
  getRuntimeByPID,
  getRuntimeByPackageName,
  getRuntimeServices
} = require('./runtime-api')

const tableColumns = [
  {
    value: 'id',
    alias: 'NAME'
  },
  {
    value: 'type',
    alias: 'TYPE'
  },
  {
    value: 'entrypoint',
    alias: 'ENTRYPOINT',
    formatter: (entrypoint) => {
      return entrypoint ? 'yes' : 'no'
    }
  }
]

const tableConfig = {
  border: getBorderCharacters('void'),
  columnDefault: {
    paddingLeft: 1,
    paddingRight: 1
  },
  drawHorizontalLine: () => false
}

async function printRuntimeServices (services) {
  const raws = [tableColumns.map(column => column.alias)]

  for (const service of services.services) {
    const raw = []
    for (const column of tableColumns) {
      let value = service[column.value]
      if (column.formatter) {
        value = column.formatter(value)
      }
      value ??= '-----'
      raw.push(value)
    }
    raws.push(raw)
  }

  const servicesTable = table(raws, tableConfig)
  console.log(servicesTable)
}

async function getRuntimeServicesCommand (argv) {
  const args = parseArgs({
    args: argv,
    options: {
      pid: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' }
    },
    strict: false
  }).values

  let runtime = null
  if (args.pid) {
    runtime = await getRuntimeByPID(parseInt(args.pid))
  } else if (args.name) {
    runtime = await getRuntimeByPackageName(args.name)
  } else {
    throw errors.MissingRuntimeIdentifier()
  }

  if (!runtime) {
    throw errors.RuntimeNotFound()
  }

  const runtimeServices = await getRuntimeServices(runtime.pid)
  printRuntimeServices(runtimeServices)
}

module.exports = getRuntimeServicesCommand
