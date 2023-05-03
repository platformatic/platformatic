import { buildServer } from '../index.js'
import { generateConfigManagerConfig, loadConfig } from './load-config.mjs'
import { buildStart } from '@platformatic/service'

export const start = await buildStart(loadConfig, buildServer, generateConfigManagerConfig())
