'use strict'
import jsonpointer from 'jsonpointer'

export function getType (typeDef, methodType, spec) {
  if (typeDef.$ref) {
    typeDef = jsonpointer.get(spec, typeDef.$ref.replace('#', ''))
  }
  if (typeDef.schema) {
    return getType(typeDef.schema, methodType, spec)
  }
  if (typeDef.anyOf) {
    // recursively call this function
    const mapped = typeDef.anyOf.map((t) => {
      return getType(t, methodType, spec)
    })
    return mapped.join(' | ')
  }

  if (typeDef.oneOf) {
    // recursively call this function
    const mapped = typeDef.oneOf.map((t) => {
      return getType(t, methodType, spec)
    })

    if (typeDef.discriminator && typeDef.discriminator.propertyName) {
      const propertyName = typeDef.discriminator.propertyName
      // we do such conversion
      // from "{ 'type': string; 'meowSound': string }",
      // to   "{ 'type': 'Cat'; 'meowSound': string }",
      // where typeDef.discriminator.propertyName = 'type'

      // we support only an array of $ref values
      const mappedRefNames = typeDef.oneOf.map((t) => {
        return t.$ref.split('/').slice(-1).toString()
      })
      return mapped.map((mappedObject, idx) => {
        const regexp = new RegExp(`'${propertyName}'[?]?: (string)`)

        const match = mappedObject.match(regexp)
        if (match) {
          const firstPart = mappedObject.substring(0, match.index)
          const l = match[0].length
          const secondPart = mappedObject.substring(match.index + l)
          const output = firstPart + match[0].replace('string', `'${mappedRefNames[idx]}'`) + secondPart
          return output
        }
        // otherwise we return the object as is
        return mappedObject
      }).join(' | ')
    }
    return mapped.join(' | ')
  }

  if (typeDef.allOf) {
    // recursively call this function
    return typeDef.allOf.map((t) => {
      return getType(t, methodType, spec)
    }).join(' & ')
  }
  if (typeDef.type === 'array') {
    return `Array<${getType(typeDef.items, methodType, spec)}>`
  }
  if (typeDef.enum) {
    return typeDef.enum.map((en) => {
      if (typeDef.type === 'string') {
        return `'${en.replace(/'/g, "\\'")}'`
      } else {
        return en
      }
    }).join(' | ')
  }
  if (typeDef.type === 'object') {
    if (!typeDef.properties || Object.keys(typeDef.properties).length === 0) {
      // Object without properties
      return 'object'
    }
    let output = '{ '
    // TODO: add a test for objects without properties
    /* c8 ignore next 1 */
    const props = Object.keys(typeDef.properties || {}).map((prop) => {
      let required = false
      if (typeDef.required) {
        required = !!typeDef.required.includes(prop)
      }
      return `'${prop}'${required ? '' : '?'}: ${getType(typeDef.properties[prop], methodType, spec)}`
    })
    output += props.join('; ')
    output += ' }'
    return output
  }
  return JSONSchemaToTsType(typeDef, methodType)
}

function JSONSchemaToTsType ({ type, format, nullable }, methodType) {
  const isDateType = format === 'date' || format === 'date-time'
  let resultType = 'unknown'

  switch (type) {
    case 'string':
      resultType = isDateType && methodType === 'req' ? 'string | Date' : 'string'
      break
    case 'integer':
      resultType = 'number'
      break
    case 'number':
      resultType = 'number'
      break
    case 'boolean':
      resultType = 'boolean'
      break
    // TODO what other types should we support here?
  }

  return nullable === true ? `${resultType} | null` : resultType
}
