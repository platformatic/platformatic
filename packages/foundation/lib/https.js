import { readFile } from 'node:fs/promises'

export async function sanitizeHTTPSArgument (arg) {
  if (typeof arg === 'string') {
    return arg
  } else if (!Array.isArray(arg)) {
    return readFile(arg.path)
  }

  const sanitized = []
  for (const item of arg) {
    sanitized.push(typeof item === 'string' ? item : await readFile(item.path))
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
    cert: await sanitizeHTTPSArgument(https.cert)
  }
}
