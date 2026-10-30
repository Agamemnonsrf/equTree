import React from "react";

const stop = (e) => e.stopPropagation();

// A text input for renaming in place. Enter or leaving the field saves,
// Escape cancels. `validate` returns an error message, or "" when the name
// is fine; invalid names are shown in red and never saved.
export const InlineRename = ({ initial, validate, onCommit, onCancel, className = "" }) => {
    const [value, setValue] = React.useState(initial);
    const trimmed = value.trim();
    const error = trimmed && validate ? validate(trimmed) : "";

    const commit = () => {
        if (!trimmed || error || trimmed === initial) onCancel();
        else onCommit(trimmed);
    };

    return (
        <input
            className={`inline-rename ${error ? "invalid" : ""} ${className}`}
            autoFocus
            value={value}
            size={Math.max(4, value.length + 1)}
            title={error}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && !error) commit();
                if (e.key === "Escape") onCancel();
            }}
            onClick={stop}
            onDoubleClick={stop}
            onPointerDown={stop}
        />
    );
};
