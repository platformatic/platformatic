'use strict'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@mui/material'
import { Admin, Resource, ListGuesser, EditGuesser, ShowGuesser } from 'react-admin'
import './ReactAdmin.css'

import { pluralize } from 'inflected'

import platformaticDbRestProvider from '@platformatic/db-ra-data-rest'

function buildDashboard (swagger) {
  return () => (
    <Card>
      <CardHeader title={`React Admin for '${swagger.info.title}'`} />
      <CardContent>This React Admin app was generated for you by Platformatic DB to quickly explore your database.</CardContent>
    </Card>
  )
}

export default function ReactAdmin (props) {
  const [swagger, setSwagger] = useState(false)
  useEffect(() => {
    async function loadSwagger () {
      const response = await fetch(props.swaggerDocUrl)
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

  const dashboard = buildDashboard(swagger)
  const entities = Object.keys(swagger.components.schemas).map((name) => pluralize(name.toLowerCase()))
  const dataProvider = platformaticDbRestProvider(props.apiUrl)

  return (
    <Admin basename={props.basename} dataProvider={dataProvider} dashboard={dashboard}>
      {entities.map((entity) =>
        <Resource key={entity} name={entity} list={ListGuesser} show={ShowGuesser} edit={EditGuesser} />
      )}
    </Admin>
  )
}
