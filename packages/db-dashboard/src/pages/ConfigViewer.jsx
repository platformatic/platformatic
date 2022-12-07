import React, { useContext, useEffect, useRef, useState } from 'react'
import Title from '../elements/Title'
import formatHighlight from 'json-format-highlight'
import JSONEditor from 'jsoneditor'
import 'jsoneditor/dist/jsoneditor.min.css'
import { notify } from '../utils'
import { AppContext } from '../App'
let editor

export default function ConfigViewer () {
  const { adminSecret, urlPrefix } = useContext(AppContext)
  const [saveEnabled, setSaveEnabled] = useState(true)
  const jsonEditorRef = useRef()
  /* eslint-disable no-unused-vars */
  const [_, setConfig] = useState('')
  /* eslint-enable no-unused-vars */
  const editorOptions = {}
  const configFileUrl = `${urlPrefix}/_admin/config-file`

  async function onSaveButtonClicked (event) {
    event.preventDefault()
    const newConfig = editor.get()
    const res = await fetch(configFileUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret
      },
      method: 'POST',
      body: JSON.stringify(newConfig)
    })
    if (res.status === 200) {
      notify({
        message: 'Config file saved',
        type: 'success'
      })
    } else {
      notify({
        message: await res.json(),
        type: 'error'
      })
    }
  }
  let rendered = false
  useEffect(() => {
    async function getConfig () {
      const response = await fetch(configFileUrl, {
        headers: {
          'X-PLATFORMATIC-ADMIN-SECRET': adminSecret
        }
      })
      if (response.status === 200) {
        const body = await response.json()
        if (!body.configFileLocation) {
          setSaveEnabled(false)
        }
        setConfig(formatHighlight(body))
        if (!rendered) {
          editor = new JSONEditor(jsonEditorRef.current, editorOptions)
          rendered = true
        }
        editor.set(body)
      }
    }
    getConfig()
  }, [])

  return (
    <>
      <Title>Platformatic DB Config File</Title>
      <div className='editor-container '>
        <div className='mb-4' ref={jsonEditorRef} />
        <div className='buttons is-flex is-justify-content-flex-end'>
          {saveEnabled && <button className='button is-button is-primary' onClick={onSaveButtonClicked}>Save </button>}
        </div>
      </div>
    </>
  )
}
