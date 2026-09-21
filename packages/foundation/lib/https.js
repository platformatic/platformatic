import { readFile } from 'node:fs/promises'

export async function sanitizeHTTPSArgument (arg, returnPath = false) {
  if (typeof arg === 'string') {
    return arg
  } else if (!Array.isArray(arg)) {
    return returnPath ? arg.path : readFile(arg.path)
  }

  const sanitized = []
  for (const item of arg) {
    sanitized.push(await sanitizeHTTPSArgument(item, returnPath))
  }

  return sanitized
}

export async function sanitizeHTTPSOptions (https) {
  if (!https) {
    return
  }

  return {
    ...https,
    key: await sanitizeHTTPSArgument(https.key),
    cert: await sanitizeHTTPSArgument(https.cert),
  }
}
