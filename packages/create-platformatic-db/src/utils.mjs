import { execa } from 'execa'
import { request } from 'undici'
import { accessSync, existsSync, statSync, readdirSync } from 'node:fs'
import { resolve } from 'path'

export const sleep = ms => new Promise((resolve) => setTimeout(resolve, ms))
export const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)

export const isFileAccessible = filePath => {
  try {
    accessSync(filePath)
    return true
  } catch (err) {
    return false
  }
}

export const getUsername = async () => {
  const { stdout } = await execa('git', ['config', 'user.name'])
  if (stdout?.trim()) {
    return stdout.trim()
  }
  {
    const { stdout } = await execa('whoami')
    if (stdout?.trim()) {
      return stdout.trim()
    }
  }
  return null
}

export const getVersion = async () => {
  try {
    const { body, statusCode } = await request('https://registry.npmjs.org/platformatic/latest')
    if (statusCode !== 200) {
      return null
    }
    const { version } = await body.json()
    return version
  } catch (err) {
    return null
  }
}

export const validatePath = async projectPath => {
  const projectDir = resolve(process.cwd(), projectPath)
  if (existsSync(projectDir) && statSync(projectDir).isDirectory() && readdirSync(projectDir).length > 0) {
    throw Error('Please, specify an empty directory or create a new one.')
  }
  return true
}
