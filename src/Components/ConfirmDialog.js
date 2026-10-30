import React from "react";

const stopPropagation = (e) => e.stopPropagation();

// Asks before something is deleted. Enter confirms, Escape or a click
// outside cancels.
export const ConfirmDialog = ({ dialog, onClose }) => {
    const confirmRef = React.useRef(null);

    React.useEffect(() => {
        confirmRef.current.focus({ preventScroll: true });
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [onClose]);

    const confirm = () => {
        onClose();
        dialog.onConfirm();
    };

    return (
        <div className="dialog-backdrop dialog-backdrop-fixed" onMouseDown={stopPropagation} onClick={onClose}>
            <div
                className="dialog"
                role="alertdialog"
                aria-modal="true"
                aria-label={dialog.title}
                onClick={stopPropagation}
            >
                <h3>{dialog.title}</h3>
                {dialog.message && <p className="muted">{dialog.message}</p>}
                <div className="dialog-actions">
                    <button className="btn" onClick={onClose}>
                        Cancel
                    </button>
                    <button ref={confirmRef} className="btn btn-danger" onClick={confirm}>
                        {dialog.confirmLabel || "Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
};
