import React from "react";
import { usePointerDrag } from "../hooks/usePointerDrag";

// Bottom-right grip that sets a card's size. Cards still grow on their own
// when their content needs more room; double-click goes back to automatic.
// onStart/onEnd bracket the gesture (so it's a single undo step).
export const ResizeHandle = ({ targetRef, min, getScale, onResize, onReset, onStart, onEnd }) => {
    const onPointerDown = usePointerDrag({
        onStart: () => {
            if (onStart) onStart();
            return {
                w: targetRef.current.offsetWidth,
                h: targetRef.current.offsetHeight,
                scale: getScale(),
            };
        },
        onMove: (dx, dy, e, start) =>
            onResize(
                Math.round(Math.max(min.w, start.w + dx / start.scale)),
                Math.round(Math.max(min.h, start.h + dy / start.scale))
            ),
        onEnd: () => onEnd && onEnd(),
    });

    return (
        <div
            className="resize-handle"
            onPointerDown={onPointerDown}
            onDoubleClick={onReset}
            title="Drag to resize · double-click for automatic size"
        />
    );
};
