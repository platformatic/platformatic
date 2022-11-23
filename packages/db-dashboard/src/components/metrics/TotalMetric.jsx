import React from 'react'
import { TwoColumnsLayout, DetailedMetric, SimpleMetric } from '@platformatic/ui-components'

export default function TotalMetric ({ metrics }) {
  const totalRequests = metrics.totalReqCount
  const minutesFromStart = metrics.processUptime / 60
  const responsesPerMinute = (totalRequests / minutesFromStart).toFixed(2)
  const responsesPerSecond = (totalRequests / metrics.processUptime).toFixed(2)

  const requestsProps = {
    title: 'Requests',
    unit: 'Total',
    value: totalRequests,
    tooltip: 'Total number of requests made to this API',
    leftDetail: {
      unit: 'per minute',
      value: responsesPerMinute
    },
    rightDetail: {
      unit: 'per second',
      value: responsesPerSecond
    }
  }

  const ninetyPercentile = metrics.avgReqTimeByQuantile['0.9']?.toFixed(2)
  const ninetyFivePercentile = metrics.avgReqTimeByQuantile['0.95']?.toFixed(2)
  const ninetyNinePercentile = metrics.avgReqTimeByQuantile['0.99']?.toFixed(2)
  const timesProps = {
    title: 'RequestTimes',
    pre: 'P90',
    unit: 'ms',
    value: ninetyPercentile || 0,
    tooltip: 'Request process times per percentile',
    leftDetail: {
      pre: 'P95',
      unit: 'ms',
      value: ninetyFivePercentile || 0
    },
    rightDetail: {
      pre: 'P99',
      unit: 'ms',
      value: ninetyNinePercentile || 0
    }
  }

  const failureRateProps = {
    title: 'Failure Rate',
    unit: '%',
    value: metrics.failureRate,
    color: 'red',
    tooltip: '% of failures'
  }

  return (
    <TwoColumnsLayout>
      <DetailedMetric {... requestsProps} />
      <DetailedMetric {... timesProps} />
      <SimpleMetric {...failureRateProps} />
    </TwoColumnsLayout>
  )
}
