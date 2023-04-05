import React from 'react'
import Xarrow from 'react-xarrows'

export const CustomArrow = (props) => {
  return (
    <div>
      <Xarrow
        start={props.start}
        end={props.end}
        animateDrawing
        headShape={'circle'}
        arrowHeadProps={{
          fill: 'transparent',
          strokeWidth: '0.1',
          stroke: 'whitesmoke',
        }}
        color="whitesmoke"
      />
    </div>
  )
}
