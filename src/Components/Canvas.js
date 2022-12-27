import React from 'react'
import '../App.css'
import { EquCard } from './EquCard'
import { Context } from '../context/context'
import Connector from 'react-svg-connector'

export const Canvas = () => {
  const context = React.useContext(Context)
  const [localSets, setLocalSets] = React.useState([[...context.sections]])
  React.useEffect(() => {
    context.setSections(localSets.flat())
  }, [localSets])

  //make a new ref when an EquCard is added
  const ref = React.useRef(null)
  const [refs, setRefs] = React.useState([])
  React.useEffect(() => {
    //add a ref for each section
    setRefs([...Array(context.sections.length)].map((_, i) => ref))
  }, [context.sections])

  React.useEffect(() => {
    console.log(refs)
  }, [refs])

  const findParent = (id) => {
    const index = context.sections.findIndex((section) => section.id === id)
    if (index === -1) return null
    return refs[index].current
  }

  return (
    <div className="canvas">
      {context.sections.map((section, index) => {
        return (
          <div key={section.id} ref={refs[index]}>
            <Connector
              shape="narrow-s"
              roundCorner
              endArrow
              el1={section.value === 'root' ? null : refs[index].current}
              el2={findParent(section.parent)}
            />
            <EquCard
              variable={section.value}
              id={section.id}
              setLocalSets={setLocalSets}
              index={index}
              localSets={localSets}
            />
          </div>
        )
      })}
    </div>
  )
}
