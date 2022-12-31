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
    top: 10,
    left: 10,
    bottom: height - height * 0.35,
    right: width - width * 0.2,
  }
  const defaultPosition = { x: 10, y: 10 }

  const context = React.useContext(Context)
  const [innerHtml, setInnerhtml] = React.useState('')
  const [equation, setEquation] = React.useState('')
  const [caretPosition, setCaretPosition] = React.useState(0)
  const [localSections, setLocalSections] = React.useState([])
  const [localResult, setLocalResult] = React.useState('')
  const nodeRef = React.useRef(null)
  const spanRef = React.useRef(null)

  React.useEffect(() => {
    if (!context.isEditing) {
      const equationUnparsed = spanRef.current.innerHTML
      const equationClean = equationUnparsed.replace(/\s/g, '')
      const varsResults = props.resolveChildren(props.id)
      varsResults.forEach((varPair) =>
        equationClean.replace(varPair[0], varPair[1]),
      )
      setEquation(equationClean)
    }
  }, [context.isEditing])

  React.useEffect(() => {
    const equationParsed = math.parse(equation)
    const result = equationParsed.evaluate()
    setLocalResult(result)
    if (props.variable === 'first') context.setResult(result)
  }, [equation])

  React.useEffect(() => {
    try {
      const range = document.createRange()
      const sel = window.getSelection()
      range.setStart(spanRef.current.childNodes[0], caretPosition)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      spanRef.current.focus()
    } catch (error) {}
  }, [innerHtml])

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
    //make it so that
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

  const getCaretPosition = (el) => {
    if (window.getSelection && window.getSelection().getRangeAt) {
      var range = window.getSelection().getRangeAt(0)
      var selectedObj = window.getSelection()
      var rangeCount = 0
      var childNodes = selectedObj.anchorNode.parentNode.childNodes
      for (var i = 0; i < childNodes.length; i++) {
        if (childNodes[i] === selectedObj.anchorNode) {
          break
        }
        if (childNodes[i].outerHTML)
          rangeCount += childNodes[i].outerHTML.length
        else if (childNodes[i].nodeType == 3) {
          rangeCount += childNodes[i].textContent.length
        }
      }
      return range.startOffset + rangeCount
    }
    return -1
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
    if (sectionsFiltered === []) props.resetChildrenStateful(props.id)
    else props.resetAndAdd(sectionsFiltered, props.id)
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
    const inputData = e.nativeEvent.data
    getVariables(equationClean)
    if (inputData === '(') {
      const caret = getCaretPosition(e.currentTarget)
      setCaretPosition(caret)
      const split =
        equationUnparsed.slice(0, caret) + ')' + equationUnparsed.slice(caret)
      setInnerhtml(split)
    }
  }

  return (
    <Draggable
      nodeRef={nodeRef}
      cancel={'.equ-card-textarea'}
      defaultPosition={defaultPosition}
      bounds={moveBounds}
      onDrag={updateArrow}
      onStop={updateArrow}
    >
      <div className="equ-card unselectable" ref={nodeRef} id={props.id}>
        {props.index}
        <div className="equCard-varBox unselectable">{props.variable}</div>
        <div className="coverUp" />
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
            >
              {innerHtml}
              {props.did}
            </span>{' '}
            <span className="result unselectable"> = {localResult}</span>
          </b>
        </div>
        {context.isEditing ? (
          <svg
            className="svg"
            onClick={() => context.setIsEditing(!context.isEditing)}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
          >
            <path d="M470.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L192 338.7 425.4 105.4c12.5-12.5 32.8-12.5 45.3 0z" />
          </svg>
        ) : (
          <svg
            className="svg"
            onClick={() => context.setIsEditing(!context.isEditing)}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
          >
            <path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.8 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z" />
          </svg>
        )}
      </div>
    </Draggable>
  )
}
