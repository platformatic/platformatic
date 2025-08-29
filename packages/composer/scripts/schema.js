#! /usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const gatewaySchema = JSON.parse(await readFile(resolve(import.meta.dirname, '../../gateway/schema.json'), 'utf8'))
gatewaySchema.$id = gatewaySchema.$id.replace('@platformatic/gateway', '@platformatic/composer')
gatewaySchema.title = gatewaySchema.title.replace('Platformatic Gateway', 'Platformatic Composer')
gatewaySchema.properties.composer = gatewaySchema.properties.gateway
delete gatewaySchema.properties.gateway

await writeFile(resolve(import.meta.dirname, '../schema.json'), JSON.stringify(gatewaySchema, null, 2), 'utf8')
