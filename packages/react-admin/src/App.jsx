// in src/App.js
import * as React from "react";
import { Admin, Resource, ListGuesser, EditGuesser, ShowGuesser } from 'react-admin';

import Dashboard from './Dashboard';
import authProvider from './authProvider';

import platformaticDbRestProvider from '@platformatic/db-ra-data-rest'

export default function ReactAdmin(props) {
    const dataProvider = platformaticDbRestProvider(props.apiUrl);
    return (
        <Admin basename={props.basename} dashboard={Dashboard} authProvider={authProvider} dataProvider={dataProvider}>
            <Resource name="movies" list={ListGuesser} show={ShowGuesser} edit={EditGuesser} />
            <Resource name="quotes" list={ListGuesser} show={ShowGuesser} edit={EditGuesser} />
        </Admin>
    );
}
