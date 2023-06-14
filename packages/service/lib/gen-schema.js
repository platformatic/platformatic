'use strict'

const { writeFile } = require('fs/promises')
const { schema: platformaticServiceSchema } = require('./schema.js')

const filenameConfigJsonSchema = 'platformatic.service.schema.json'

async function generateJsonSchemaConfig () {
  await writeFile(filenameConfigJsonSchema, JSON.stringify(platformaticServiceSchema, null, 2))
}

module.exports = {
  generateJsonSchemaConfig,
  filenameConfigJsonSchema
}
