import React from "react";
import { VARIABLE_NAME } from "../hooks/useTree";

export const nameError = (name, taken) => {
    if (!name) return "";
    if (!VARIABLE_NAME.test(name)) return "Start with a letter, then letters, digits or _";
    if (taken.includes(name)) return `${name} already has a card here`;
    return "";
};

// The panel that slides out of a card's + button: name a new variable, pick
// one the equation still needs, or use an existing tree's value.
export const VarPopup = ({ nodeId, label, missing, actions, onClose }) => {
    const [name, setName] = React.useState("");
    const trimmed = name.trim();
    const taken = actions.inputNames(nodeId);
    const error = nameError(trimmed, taken);
    const suggestions = (missing || []).filter((n) => !taken.includes(n));
    const trees = actions.linkableTrees(nodeId);

    const add = (variable) => {
        if (!variable || nameError(variable, taken)) return;
        actions.addChild(nodeId, variable);
        onClose();
    };

    const linkTree = (rootId) => {
        actions.requestLink(rootId, nodeId, trimmed && !error ? trimmed : undefined);
        onClose();
    };

    return (
        <div
            className="var-popup no-drag"
            role="dialog"
            aria-label={`New variable for ${label}`}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
        >
            <div className="var-popup-title">
                New variable in <b>{label}</b>
            </div>
            <div className="var-popup-row">
                <input
                    className={`var-popup-input ${error ? "invalid" : ""}`}
                    autoFocus
                    placeholder="name, e.g. x, r_1, speed"
                    value={name}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") add(trimmed);
                    }}
                />
                <button
                    className="btn btn-primary"
                    disabled={!trimmed || Boolean(error)}
                    onClick={() => add(trimmed)}
                >
                    Add
                </button>
            </div>
            <div className={`var-popup-error ${error ? "shown" : ""}`}>{error || " "}</div>

            {suggestions.length > 0 && (
                <div className="var-popup-section">
                    <div className="var-popup-label">Needed by the equation</div>
                    <div className="var-popup-chips">
                        {suggestions.map((n) => (
                            <button key={n} className="chip" onClick={() => add(n)}>
                                + {n}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {trees.length > 0 && (
                <div className="var-popup-section">
                    <div className="var-popup-label">
                        Or use the value of an existing tree{trimmed && !error ? ` as ${trimmed}` : ""}
                    </div>
                    <div className="var-popup-trees">
                        {trees.map((tree) => (
                            <button
                                key={tree.rootId}
                                className="var-popup-tree"
                                onClick={() => linkTree(tree.rootId)}
                            >
                                <span>{tree.name}</span>
                                <span className="muted">= {tree.display ?? "?"}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="var-popup-hint">Enter to add · Esc to close</div>
        </div>
    );
};
