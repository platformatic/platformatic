import React from 'react'
import Title from '../elements/Title'
import { notify } from '../utils'
export default function Home () {
  async function onRestartClicked () {
    const res = await fetch('/_admin/restart', {
      method: 'POST'
    })
    if (res.status === 200) {
      notify({
        message: 'Server restarted',
        type: 'success'
      })
    } else {
      notify({
        message: 'There was an error...',
        type: 'error'
      })
    }
  }
  return (
    <>
      <Title>Welcome to Platformatic DB!</Title>
      <button className='button is-primary' onClick={onRestartClicked}>Restart Server</button>
    </>
  )
}
