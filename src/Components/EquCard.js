import React from "react";
import { addStyles, EditableMathField, StaticMathField } from "react-mathquill";
import { usePointerDrag } from "../hooks/usePointerDrag";
import { MIN_CARD_SIZE } from "../lib/layout";
import { Icon } from "./Icons";
import { InlineRename } from "./InlineRename";
import { ResizeHandle } from "./ResizeHandle";
import { VarPopup, nameError } from "./VarPopup";

addStyles();

const OPERATOR_NAMES =
    "sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh " +
    "ln log exp max min gcd abs floor ceil round";

// Presses on these never start a card drag.
const INTERACTIVE = "button, input, select, textarea, .no-drag, .mq-editable-field";

const stopPropagation = (e) => e.stopPropagation();

const doneBlockedReason = (result) => {
    if (result.error) return result.error;
    if (result.unused) return "Its parent's equation doesn't use this variable";
    if (result.duplicate) return "Another card already defines this variable";
    if (result.strayLinks && result.strayLinks.length > 0) {
        return "It's linked to values its equation doesn't use";
    }
    return "A card further down the branch isn't solved yet";
};

const EquCardView = ({
    node,
    label,
    result,
    highlighted,
    autoFocus,
    linkState,
    groupDragging,
    request,
    calculus,
    actions,
}) => {
    const isRoot = node.parent === null;
    const locked = !node.editing;
    const anchorRef = React.useRef(null);
    const cardRef = React.useRef(null);
    const tabRef = React.useRef(null);
    const fieldRef = React.useRef(null);
    const [isNamingVar, setIsNamingVar] = React.useState(false);
    const [renaming, setRenaming] = React.useState(false);
    const [dragging, setDragging] = React.useState(false);

    // Report the card's (and its tab's) size so connectors and layout can
    // use it.
    React.useLayoutEffect(() => {
        const el = cardRef.current;
        const tab = tabRef.current;
        const report = () =>
            actions.reportSize(node.id, el.offsetWidth, el.offsetHeight, tab.offsetWidth);
        report();
        const observer = new ResizeObserver(report);
        observer.observe(el);
        observer.observe(tab);
        return () => observer.disconnect();
    }, [node.id, actions]);

    // Keep touches on a card from panning the canvas; mouse presses are
    // stopped through onMouseDown below.
    React.useEffect(() => {
        const el = anchorRef.current;
        el.addEventListener("touchstart", stopPropagation);
        return () => el.removeEventListener("touchstart", stopPropagation);
    }, []);

    React.useEffect(() => {
        if (locked) setIsNamingVar(false);
    }, [locked]);

    // the right-click menu can ask for the new-variable panel or a rename
    React.useEffect(() => {
        if (!request) return;
        if (request.kind === "popup" && !locked) setIsNamingVar(true);
        if (request.kind === "rename") setRenaming(true);
        actions.clearCardRequest();
    }, [request, locked, actions]);

    // Dragging moves the card; Shift+drag moves it with everything below it
    // (the whole tree, from a root). Either way it's one undo step.
    const startDrag = usePointerDrag({
        onStart: (e) => {
            if (e.target.closest(INTERACTIVE)) return false;
            setDragging(true);
            actions.setMoving("drag", true);
            actions.beginGesture();
            const scale = actions.getScale();
            if (!e.shiftKey) return { scale, x: node.x, y: node.y };
            const ids = actions.branchIds(node.id);
            const doc = actions.getDoc();
            const starts = Object.fromEntries(
                ids.map((id) => {
                    const item = doc.nodes[id] || doc.plots[id];
                    return [id, { x: item.x, y: item.y }];
                })
            );
            actions.setGroupDrag(ids);
            return { scale, starts };
        },
        onMove: (dx, dy, e, start) => {
            const mx = dx / start.scale;
            const my = dy / start.scale;
            if (!start.starts) {
                actions.moveItem(node.id, start.x + mx, start.y + my);
                return;
            }
            const positions = {};
            Object.entries(start.starts).forEach(([id, p]) => {
                positions[id] = { x: p.x + mx, y: p.y + my };
            });
            actions.moveItems(positions);
        },
        onEnd: (e, start) => {
            setDragging(false);
            actions.setMoving("drag", false);
            actions.endGesture();
            if (start.starts) actions.setGroupDrag(null);
        },
    });

    // The plug on the tab: drag it onto another card to use this card's value
    // there as well. A card can feed any number of equations.
    const startLink = usePointerDrag({
        onStart: (e) => {
            actions.startLink(node.id, e.clientX, e.clientY);
            return {};
        },
        onMove: (dx, dy, e) => actions.updateLink(e.clientX, e.clientY),
        onEnd: () => actions.endLink(),
    });

    const canFinish = Boolean(result.subtreeOk);
    const finishRef = React.useRef();
    finishRef.current = () => {
        if (canFinish) actions.finishBranch(node.id);
    };

    // MathQuill only reads its config once, so it reaches the latest
    // handlers through refs.
    const mathConfig = React.useMemo(
        () => ({
            // calculus mode: typing int, sum, prod, partial, infty or lim makes the symbol
            autoCommands: `pi sqrt nthroot theta${calculus ? " int sum prod partial infty" : ""}`,
            autoOperatorNames: `${OPERATOR_NAMES}${calculus ? " lim" : ""}`,
            handlers: {
                edit: () => {
                    if (fieldRef.current) {
                        actions.setLatex(node.id, fieldRef.current.latex());
                    }
                },
                enter: () => finishRef.current(),
            },
        }),
        [node.id, actions, calculus]
    );

    // Clicks anywhere around the equation (not just on the typed math) put
    // the cursor in the field.
    const focusField = (e) => {
        if (locked || !fieldRef.current || e.target.closest(".mq-editable-field")) return;
        e.preventDefault();
        fieldRef.current.focus();
        fieldRef.current.moveToRightEnd();
    };

    const commitRename = (name) => {
        if (isRoot) actions.renameTree(node.treeId, name);
        else actions.renameNode(node.id, name);
        setRenaming(false);
    };

    const showProblemGlow =
        result.kind === "missing" || result.unused || result.duplicate;
    const cardClass = [
        "equ-card",
        "unselectable",
        locked ? "equ-card-locked" : "equ-card-editing",
        showProblemGlow && "equ-card-problem",
        highlighted && "equ-card-highlighted",
        linkState && `equ-card-link-${linkState}`,
        dragging && "equ-card-dragging",
        groupDragging && "equ-card-group-dragging",
    ]
        .filter(Boolean)
        .join(" ");

    const renderResult = () => {
        if (result.display !== undefined) {
            return <span className="result-value">= {result.display}</span>;
        }
        if (result.kind === "parse" || result.kind === "eval") {
            return <span className="result-error">{result.error}</span>;
        }
        if (result.kind === "child") {
            return <span className="result-muted">{result.error}</span>;
        }
        return <span className="result-muted">= ?</span>;
    };

    return (
        <div
            className={`card-anchor ${isNamingVar || renaming || dragging ? "raised" : ""}`}
            ref={anchorRef}
            style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
            onMouseDown={stopPropagation}
        >
            <div
                className={cardClass}
                ref={cardRef}
                data-id={node.id}
                style={{ minWidth: node.w || undefined, minHeight: node.h || undefined }}
                onPointerDown={locked ? startDrag : undefined}
                onMouseEnter={(e) => e.buttons === 0 && actions.setHoveredCard(node.id)}
                onMouseLeave={() => actions.setHoveredCard(null)}
                title={
                    locked
                        ? "Locked: drag from anywhere to move (Shift+drag moves the whole branch)"
                        : undefined
                }
            >
                <div
                    className="equCard-varBox drag-handle"
                    ref={tabRef}
                    onPointerDown={locked ? undefined : startDrag}
                    onDoubleClick={() => setRenaming(true)}
                    title="Drag to move · Shift+drag to move the whole branch · double-click to rename"
                >
                    <Icon name={locked ? "lock" : "grip"} className="tab-icon" />
                    {renaming ? (
                        <InlineRename
                            initial={label}
                            validate={
                                isRoot
                                    ? undefined
                                    : (name) => nameError(name, actions.siblingNames(node.id))
                            }
                            onCommit={commitRename}
                            onCancel={() => setRenaming(false)}
                        />
                    ) : (
                        <span className="tab-label">{label}</span>
                    )}
                    {result.unused && (
                        <span className="badge" title="Its parent's equation doesn't use this variable">
                            unused
                        </span>
                    )}
                    {result.duplicate && (
                        <span className="badge" title="Another card already defines this variable">
                            duplicate
                        </span>
                    )}
                    <span
                        className="link-port no-drag"
                        onPointerDown={startLink}
                        title={`Drag onto another card to use ${label || "this"} there too`}
                    />
                </div>

                <div className="equ-card-body">
                    <div className="equ-field-container" onMouseDown={focusField}>
                        <div className={`equ-field ${locked ? "locked" : ""}`}>
                            {locked ? (
                                <StaticMathField className="equ-math">{node.latex}</StaticMathField>
                            ) : (
                                <EditableMathField
                                    // MathQuill reads its config once, so a new mode needs a new field
                                    key={calculus ? "calculus" : "plain"}
                                    latex={node.latex}
                                    className="equ-math"
                                    config={mathConfig}
                                    mathquillDidMount={(field) => {
                                        fieldRef.current = field;
                                        if (autoFocus) field.focus();
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    <div className="result">{renderResult()}</div>

                    {!locked && result.missing && result.missing.length > 0 && (
                        <div className="missing no-drag">
                            <span>Needs</span>
                            {result.missing.map((name) => (
                                <span key={name} className="chip-split">
                                    <button
                                        className="chip"
                                        title={`Add a card for ${name}`}
                                        onClick={() => actions.addChild(node.id, name)}
                                    >
                                        + {name}
                                    </button>
                                    <button
                                        className="chip chip-remove"
                                        title={`Remove ${name} from the equation`}
                                        aria-label={`Remove ${name} from the equation`}
                                        onClick={() => actions.removeFromEquation(node.id, name)}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                </div>

                <div className="equ-card-actions">
                    {locked ? (
                        <button
                            key="edit"
                            className="icon-btn icon-pop"
                            onClick={() => actions.editNode(node.id)}
                            title="Unlock to edit"
                        >
                            <Icon name="edit" />
                        </button>
                    ) : (
                        <button
                            key="done"
                            className="icon-btn icon-pop"
                            disabled={!canFinish}
                            onClick={() => finishRef.current()}
                            title={canFinish ? "Done (Enter): lock this branch" : doneBlockedReason(result)}
                        >
                            <Icon name="check" />
                        </button>
                    )}
                    <span className="spacer" />
                    <button
                        className="icon-btn"
                        onClick={() => actions.addPlot(node.id)}
                        title="Plot this equation"
                    >
                        <Icon name="chart" />
                    </button>
                    {!locked && !isRoot && (
                        <button
                            className="icon-btn"
                            onClick={() => actions.detachNode(node.id)}
                            title="Disconnect into a tree of its own"
                        >
                            <Icon name="unlink" />
                        </button>
                    )}
                    {!locked && (
                        <button
                            className={`icon-btn plus-btn ${isNamingVar ? "open" : ""}`}
                            onClick={() => setIsNamingVar((open) => !open)}
                            title={isNamingVar ? "Close" : "Add a variable"}
                            aria-expanded={isNamingVar}
                        >
                            <Icon name="plus" />
                        </button>
                    )}
                    {!locked && !isRoot && (
                        <button
                            className="icon-btn icon-btn-danger"
                            onClick={() => actions.confirmDeleteNode(node.id)}
                            title={`Delete ${node.variable}`}
                        >
                            <Icon name="trash" />
                        </button>
                    )}
                </div>

                {isNamingVar && (
                    <VarPopup
                        nodeId={node.id}
                        label={label}
                        missing={result.missing}
                        actions={actions}
                        onClose={() => setIsNamingVar(false)}
                    />
                )}

                <ResizeHandle
                    targetRef={cardRef}
                    min={MIN_CARD_SIZE}
                    getScale={actions.getScale}
                    onResize={(w, h) => actions.resizeItem(node.id, w, h)}
                    onReset={() => actions.resizeItem(node.id, null, null)}
                    onStart={actions.beginGesture}
                    onEnd={actions.endGesture}
                />
            </div>
        </div>
    );
};

export const EquCard = React.memo(EquCardView);
