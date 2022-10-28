'use strict'
import React from 'react'
import { useState, useEffect } from 'react';
import { Admin, Resource, ListGuesser, EditGuesser, ShowGuesser } from 'react-admin';
import './ReactAdmin.css'

import { pluralize } from 'inflected'

import platformaticDbRestProvider from '@platformatic/db-ra-data-rest'

export default function ReactAdmin(props) {
    const [entities, setEntities] = useState(false)
    useEffect(() => {
      async function loadSwagger () {
        const response = await fetch(props.swaggerDocUrl)
        if (response.status === 200) {
          const swagger = await response.json()
          const entities = Object.keys(swagger.components.schemas).map((name) => pluralize(name.toLowerCase()));
          setEntities(entities)
        }
      }
      loadSwagger()
    }, [])
    if (!entities) {
      return <h1>React-Admin is Loading</h1>
    }

    const dataProvider = platformaticDbRestProvider(props.apiUrl);

    return (
        <Admin basename={props.basename} dataProvider={dataProvider}>
            {entities.map((entity) => 
                <Resource key={entity} name={entity} list={ListGuesser} show={ShowGuesser} edit={EditGuesser} />
            )}
        </Admin>
    );
}
