import React from 'react'
import '../App.css'
import Draggable from 'react-draggable'
import useWindowDimensions from '../hooks/useWindowDimensions'
import { Context } from '../context/context'
import * as math from 'mathjs'
import uuid from 'react-uuid'
import { useXarrow, Xwrapper } from 'react-xarrows'

export const EquCard = (props) => {
  const { height, width } = useWindowDimensions()
  const updateArrow = useXarrow()
  const moveBounds = {
    top: 0,
  }
  const defaultPosition = { x: 10, y: 10 }

  const context = React.useContext(Context)

  const [newVar, setNewVar] = React.useState('')
  const [isNamingVar, setIsNamingVar] = React.useState(false)
  const [localResult, setLocalResult] = React.useState('')
  const [nameVarWarning, setNameVarWarning] = React.useState(false)
  const nodeRef = React.useRef(null)
  const spanRef = React.useRef(null)
  const newVarRef = React.useRef(null)

  React.useEffect(() => {
    if (!context.isEditing) {
      const equationUnparsed = spanRef.current.innerHTML
      const equationClean = equationUnparsed.replace(/\s/g, '')

      if (!props.isLeaf(props.id)) {
        const varsResults = props.resolveChildren(props.id)
        const scope = {}
        varsResults.forEach((varPair) => {
          scope[varPair[0]] = varPair[1]
        })
        console.log(`scope: ${JSON.stringify(scope)}`)
        const equationParsed = math.compile(equationClean)
        const result = equationParsed.evaluate(scope)
        setLocalResult(result)
        props.setResult(props.id, result)
      }
    }
  }, [context.isEditing])

  //ITS THIS GUY'S FAULT THAT I CANT SAY SQRT() IN THE EQUATION
  const isValidEquation = (str) => {
    var invalidOperatorPairs = [
      '**',
      '*/',
      '/*',
      '//',
      '()',
      '^^',
      '^/',
      '/^',
      '^*',
      '*^',
      '-)',
      '+)',
      '*)',
      '/*',
      '^)',
      '-*',
      '-/',
      '-^',
      '+*',
      '+/',
      '+^',
      '(*',
      '(/',
      '(^',
      '/)',
      '*)',
      '+)',
      '-)',
      '^)',
    ]
    str = '(' + str + ')'
    var open = 0
    for (var i = 0, len = str.length; i < len; i++) {
      var curr = str[i]
      if (curr === '(') {
        open += 1
      } else if (curr === ')') {
        open -= 1
        if (open < 0) {
          return false
        }
      }
      if (i > 0) {
        for (var j = 0, oplen = invalidOperatorPairs.length; j < oplen; j++) {
          if (
            str[i - 1] == invalidOperatorPairs[j][0] &&
            curr == invalidOperatorPairs[j][1]
          ) {
            return false
          }
        }
      }
    }
    if (open !== 0) return false
    var sections = str.split(/[\+\-\*\/\^\)\(]/g)
    for (i = 0, len = sections.length; i < len; i++) {
      if (
        (sections[i].length > 0 &&
          !(Number(sections[i]) !== NaN && isFinite(sections[i]))) ||
        isVariable(sections[i])
      ) {
        return false
      }
    }
    return true
  }

  const isVariable = (str) => {
    const match = str.match(/^[a-z]+$/g)
    if (match) {
      return true
    }
  }

  const getVariables = (str) => {
    const sections = str.split(/[\+\-\*\/\^\)\(]/g)
    const sectionsFiltered = sections.filter((section) => isVariable(section))
    console.log(
      `sectionsFiltered: ${[
        sectionsFiltered,
      ]} and type: ${typeof sectionsFiltered}`,
    )
    return sectionsFiltered
  }

  const containsVariables = (str) => {
    const sections = str.split(/[\+\-\*\/\^\)\(]/g)
    const sectionsFiltered = sections.filter((section) => isVariable(section))
    if (sectionsFiltered.length > 0) {
      return true
    }
  }

  const handleEquationChange = (e) => {
    const equationUnparsed = e.currentTarget.textContent
    const equationClean = equationUnparsed.replace(/\s/g, '')

    if (props.isLeaf(props.id)) {
      if (isValidEquation(equationClean)) {
        const result = math.evaluate(equationClean)
        setLocalResult(result)
        props.setResult(props.id, result)
      }
    }
    handleChildrenStatus(equationClean)
  }

  const handleNameVar = (e) => {
    const name = e.currentTarget.textContent
    //allow only letters
    if (name.match(/^[a-z]+$/g)) {
      setNewVar(name)
    }
  }

  const handleChildrenStatus = (str) => {
    if (containsVariables(str)) {
      const vars = getVariables(str)
      if (!props.childrenSatisfied(props.id, vars)) {
        props.setChildrenStatus(false)
      } else {
        props.setChildrenStatus(true)
      }
    }
  }

  const handleNameVarDone = () => {
    const breh = newVarRef.current.textContent
    if (breh === '') return
    if (breh.match(/^[a-z]+$/g)) {
      const equationUnparsed = spanRef.current.innerHTML
      const equationClean = equationUnparsed.replace(/\s/g, '')
      props.addNodeStateful(props.id, breh)
      setIsNamingVar(false)
      setNameVarWarning(false)
      handleChildrenStatus(equationClean)
    } else {
      setNameVarWarning(true)
    }
    setNewVar('')
  }

  const handleDelete = () => {
    const equationUnparsed = spanRef.current.innerHTML
    const equationClean = equationUnparsed.replace(/\s/g, '')
    props.removeNode(props.id)
    handleChildrenStatus(equationClean)
  }

  return (
    <Draggable
      nodeRef={nodeRef}
      cancel={'.equ-card-textarea'}
      defaultPosition={
        props.variable === 'root'
          ? defaultPosition
          : {
              x: props.getNodeLevel(props.id) * 400,
              y: props.getChildIndex(props.id) * 200,
            }
      }
      bounds={moveBounds}
      onDrag={updateArrow}
      onStop={updateArrow}
    >
      <div
        className="equ-card unselectable"
        ref={nodeRef}
        id={props.id}
        key={props.id}
        style={
          !props.childrenStatus && {
            boxShadow: '0 0 10px 5px rgba(255,0,0,1.0)',
          }
        }
      >
        {props.index}
        <div className="equCard-varBox unselectable">{props.variable}</div>
        <div className="coverUp" />
        {props.variable !== 'root' && context.isEditing && (
          <svg
            className="svg-right"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 448 512"
            name="trashcan"
            onClick={() => handleDelete()}
          >
            <path d="M160 400C160 408.8 152.8 416 144 416C135.2 416 128 408.8 128 400V192C128 183.2 135.2 176 144 176C152.8 176 160 183.2 160 192V400zM240 400C240 408.8 232.8 416 224 416C215.2 416 208 408.8 208 400V192C208 183.2 215.2 176 224 176C232.8 176 240 183.2 240 192V400zM320 400C320 408.8 312.8 416 304 416C295.2 416 288 408.8 288 400V192C288 183.2 295.2 176 304 176C312.8 176 320 183.2 320 192V400zM317.5 24.94L354.2 80H424C437.3 80 448 90.75 448 104C448 117.3 437.3 128 424 128H416V432C416 476.2 380.2 512 336 512H112C67.82 512 32 476.2 32 432V128H24C10.75 128 0 117.3 0 104C0 90.75 10.75 80 24 80H93.82L130.5 24.94C140.9 9.357 158.4 0 177.1 0H270.9C289.6 0 307.1 9.358 317.5 24.94H317.5zM151.5 80H296.5L277.5 51.56C276 49.34 273.5 48 270.9 48H177.1C174.5 48 171.1 49.34 170.5 51.56L151.5 80zM80 432C80 449.7 94.33 464 112 464H336C353.7 464 368 449.7 368 432V128H80V432z" />
          </svg>
        )}

        {context.isEditing && (
          <svg
            className="svg-right-middle"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 448 512"
            onClick={() => {
              setIsNamingVar(!isNamingVar)
              newVarRef.current.focus()
              console.log(newVarRef)
            }}
            name="plus"
          >
            <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z" />
          </svg>
        )}

        <div
          className="name-var-popup"
          style={{ opacity: isNamingVar ? '1' : '0' }}
        >
          <span
            className="name-var-popup-input"
            tabIndex="1"
            contentEditable
            ref={newVarRef}
            style={
              nameVarWarning
                ? { backgroundColor: 'red' }
                : { backgroundColor: 'rgb(180, 180, 180)' }
            }
            suppressContentEditableWarning
            onChange={handleNameVar}
          >
            {newVar}
          </span>

          <svg
            className="svg-var-popup"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            onClick={handleNameVarDone}
            name="check"
          >
            <path d="M470.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L192 338.7 425.4 105.4c12.5-12.5 32.8-12.5 45.3 0z" />
          </svg>
        </div>

        <div style={{ textAlign: 'center' }}>
          <b>
            <span
              ref={spanRef}
              suppressContentEditableWarning
              contentEditable={context.isEditing}
              className="equ-card-textarea"
              style={
                context.isEditing
                  ? { backgroundColor: 'rgb(218, 218, 218)' }
                  : { backgroundColor: 'transparent' }
              }
              onInput={handleEquationChange}
            ></span>

            <span className="result unselectable">
              {' '}
              = {localResult ? localResult : '0'}
            </span>
          </b>
        </div>
        {context.isEditing ? (
          <svg
            className="svg"
            onClick={() =>
              props.childrenStatus && context.setIsEditing(!context.isEditing)
            }
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            name="check"
          >
            <path d="M470.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L192 338.7 425.4 105.4c12.5-12.5 32.8-12.5 45.3 0z" />
          </svg>
        ) : (
          <svg
            className="svg"
            onClick={() => context.setIsEditing(!context.isEditing)}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            name="edit"
          >
            <path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.8 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z" />
          </svg>
        )}
      </div>
    </Draggable>
  )
}
