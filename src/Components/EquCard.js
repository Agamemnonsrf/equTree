import React from "react";
import "../App.css";
import Draggable from "react-draggable";
import useWindowDimensions from "../hooks/useWindowDimensions";
import { Context } from "../context/context";
import * as math from "mathjs";
import uuid from "react-uuid";

export const EquCard = (props) => {
  const { height, width } = useWindowDimensions();
  const moveBounds = {
    top: 10,
    left: 10,
    bottom: height - height * 0.35,
    right: width - width * 0.2,
  };
  const defaultPosition = { x: 10, y: 10 };

  const context = React.useContext(Context);
  const [innerHtml, setInnerhtml] = React.useState("");
  const [equation, setEquation] = React.useState("");
  const [caretPosition, setCaretPosition] = React.useState(0);
  const [localSections, setLocalSections] = React.useState([]);
  const [localResult, setLocalResult] = React.useState("");
  const nodeRef = React.useRef(null);
  const spanRef = React.useRef(null);

  const isValidEquation = (str) => {
    var invalidOperatorPairs = [
      "**",
      "*/",
      "/*",
      "//",
      "()",
      "^^",
      "^/",
      "/^",
      "^*",
      "*^",
      "-)",
      "+)",
      "*)",
      "/*",
      "^)",
      "-*",
      "-/",
      "-^",
      "+*",
      "+/",
      "+^",
      "(*",
      "(/",
      "(^",
      "/)",
      "*)",
      "+)",
      "-)",
      "^)",
    ];
    str = "(" + str + ")";
    var open = 0;
    for (var i = 0, len = str.length; i < len; i++) {
      var curr = str[i];
      if (curr === "(") {
        open += 1;
      } else if (curr === ")") {
        open -= 1;
        if (open < 0) {
          return false;
        }
      }
      if (i > 0) {
        for (var j = 0, oplen = invalidOperatorPairs.length; j < oplen; j++) {
          if (
            str[i - 1] == invalidOperatorPairs[j][0] &&
            curr == invalidOperatorPairs[j][1]
          ) {
            return false;
          }
        }
      }
    }
    //make it so that
    if (open !== 0) return false;
    var sections = str.split(/[\+\-\*\/\^\)\(]/g);
    for (i = 0, len = sections.length; i < len; i++) {
      if (
        (sections[i].length > 0 &&
          !(Number(sections[i]) !== NaN && isFinite(sections[i]))) ||
        isVariable(sections[i])
      ) {
        return false;
      }
    }
    return true;
  };

  const getCaretPosition = (el) => {
    if (window.getSelection && window.getSelection().getRangeAt) {
      var range = window.getSelection().getRangeAt(0);
      var selectedObj = window.getSelection();
      var rangeCount = 0;
      var childNodes = selectedObj.anchorNode.parentNode.childNodes;
      for (var i = 0; i < childNodes.length; i++) {
        if (childNodes[i] === selectedObj.anchorNode) {
          break;
        }
        if (childNodes[i].outerHTML)
          rangeCount += childNodes[i].outerHTML.length;
        else if (childNodes[i].nodeType == 3) {
          rangeCount += childNodes[i].textContent.length;
        }
      }
      return range.startOffset + rangeCount;
    }
    return -1;
  };

  const isVariable = (str) => {
    const match = str.match(/^[a-z]+$/g);
    if (match) {
      return true;
    }
  };

  const getVariables = (str) => {
    const sections = str.split(/[\+\-\*\/\^\)\(]/g);
    const sectionsFiltered = sections.filter((section) => isVariable(section));
    const variables = sectionsFiltered.map((section) => ({ value: section, id: uuid() }));
    console.log("localSections: ", variables);
    const localSetsCopy = [...props.localSets];
    console.log("localSetsCopy: ", localSetsCopy);
    localSetsCopy[props.index + 1] = variables;

    props.setLocalSets(localSetsCopy);
  }

  const handleEquationChange = (e) => {
    const equationUnparsed = e.currentTarget.textContent;
    const equationClean = equationUnparsed.replace(/\s/g, "");
    const inputData = e.nativeEvent.data;
    getVariables(equationClean);

    if (inputData === "(") {
      const caret = getCaretPosition(e.currentTarget);
      setCaretPosition(caret);
      const split =
        equationUnparsed.slice(0, caret) + ")" + equationUnparsed.slice(caret);
      setInnerhtml(split);
    } else if (isValidEquation(equationClean)) {
      setEquation(equationClean);
    } else if (equationClean === "") {
      context.setResult("0");
    } else {
      context.setResult("NaN");
    }
  };

  React.useEffect(() => {
    const equationParsed = math.parse(equation);
    const result = equationParsed.evaluate();
    setLocalResult(result);
    if (props.variable === 'first')
      context.setResult(result);
  }, [equation]);

  React.useEffect(() => {
    try {
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(spanRef.current.childNodes[0], caretPosition);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      spanRef.current.focus();
    } catch (error) {
    }
  }, [innerHtml]);

  React.useEffect(() => {
    if (localSections.length > 0) {
      context.setSections(prev => [...localSections]);
    }
  }, [localSections]);

  return (
    <Draggable
      nodeRef={nodeRef}
      cancel={".equ-card-textarea"}
      defaultPosition={defaultPosition}
      bounds={moveBounds}
    >
      <div className="equ-card" ref={nodeRef}>{props.variable} {''}
        <b>
          <span
            ref={spanRef}
            suppressContentEditableWarning
            onInput={(e) => {
              handleEquationChange(e);
            }}
            contentEditable="true"
            className="equ-card-textarea"
          >
            {innerHtml}
          </span>{" "}
          <span style={{ fontFamily: "Rubik, sansSerif" }}>
            {" "}
            = {localResult}
          </span>
        </b>
      </div>
    </Draggable>
  );
};
