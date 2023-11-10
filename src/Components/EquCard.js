import React from "react";
import "../App.css";
import Draggable from "react-draggable";

import * as math from "mathjs";
import { useXarrow, Xwrapper } from "react-xarrows";
import { CustomArrow } from "./CustomArrow";
import { useTree } from "../hooks/useTree";
import { useTransformContext } from "react-zoom-pan-pinch";
import { addStyles, EditableMathField, StaticMathField } from "react-mathquill";

addStyles();

export const EquCard = (props) => {
    const [arrowTrigger, setArrowTrigger] = React.useState(false);
    const [childrenStatus, setChildrenStatus] = React.useState(true);
    const [latex, setLatex] = React.useState("");
    const {
        isLeaf,
        setResult,
        resolveChildren,
        addNodeStateful,
        removeNode,
        getNodeLevel,
        getChildIndex,
        childrenSatisfied,
        getChildren,
    } = useTree();
    const updateArrow = useXarrow();
    const defaultPosition = { x: 200, y: 100 };

    const transformContext = useTransformContext();
    const [newVar, setNewVar] = React.useState("");
    const [isNamingVar, setIsNamingVar] = React.useState(false);
    const [localResult, setLocalResult] = React.useState("");
    const [nameVarWarning, setNameVarWarning] = React.useState(false);
    const [isEditing, setIsEditing] = React.useState(true);
    const [isEditingBranch, setIsEditingBranch] = React.useState(true);
    const [isSpanRefFocused, setIsSpanRefFocused] = React.useState(false);
    const nodeRef = React.useRef(null);
    const spanRef = React.useRef(null);
    const newVarRef = React.useRef(null);

    React.useEffect(() => {
        updateArrow();
    }, [arrowTrigger]);

    React.useEffect(() => {
        if (!isEditing) {
            const equationUnparsed = latexToEquation(latex);
            const equationClean = equationUnparsed.replace(/\s/g, "");
            //first try making it so that when done editing the root, its children also get
            //stopped editing, try that with the updateArrow method, But make sure that
            //the child cards get resolved first.
            if (!isLeaf(props.id)) {
                const varsResults = resolveChildren(props.id);
                const scope = {};
                varsResults.forEach((varPair) => {
                    scope[varPair[0]] = varPair[1];
                });
                const equationParsed = math.compile(equationClean);
                const result = equationParsed.evaluate(scope);
                setLocalResult(result);
                setResult(props.id, result);
                setIsEditingBranch(false);
            }
        }
    }, [isEditing]);

    //ITS THIS GUY'S FAULT THAT I CANT SAY SQRT() IN THE EQUATION
    const isValidEquation = (str) => {
        const invalidOperatorPairs = [
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

        const functionNames = ["sqrt"];

        const functionRegex = new RegExp(
            `(${functionNames.join("|")})\\(`,
            "g"
        );

        const equation = `(${str})`.replace(functionRegex, "1");

        let open = 0;

        for (let i = 0, len = equation.length; i < len; i++) {
            const curr = equation[i];

            if (curr === "(") {
                open += 1;
            } else if (curr === ")") {
                open -= 1;

                if (open < 0) {
                    return false;
                }
            }

            if (i > 0) {
                for (
                    let j = 0, oplen = invalidOperatorPairs.length;
                    j < oplen;
                    j++
                ) {
                    if (
                        equation[i - 1] === invalidOperatorPairs[j][0] &&
                        curr === invalidOperatorPairs[j][1]
                    ) {
                        return false;
                    }
                }
            }
        }

        if (open !== 0) {
            return false;
        }

        const sections = equation.split(/[\+\-\*\/\^\)\(]/g);

        for (let i = 0, len = sections.length; i < len; i++) {
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

    const isVariable = (str) => {
        const match = str.match(/^[a-zA-Z]+$/g);
        if (match) {
            return true;
        }
    };

    const getVariables = (str) => {
        const sections = str.split(/[\+\-\*\/\^\)\(]/g);
        const sectionsFiltered = sections.filter((section) =>
            isVariable(section)
        );

        return sectionsFiltered;
    };

    const containsVariables = (str) => {
        const sections = str.split(/[\+\-\*\/\^\)\(]/g);
        const sectionsFiltered = sections.filter((section) =>
            isVariable(section)
        );
        if (sectionsFiltered.length > 0) {
            return true;
        }
    };

    const handleEquationChange = (e) => {
        const equationClean = e.replace(/\s/g, "");

        if (isValidEquation(equationClean)) {
            const result = math.evaluate(equationClean);
            setLocalResult(result);
            setResult(props.id, result);
            console.log("resolving success");
        }

        handleChildrenStatus(equationClean);
    };

    const handleNameVar = (e) => {
        const name = e.currentTarget.textContent;
        //allow only letters and capital letters
        if (name.match(/^[a-zA-Z]+$/g)) {
            setNewVar(name);
        }
    };

    const handleChildrenStatus = (str) => {
        if (containsVariables(str)) {
            const vars = getVariables(str);
            if (childrenSatisfied(props.id, vars)) {
                setChildrenStatus(true);
            } else {
                setChildrenStatus(false);
            }
        } else {
            setChildrenStatus(true);
        }
    };

    const handleNameVarDone = () => {
        const breh = newVarRef.current.textContent;
        if (breh === "") return;
        if (breh.match(/^[a-zA-Z]+$/g)) {
            const equationUnparsed = latexToEquation(latex);
            const equationClean = equationUnparsed.replace(/\s/g, "");
            addNodeStateful(props.id, breh);
            setIsNamingVar(false);
            setNameVarWarning(false);
            handleChildrenStatus(equationClean);
        } else {
            setNameVarWarning(true);
        }
        setNewVar("");
    };

    const handleDelete = () => {
        const equationUnparsed = latexToEquation(latex);
        const equationClean = equationUnparsed.replace(/\s/g, "");
        removeNode(props.id);
        handleChildrenStatus(equationClean);
    };

    const latexToEquation = (latex) => {
        const equation = latex
            .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
            .replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)")
            .replace(/\\left/g, "")
            .replace(/\\right/g, "")
            .replace(/\\cdot/g, "*")
            .replace(/\\times/g, "*")
            .replace(/\\div/g, "/")
            .replace(/\\pm/g, "+-")
            .replace(/\\mp/g, "-+")
            .replace(/\\pi/g, "pi")
            .replace(/\\infty/g, "Infinity")
            .replace(/\\sin/g, "sin")
            .replace(/\\cos/g, "cos")
            .replace(/\\tan/g, "tan")
            .replace(/\\cot/g, "cot")
            .replace(/\\sec/g, "sec")
            .replace(/\\csc/g, "csc")
            .replace(/\\log/g, "log")
            .replace(/\\ln/g, "ln")
            .replace(/\\exp/g, "exp")
            .replace(/\\abs/g, "abs")
            .replace(/\\frac/g, "frac")
            .replace(/(\d+)\^(\d+)/g, "($1^$2)")
            .replace(/{/g, "(")
            .replace(/}/g, ")");

        return equation;
    };
    return (
        <>
            <Draggable
                scale={transformContext.transformState.scale}
                nodeRef={nodeRef}
                cancel={
                    ".equ-card-textarea, .equ-card-textarea-container, .name-var-popup"
                }
                defaultPosition={
                    props.variable === "root"
                        ? defaultPosition
                        : {
                              x: getNodeLevel(props.id) * 400,
                              y: getChildIndex(props.id) * 200,
                          }
                }
                onDrag={() => {
                    updateArrow();
                    props.setArrowTrigger &&
                        props.setArrowTrigger((prev) => !prev);
                    props.setIsDragging(true);
                }}
                onStop={() => {
                    updateArrow();
                    props.setArrowTrigger &&
                        props.setArrowTrigger((prev) => !prev);
                    props.setIsDragging(false);
                }}
            >
                <div
                    className="equ-card unselectable"
                    ref={nodeRef}
                    id={props.id}
                    key={props.id}
                    style={
                        !childrenStatus && {
                            boxShadow: "0 0 10px 5px rgba(255,0,0,1.0)",
                        }
                    }
                >
                    {props.index}
                    <div className="equCard-varBox unselectable">
                        {props.variable}
                    </div>
                    <div className="coverUp" />
                    {props.variable !== "root" && isEditing && (
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
                    {isEditing && (
                        <svg
                            className="svg-right-middle"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 448 512"
                            onClick={() => {
                                setIsNamingVar(!isNamingVar);
                                newVarRef.current.focus();
                            }}
                            name="plus"
                        >
                            <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z" />
                        </svg>
                    )}
                    <div
                        className={`name-var-popup ${isNamingVar && "expand"}`}
                    >
                        <span
                            className="name-var-popup-input"
                            tabIndex="1"
                            contentEditable
                            ref={newVarRef}
                            style={
                                nameVarWarning
                                    ? { backgroundColor: "red" }
                                    : { backgroundColor: "rgb(180, 180, 180)" }
                            }
                            suppressContentEditableWarning
                            onClick={() => newVarRef.current.focus()}
                            onChange={handleNameVar}
                            //New Var Popup
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
                    <div
                        className="equ-card-textarea-container"
                        style={{
                            textAlign: "center",
                            position: "relative",
                            height: "auto",
                            minWidth: " 60%",
                            width: "auto",
                            left: "0px",
                            bottom: "50px",
                            right: "0px",
                        }}
                    >
                        {isEditing ? (
                            <EditableMathField
                                latex={latex}
                                className="equ-card-textarea"
                                onChange={(mathField) => {
                                    setLatex(mathField.latex());
                                    handleEquationChange(
                                        latexToEquation(mathField.latex())
                                    );
                                    console.log(
                                        latexToEquation(mathField.latex())
                                    );
                                }}
                            />
                        ) : (
                            <StaticMathField
                                className="equ-card-textarea"
                                style={{
                                    backgroundColor: isEditing
                                        ? "rgb(200, 200, 200)"
                                        : "transparent",
                                }}
                            >
                                {latex}
                            </StaticMathField>
                        )}

                        <span className="result unselectable">
                            <br />= {localResult ? localResult : "0"}
                        </span>
                    </div>
                    {isEditing ? (
                        <svg
                            className="svg"
                            onClick={() =>
                                childrenStatus && setIsEditing(!isEditing)
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
                            onClick={() => setIsEditing(!isEditing)}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 512 512"
                            name="edit"
                        >
                            <path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.8 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z" />
                        </svg>
                    )}
                </div>
            </Draggable>
            {getChildren(props.id).map((child) => {
                return (
                    <EquCard
                        key={child.id}
                        id={child.id}
                        variable={child.value}
                        parent={child.parent}
                        children={child.children}
                        arrowTrigger={arrowTrigger}
                        setArrowTrigger={setArrowTrigger}
                        childrenStatus={childrenStatus}
                        setChildrenStatus={setChildrenStatus}
                        setIsDragging={props.setIsDragging}
                    />
                );
            })}
            {getChildren(props.id).map((child) => {
                return (
                    <CustomArrow
                        start={props.id}
                        end={child.id}
                        scale={transformContext.transformState.scale}
                        key={child.id + props.id}
                    />
                );
            })}
        </>
    );
};
