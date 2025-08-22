import { hasDuplicatedParameters } from '@platformatic/client'
import camelcase from 'camelcase'
import CodeBlockWriter from 'code-block-writer'
import jsonpointer from 'jsonpointer'
import { TypeNotSupportedError } from './errors.js'
import { getType } from './get-type.js'
import { responsesWriter } from './responses-writer.js'
import { capitalize, getBodyType } from './utils.js'

export function writeOperations (
  interfacesWriter,
  mainWriter,
  operations,
  { fullRequest, fullResponse, optionalHeaders, schema, propsOptional }
) {
  const originalFullResponse = fullResponse
  const originalFullRequest = fullRequest
  let currentFullResponse = originalFullResponse
  let currentFullRequest = originalFullRequest
  for (const operation of operations) {
    const { operationId, description, summary, deprecated } = operation.operation
    const camelCaseOperationId = camelcase(operationId)
    const { parameters, responses, requestBody } = operation.operation
    currentFullRequest = fullRequest || hasDuplicatedParameters(operation.operation)
    if (!responses) {
      throw new Error(`Cannot find any response definition in operation ${operationId}.`)
    }
    const successResponses = Object.entries(responses).filter(([s]) => s.startsWith('2'))
    if (successResponses.length !== 1) {
      currentFullResponse = true
    }

    const capitalizedCamelCaseOperationId = capitalize(camelCaseOperationId)
    const operationRequestName = `${capitalizedCamelCaseOperationId}Request`

    let isRequestArray = false
    let isStructuredType = false
    const bodyWriter = new CodeBlockWriter({
      indentNumberOfSpaces: 2,
      useTabs: false,
      useSingleQuote: true
    })

    const addedProps = new Set()
    if (parameters) {
      if (currentFullRequest) {
        const bodyParams = []
        const pathParams = []
        const queryParams = []
        const headersParams = []
        for (const parameter of parameters) {
          if (optionalHeaders.includes(parameter.name)) {
            parameter.required = false
          }
          switch (parameter.in) {
            case 'query':
              queryParams.push(parameter)
              break
            case 'path':
              pathParams.push(parameter)
              break
            case 'body':
              bodyParams.push(parameter)
              break
            case 'header':
              headersParams.push(parameter)
              break
          }
        }
        writeProperties(bodyWriter, 'body', bodyParams, addedProps, 'req', schema)
        writeProperties(bodyWriter, 'path', pathParams, addedProps, 'req', schema)
        writeProperties(bodyWriter, 'query', queryParams, addedProps, 'req', schema)
        writeProperties(bodyWriter, 'headers', headersParams, addedProps, 'req', schema)
      } else {
        for (const parameter of parameters) {
          let { name, required } = parameter
          if (optionalHeaders.includes(name)) {
            required = false
          }
          // We do not check for addedProps here because it's the first
          // group of properties
          writeProperty(bodyWriter, name, parameter, addedProps, required, 'req', schema)
        }
      }
    }
    if (requestBody) {
      const bodyType = getBodyType(requestBody)
      if (parameters && parameters.length && (bodyType === 'array' || bodyType === 'plain')) {
        currentFullRequest = true
      }
      const writeContentOutput = writeContent(
        bodyWriter,
        requestBody.content,
        schema,
        addedProps,
        'req',
        currentFullRequest ? 'body' : null,
        propsOptional
      )
      isRequestArray = writeContentOutput.isArray
      isStructuredType = writeContentOutput.isStructuredType
    }

    if (isStructuredType || currentFullRequest || !isRequestArray) {
      interfacesWriter.write(`export type ${operationRequestName} =`).block(() => {
        interfacesWriter.write(bodyWriter.toString())
      })
    } else {
      interfacesWriter.write(`export type ${operationRequestName} = `)
      interfacesWriter.write(bodyWriter.toString())
    }

    interfacesWriter.blankLine()
    const allResponsesName = responsesWriter(
      capitalizedCamelCaseOperationId,
      responses,
      currentFullResponse,
      interfacesWriter,
      schema
    )
    mainWriter.writeLine('/**')
    if (summary) {
      for (const line of summary.split('\n')) {
        mainWriter.writeLine(` * ${line}`)
      }
      // Separate summary and description by blank line
      if (description) {
        mainWriter.writeLine(' *')
      }
    }
    if (description) {
      for (const line of description.split('\n')) {
        mainWriter.writeLine(` * ${line}`)
      }
    }
    if (deprecated) {
      mainWriter.writeLine(' * @deprecated')
    }
    mainWriter.writeLine(' * @param req - request parameters object')
    mainWriter.writeLine(` * @returns the API response${fullResponse ? '' : ' body'}`)
    mainWriter.writeLine(' */')
    mainWriter.writeLine(`${camelCaseOperationId}(req: ${operationRequestName}): Promise<${allResponsesName}>;`)
    currentFullResponse = originalFullResponse
    currentFullRequest = originalFullRequest
  }
}

export function writeProperties (writer, blockName, parameters, addedProps, methodType, spec) {
  if (parameters.length > 0) {
    let allOptionalParams = true
    for (const { required } of parameters) {
      if (required !== false) {
        allOptionalParams = false
      }
    }
    const nameToWrite = allOptionalParams ? `${blockName}?: ` : `${blockName}: `
    writer.write(nameToWrite).block(() => {
      for (const parameter of parameters) {
        const { name, required } = parameter
        // We do not check for addedProps here because it's the first
        // group of properties
        writeProperty(writer, name, parameter, addedProps, required, methodType, spec)
      }
    })
  }
}

export function writeProperty (writer, key, value, addedProps, required = true, methodType, spec) {
  addedProps.add(key)

  if (value.description || value.deprecated) {
    writer.writeLine('/**')
    if (value.description) {
      for (const line of value.description.split('\n')) {
        writer.writeLine(` * ${line}`)
      }
    }
    if (value.deprecated) {
      writer.writeLine(' * @deprecated')
    }
    writer.writeLine(' */')
  }

  if (required) {
    writer.quote(key)
  } else {
    writer.quote(key)
    writer.write('?')
  }

  writer.write(`: ${getType(value, methodType, spec)};`)
  writer.newLine()
}

export function writeContent (writer, content, spec, addedProps, methodType, wrapper, propsOptional) {
  let isArray = false
  let isStructuredType = false
  if (content) {
    for (const [contentType, body] of Object.entries(content)) {
      const isFormDataContent = contentType.indexOf('multipart/form-data') === 0

      // We ignore all non-JSON endpoints for now
      // TODO: support other content types
      /* c8 ignore next 3 */
      if (contentType.indexOf('application/json') !== 0 && !isFormDataContent) {
        continue
      }

      if (isFormDataContent && wrapper) {
        writer.write(`${wrapper}: FormData;`)
        break
      }

      // Response body has no schema that can be processed
      // Should not be possible with well formed OpenAPI
      /* c8 ignore next 3 */
      if (!body.schema?.type && !body.schema?.$ref && !body.schema?.allOf && !body.schema?.anyOf) {
        break
      }
      if (body.schema.type === 'object' || body.schema.$ref) {
        isStructuredType = true
      }
      let schema
      // This is likely buggy as there can be multiple responses for different
      // status codes. This is currently not possible with Platformatic DB
      // services so we skip for now.
      // TODO: support different schemas for different status codes
      if (body.schema.type === 'array') {
        isArray = true
        if (wrapper) {
          writer.write(`${wrapper}: `)
        }
        writer.write(getType(body.schema, methodType, spec))
        return { isArray, isStructuredType }
      } else {
        schema = body.schema
      }

      if (wrapper) {
        if (isStructuredType) {
          writer
            .write(`${wrapper}: `)
            .block(() => writeObjectProperties(writer, schema, spec, addedProps, methodType, propsOptional))
        } else {
          writer.write(`${wrapper}: ${getType(body.schema, methodType, spec)}`)
        }
      } else {
        writeObjectProperties(writer, schema, spec, addedProps, methodType, propsOptional)
      }
      break
    }
  }
  return { isArray, isStructuredType }
}

export function writeObjectProperties (writer, schema, spec, addedProps, methodType, propsOptional) {
  function _writeObjectProps (obj) {
    for (const [key, value] of Object.entries(obj)) {
      if (addedProps.has(key)) {
        continue
      }
      const required = (propsOptional ? !!schema.required : schema.required) && schema.required.includes(key)
      writeProperty(writer, key, value, addedProps, required, methodType, spec)
    }
  }

  if (schema.$ref) {
    schema = jsonpointer.get(spec, schema.$ref.replace('#', ''))
  }
  if (schema.type === 'object') {
    if (schema.properties) {
      _writeObjectProps(schema.properties)
    }

    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      _writeObjectProps(schema.additionalProperties)
    }
  } else {
    throw new TypeNotSupportedError(schema.type)
  }
}
