import React from "react";
import '../App.css'
import Draggable from 'react-draggable';
import useWindowDimensions from "../hooks/useWindowDimensions";
import { Context } from "../context/context";
import * as math from 'mathjs';

export const EquCard = () => {
    const { height, width } = useWindowDimensions();
    const context = React.useContext(Context);

    const isValid = (str) => {
        var invalidOperatorPairs = ["**", "*/", "/*", "//", "()", "^^", "^/", "/^", "^*", "*^", "-)", "+)", "*)", "/*", "^)", "-*", "-/", "-^", "+*", "+/", "+^", "(*", "(/", "(^", "/)", "*)", "+)", "-)", "^)"]
        str = "(" + str + ")";
        var open = 0;
        for (var i = 0, len = str.length; i < len; i++) {
            var curr = str[i];
            if (curr === "(") {
                open += 1;
            } else if (curr === ")") {
                open -= 1;
                if (open < 0) {
                    return false
                }
            }
            if (i > 0) {
                for (var j = 0, oplen = invalidOperatorPairs.length; j < oplen; j++) {
                    if (str[i - 1] == invalidOperatorPairs[j][0] && curr == invalidOperatorPairs[j][1]) {
                        return false
                    }
                }
            }
        }
        if (open !== 0) return false;
        var sections = str.split(/[\+\-\*\/\^\)\(]/g);
        for (i = 0, len = sections.length; i < len; i++) {
            if ((sections[i].length > 0) &&
                !(Number(sections[i]) !== NaN && isFinite(sections[i]))) {
                return false
            }
        }
        return true;
    }

    const handleEquationChange = (e) => {
        const equation = e.currentTarget.textContent.replace(/\s/g, '');
        if (isValid(equation)) {
            context.setEquation(equation);
        } else if (equation === '') { context.setResult(0) } else { console.log('skipped') }
    }


    React.useEffect(() => {
        const equation = math.parse(context.equation);
        const result = equation.evaluate();
        context.setResult(result)
    }, [context.equation])

    return (
        <Draggable cancel={'.equ-card-textarea'} defaultPosition={{ x: 10, y: 10 }} bounds={{ top: 10, left: 10, bottom: height - (height * 0.35), right: width - (width * 0.20) }}>
            <div className='equ-card'>
                <b><span onInput={e => handleEquationChange(e)} contentEditable='true' className='equ-card-textarea'></span> = {context.result}</b>
            </div>
        </Draggable>
    );
}