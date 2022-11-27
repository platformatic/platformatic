'use strict'
import React, { useState, useEffect } from 'react'
import { Admin, BooleanField, BooleanInput, Create, CreateButton, DatagridConfigurable, EditGuesser, ExportButton, FilterButton, FilterForm, Layout, List, NumberField, NumberInput, required, Resource, SavedQueriesList, SelectColumnsButton, ShowGuesser, SimpleForm, TextField, TextInput, TopToolbar } from 'react-admin'
import { Box, Card, CardContent } from '@mui/material'
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

const CreateBuilder = (props) => {
  const { schema } = props

  const requiredList = schema.required ?? []
  const DataInputList = Object.entries(schema.properties).map(([fieldname, attributes]) => (
    <DataInput
      key={fieldname}
      source={fieldname}
      type={attributes.type}
      required={(requiredList.indexOf(fieldname) !== -1)}
    />
  ))

  return (
    <Create {...props}>
      <SimpleForm>
        {DataInputList}
      </SimpleForm>
    </Create>
  )
}

const ListBuilder = (props) => {
  const { schema } = props

  const filters = Object.entries(schema.properties).map(([fieldname, attributes]) => (
    <DataInput
      key={`filter-${fieldname}`}
      source={fieldname}
      type={attributes.type}
      alwaysOn
    />
  ))

  return (
    <List
      aside={<ListAside filters={filters} />}
      actions={<ListActions filters={filters} />}
    >
      <EntityDatagrid schema={schema} />
    </List>
  )
}

const ListAside = (props) => (
  <Box
    sx={{
      display: { xs: 'none', sm: 'block' },
      order: -1, // display on the left rather than on the right of the list
      width: 200,
      mr: 2,
      mt: 7
    }}
  >
    <Card sx={{ order: -1, mt: 1 }}>
      <CardContent>
        <SavedQueriesList />
        <FilterForm filters={props.filters} />
      </CardContent>
    </Card>
  </Box>
)

const ListActions = (props) => (
  <TopToolbar>
    <FilterButton filters={props.filters} />
    <SelectColumnsButton />
    <CreateButton />
    <ExportButton />
  </TopToolbar>
)

const EntityDatagrid = (props) => {
  const { schema } = props

  const DataFields = Object.entries(schema.properties).map(([fieldname, attributes]) =>
    <DataField key={`field-${fieldname}`} source={fieldname} attributes={attributes} />
  )

  return (
    <DatagridConfigurable>
      {DataFields}
    </DatagridConfigurable>
  )
}

const DataField = (props) => {
  const { source } = props

  switch (props.type) {
    case 'boolean':
      return <BooleanField source={source} />
    case 'integer':
    case 'number':
      return <NumberField source={source} />
    case 'string':
    default:
      return <TextField source={source} />
  }
}

const DataInput = (props) => {
  const { source } = props

  const validate = []
  if (props.required) {
    validate.push(required())
  }

  switch (props.type) {
    case 'boolean':
      return <BooleanInput source={source} validate={validate} />
    case 'integer':
    case 'number':
      return <NumberInput source={source} validate={validate} />
    case 'string':
    default:
      return <TextInput source={source} validate={validate} />
  }
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
      {Object.keys(schemas).map((entity) => {
        const schema = schemas[entity]

        return (
          <Resource
            key={`entity-${entity}`}
            name={pluralize(camelcase(entity))}
            list={<ListBuilder schema={schema} />}
            show={ShowGuesser}
            edit={EditGuesser}
            create={<CreateBuilder schema={schema} />}
          />
        )
      })}
    </Admin>
  )
}

export default ReactAdmin
