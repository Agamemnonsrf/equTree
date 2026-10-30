import React from "react";
import { nameError } from "./VarPopup";

const stopPropagation = (e) => e.stopPropagation();

// Asks which variable a card's value should become when it's linked into
// another card and its own name isn't one the equation is waiting for.
export const ConnectDialog = ({ request, actions }) => {
    const { sourceId, targetId, suggested } = request;
    const [name, setName] = React.useState(suggested);
    const trimmed = name.trim();
    const takenByOthers = actions.inputNames(targetId, sourceId);
    const error = nameError(trimmed, takenByOthers);
    const missing = ((actions.getResults()[targetId] || {}).missing || []).filter(
        (n) => !takenByOthers.includes(n)
    );
    const sourceLabel = actions.labelOf(sourceId);
    const targetLabel = actions.labelOf(targetId);
    const confirm = (variable) => {
        if (variable && !nameError(variable, takenByOthers)) {
            actions.link(sourceId, targetId, variable);
        }
    };

    return (
        <div className="dialog-backdrop" onMouseDown={stopPropagation} onClick={actions.cancelConnect}>
            <div
                className="dialog"
                role="dialog"
                aria-modal="true"
                aria-label="Connect card"
                onClick={stopPropagation}
                onKeyDown={(e) => e.key === "Escape" && actions.cancelConnect()}
            >
                <h3>
                    Use <b>{sourceLabel}</b> in <b>{targetLabel}</b>
                </h3>
                <p className="muted">
                    Which variable of {targetLabel}'s equation should it provide?
                </p>
                {missing.length > 0 && (
                    <div className="var-popup-chips">
                        {missing.map((n) => (
                            <button key={n} className="chip" onClick={() => confirm(n)}>
                                {n}
                            </button>
                        ))}
                    </div>
                )}
                <input
                    className={`var-popup-input ${error ? "invalid" : ""}`}
                    autoFocus
                    placeholder="variable name"
                    value={name}
                    spellCheck={false}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirm(trimmed)}
                />
                <div className={`var-popup-error ${error ? "shown" : ""}`}>{error || " "}</div>
                {takenByOthers.length > 0 && (
                    <p className="muted small">Already used here: {takenByOthers.join(", ")}</p>
                )}
                <div className="dialog-actions">
                    <button className="btn" onClick={actions.cancelConnect}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        disabled={!trimmed || Boolean(error)}
                        onClick={() => confirm(trimmed)}
                    >
                        Connect
                    </button>
                </div>
            </div>
        </div>
    );
};
