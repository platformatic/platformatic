'use strict'
import React from 'react'
import { Admin, Resource, ListGuesser, EditGuesser, ShowGuesser } from 'react-admin';
import './ReactAdmin.css'

import platformaticDbRestProvider from '@platformatic/db-ra-data-rest'

export default function ReactAdmin(props) {
    const dataProvider = platformaticDbRestProvider(props.apiUrl);
    return (
        <Admin basename={props.basename} dataProvider={dataProvider}>
            <Resource name="movies" list={ListGuesser} show={ShowGuesser} edit={EditGuesser} />
            <Resource name="quotes" list={ListGuesser} show={ShowGuesser} edit={EditGuesser} />
        </Admin>
    );
}
