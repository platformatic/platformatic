import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  CreateButton,
  DatagridConfigurable,
  ExportButton,
  Filter,
  FilterButton,
  Layout,
  List,
  Resource,
  SelectColumnsButton,
  TopToolbar,
  useResourceContext
} from 'react-admin'
import {
  AdminGuesser,
  CreateGuesser,
  EditGuesser,
  openApiDataProvider,
  openApiSchemaAnalyzer,
  ShowGuesser,
  InputGuesser,
  FieldGuesser
} from '@api-platform/admin'
import platformaticDbRestProvider from '@platformatic/db-ra-data-rest'

const ApiContext = createContext({})

function useEntityContext (props) {
  const resource = useResourceContext(props)
  const { api } = useContext(ApiContext)
  const entity = api.data.resources.find(entity => entity.name === resource)

  return entity
}

const DataAdmin = (props) => {
  const { basename, apiUrl, swaggerDocUrl } = props

  const dataProvider = openApiDataProvider({
    dataProvider: platformaticDbRestProvider(apiUrl),
    entrypoint: apiUrl,
    docEntrypoint: swaggerDocUrl
  })

  const [api, setAPI] = useState(false)
  useEffect(() => {
    async function loadAPI () {
      const response = await dataProvider.introspect()
      setAPI(response)
    }
    loadAPI()
  }, [])
  if (!api) {
    return <h1>DataAdmin is Loading...</h1>
  }

  return (
    <ApiContext.Provider value={{ api }}>
      <AdminGuesser
        basename={basename}
        dataProvider={dataProvider}
        schemaAnalyzer={openApiSchemaAnalyzer()}
        layout={LayoutBuilder}
      >
        {api.data.resources.map((entity) =>
          <Resource
            key={entity.name}
            name={entity.name}
            list={ListBuilder}
            show={ShowGuesser}
            edit={EditGuesser}
            create={CreateGuesser}
          />
        )}
      </AdminGuesser>
    </ApiContext.Provider>
  )
}

const LayoutBuilder = (props) => (
  <Layout
    {...props}
    appBar={() => undefined}
  />
)

const ListBuilder = (props) => {
  const entity = useEntityContext(props)

  const filters = entity.fields.map((field) => (
    <InputGuesser
      key={field.name}
      source={field.name}
      alwaysOn={field.isRequired}
    />
  ))

  return (
    <List
      {...props}
      actions={<ListActions filters={filters} />}
      filters={<Filter>{filters}</Filter>}
    >
      <DatagridBuilder fields={entity.fields} />
    </List>
  )
}

const ListActions = (props) => (
  <TopToolbar>
    <FilterButton filters={props.filters} />
    <SelectColumnsButton />
    <CreateButton />
    <ExportButton />
  </TopToolbar>
)

const DatagridBuilder = (props) => (
  <DatagridConfigurable>
    {props.fields.map((field) => (
      <FieldGuesser key={field.name} source={field.name} />
    ))}
  </DatagridConfigurable>
)

export default DataAdmin
