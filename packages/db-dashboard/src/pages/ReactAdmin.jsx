'use strict'
import React from 'react'
import ReactAdmin from '../../../react-admin/src/App';

export default function App(props) {
  return (
    <ReactAdmin basename={props.basename} apiUrl={props.apiUrl}/>
  )
}
