import loadConfig from './load-config.mjs'
import { tsCompiler } from '@platformatic/service'

const compile = tsCompiler.buildCompileCmd(loadConfig)
const compileWatch = tsCompiler.compileWatch

export {
  compile,
  compileWatch
}
