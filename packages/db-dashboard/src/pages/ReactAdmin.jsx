'use strict'
import React, { useState, useEffect } from 'react'
import { Admin, BooleanInput, Create, EditGuesser, Layout, ListGuesser, NumberInput, required, Resource, ShowGuesser, SimpleForm, TextInput } from 'react-admin'
import './ReactAdmin.css'

import camelcase from 'camelcase'
import { pluralize } from 'inflected'

import platformaticDbRestProvider from '@platformatic/db-ra-data-rest'
function customLayout (props) {
  return (
    <Layout
      {...props}
      appBar={() => undefined}
    />
  )
}
const FieldInput = (props) => {
  const { source, attributes } = props

  const validate = []
  if (attributes.required) {
    validate.push(required())
  }

  switch (attributes.type) {
    case 'number':
    case 'integer':
      return <NumberInput source={source} validate={validate} />
    case 'boolean':
      return <BooleanInput source={source} validate={validate} />
    case 'string':
      return <TextInput source={source} validate={validate} />
    default:
      return <TextInput source={source} validate={validate} />
  }
}

const CreateGuesser = (props) => {
  const schema = props.schema
  const properties = schema.properties
  const requiredList = schema.required ?? []

  return (
    <Create {...props}>
      <SimpleForm>
        {Object.entries(properties).map(([fieldname, attributes]) => {
          attributes.required = (requiredList.indexOf(fieldname) !== -1)
          return (
            <FieldInput key={fieldname} source={fieldname} attributes={attributes} />
          )
        })}
      </SimpleForm>
    </Create>
  )
}

const ReactAdmin = (props) => {
  const { basename, apiUrl, swaggerDocUrl } = props

  const [swagger, setSwagger] = useState(false)
  useEffect(() => {
    async function loadSwagger () {
      const response = await fetch(swaggerDocUrl)
      if (response.status === 200) {
        const body = await response.json()
        setSwagger(body)
      }
    }
    loadSwagger()
  }, [])
  if (!swagger) {
    return <h1>React Admin is Loading...</h1>
  }

  const schemas = swagger.components.schemas
  const dataProvider = platformaticDbRestProvider(apiUrl)

  return (
    <Admin basename={basename} dataProvider={dataProvider} layout={customLayout}>
      {Object.keys(schemas).map((entity) =>
        <Resource
          key={entity}
          name={pluralize(camelcase(entity))}
          list={ListGuesser}
          show={ShowGuesser}
          edit={EditGuesser}
          create={<CreateGuesser schema={schemas[entity]} />}
        />
      )}
    </Admin>
  )
}

export default ReactAdmin
