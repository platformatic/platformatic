# @platformatic/db-ra-data-rest

React Admin's data-provider that uses Platformatic DB REST API.

## Install

```sh
npm install @platformatic/db-ra-data-rest
```

## Usage

```js
// in src/App.js
import * as React from "react";
import { Admin, Resource } from 'react-admin';
import platformaticDBRestDataProvider from '@platformatic/db-ra-data-rest';
import { PostList } from './posts';

const dataProvider = platformaticDBRestDataProvider();

const App = () => (
    <Admin dataProvider={dataProvider}>
        <Resource name="posts" list={PostList} />
    </Admin>
);

export default App;
```

## License

Apache 2.0
