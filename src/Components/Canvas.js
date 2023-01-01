import React from 'react'
import '../App.css'
import { EquCard } from './EquCard'
import { Context } from '../context/context'
import { useTree } from '../hooks/useTree'
import { useXarrow, Xwrapper } from 'react-xarrows'
import { CustomArrow } from './CustomArrow'
import Draggable from 'react-draggable'

export const Canvas = () => {
  const context = React.useContext(Context)
  const updateArrow = useXarrow()
  const ref1 = React.useRef(null)
  const ref2 = React.useRef(null)
  const {
    tree1D,
    addNode,
    findNode,
    resetTree,
    resetAndAdd,
    resetChildrenStateful,
    isLeaf,
    setResult,
    resolveChildren,
    addNodeStateful,
    removeNode,
    getNodeLevel,
    getChildIndex,
  } = useTree()

  console.log(tree1D)

  return (
    <div className="canvas">
      <Xwrapper>
        {tree1D.map((node) => {
          return (
            <>
              <EquCard
                key={node.id}
                id={node.id}
                variable={node.value}
                parent={node.parent}
                children={node.children}
                addNode={addNode}
                findNode={findNode}
                resetTree={resetTree}
                resetAndAdd={resetAndAdd}
                resetChildrenStateful={resetChildrenStateful}
                isLeaf={isLeaf}
                setResult={setResult}
                resolveChildren={resolveChildren}
                addNodeStateful={addNodeStateful}
                removeNode={removeNode}
                getNodeLevel={getNodeLevel}
                getChildIndex={getChildIndex}
              />
              {node.parent && <CustomArrow start={node.parent} end={node.id} />}
            </>
          )
        })}
      </Xwrapper>
    </div>
  )
}
