import React from 'react'
import '../App.css'
import { EquCard } from './EquCard'
import { Context } from '../context/context'
import { useTree } from '../hooks/useTree'
import Xarrow, { useXarrow, Xwrapper } from 'react-xarrows'

export const Canvas = () => {
  const context = React.useContext(Context)
  const updateArrow = useXarrow()
  const ref1 = React.useRef(null)
  const ref2 = React.useRef(null)
  const {
    tree,
    tree1D,
    addNode,
    findNode,
    removeNode,
    getSize,
    resetTree,
    resetAndAdd,
    resetChildrenStateful,
  } = useTree()

  console.log(tree1D)

  return (
    <div className="canvas">
      <div className="canvas__equations">
        {/* {tree1D.map((node) => {
          return (
            <EquCard
              key={node.id}
              id={node.id}
              variable={node.value}
              parent={node.parent}
              children={node.children}
              addNode={addNode}
              findNode={findNode}
              removeNode={removeNode}
              getSize={getSize}
              resetTree={resetTree}
              resetAndAdd={resetAndAdd}
              resetChildrenStateful={resetChildrenStateful}
            />
          )
        })} */}
        <Xwrapper>
          <Xarrow start={'ooga'} end={'booga'} />
          <EquCard variable="bruh" updateArrow={updateArrow} id="ooga" />
          <EquCard variable="breh" updateArrow={updateArrow} id="booga" />
        </Xwrapper>
      </div>
    </div>
  )
}
