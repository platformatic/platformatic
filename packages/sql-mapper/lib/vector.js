export function isVectorType (sqlType) {
  return sqlType === 'vector'
}

export function serializeVector (value) {
  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }

  if (ArrayBuffer.isView(value)) {
    return JSON.stringify(Array.from(value))
  }

  return value
}

export function parseVector (value) {
  if (value === null || value === undefined || Array.isArray(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return value
  }

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
    }
  } catch {}

  return value
}
