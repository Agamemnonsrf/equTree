import React from "react";
import "../App.css";
import Draggable from "react-draggable";
import useWindowDimensions from "../hooks/useWindowDimensions";
import { Context } from "../context/context";
import * as math from "mathjs";

export const EquCard = () => {
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
    const that = sections.map((section) => {
      return [section, Number(section), isFinite(section), isVariable(section)];
    });
    console.log(that);
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

  const searchForVariables = (equation) => {
    //regex that matches a sequence of letters
    const variables = equation.match(/[a-z]+/g);
    if (variables) {
      const uniqueVariables = [...new Set(variables)];
      console.log(uniqueVariables);
    }
  };

  const handleEquationChange = (e) => {
    const equationUnparsed = e.currentTarget.textContent;
    const equationClean = equationUnparsed.replace(/\s/g, "");
    const inputData = e.nativeEvent.data;

    if (inputData === "(") {
      const caret = getCaretPosition(e.currentTarget);
      setCaretPosition(caret);
      const split =
        equationUnparsed.slice(0, caret) + ")" + equationUnparsed.slice(caret);
      setInnerhtml(split);
    } else if (isValidEquation(equationClean)) {
      searchForVariables(equationClean);
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
      console.log("no caret position");
    }
  }, [innerHtml]);

  return (
    <Draggable
      nodeRef={nodeRef}
      cancel={".equ-card-textarea"}
      defaultPosition={defaultPosition}
      bounds={moveBounds}
    >
      <div className="equ-card" ref={nodeRef}>
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
            = {context.result}
          </span>
        </b>
      </div>
    </Draggable>
  );
};
