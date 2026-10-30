import React from "react";
import { flushSync } from "react-dom";

/**
 * Returns an onPointerDown handler that tracks a drag with pointer capture.
 *
 * onStart(event) runs on press; returning false ignores the press (so clicks
 * on buttons and inputs still work), anything else is passed along as the
 * drag's context. onMove(dx, dy, event, context) gets the offset from the
 * press in screen pixels. onEnd(event, context) runs on release.
 *
 * Browsers already deliver at most one pointermove per frame, so each move
 * is rendered straight away (flushSync) rather than a frame later; that's
 * what keeps a dragged card under the pointer.
 */
export const usePointerDrag = ({ onStart, onMove, onEnd }) => {
    const handlers = React.useRef();
    handlers.current = { onStart, onMove, onEnd };

    return React.useCallback((event) => {
        if (event.button !== 0) return;
        const context = handlers.current.onStart
            ? handlers.current.onStart(event)
            : {};
        if (context === false) return;

        event.preventDefault();
        event.stopPropagation();
        const element = event.currentTarget;
        const pointerId = event.pointerId;
        element.setPointerCapture(pointerId);
        const startX = event.clientX;
        const startY = event.clientY;

        const move = (e) => {
            if (e.pointerId !== pointerId || !handlers.current.onMove) return;
            flushSync(() =>
                handlers.current.onMove(e.clientX - startX, e.clientY - startY, e, context)
            );
        };
        const end = (e) => {
            if (e.pointerId !== pointerId) return;
            element.removeEventListener("pointermove", move);
            element.removeEventListener("pointerup", end);
            element.removeEventListener("pointercancel", end);
            if (element.hasPointerCapture(pointerId)) {
                element.releasePointerCapture(pointerId);
            }
            if (handlers.current.onEnd) handlers.current.onEnd(e, context);
        };
        element.addEventListener("pointermove", move);
        element.addEventListener("pointerup", end);
        element.addEventListener("pointercancel", end);
    }, []);
};
