'use strict'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

export default function SwaggerViewer (props) {
  const { swaggerDocUrl } = props
  return (
    <SwaggerUI url={swaggerDocUrl} />
  )
}
