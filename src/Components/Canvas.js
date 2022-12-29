import React from 'react'
import '../App.css'
import { EquCard } from './EquCard'
import { Context } from '../context/context'
import Connector from 'react-svg-connector'
import Tree, { useTreeState } from 'react-hyper-tree'

const data = { name: 'root', id: 0, children: [] }

export const Canvas = () => {
  const context = React.useContext(Context)
  const { required, handlers } = useTreeState({
    data,
    id: 'tree',
  })

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

  return (
    <div className="canvas">
      <Tree
        {...required}
        {...handlers}
        renderNode={() => (
          <div>
            <EquCard />
          </div>
        )}
      />
    </div>
  )
}
