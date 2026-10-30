import React from "react";
import { useTransformEffect } from "react-zoom-pan-pinch";
import { useTree } from "../hooks/useTree";
import { boundingBox, boxOf, sizeOf } from "../lib/layout";

const WIDTH = 200;
const HEIGHT = 140;
const PADDING = 60;

// An overview of every card plus the visible area. Click or drag on it to
// move the view.
export const MiniMap = () => {
    const { doc, sizes, results, viewport, transformRef, highlightedIds } =
        useTree();
    const lit = (id) => Boolean(highlightedIds && highlightedIds.has(id));
    const [view, setView] = React.useState(
        () =>
            transformRef.current?.instance.transformState || {
                scale: 1,
                positionX: 0,
                positionY: 0,
            }
    );
    const frozenFrame = React.useRef(null);

    useTransformEffect(({ state: transformState }) => {
        setView({ ...transformState });
    });

    const visible = {
        minX: -view.positionX / view.scale,
        minY: -view.positionY / view.scale,
        w: viewport.w / view.scale,
        h: viewport.h / view.scale,
    };

    const computeFrame = () => {
        const box = boundingBox(doc, sizes) || visible;
        const minX = Math.min(box.minX, visible.minX) - PADDING;
        const minY = Math.min(box.minY, visible.minY) - PADDING;
        const maxX = Math.max(box.minX + box.w, visible.minX + visible.w) + PADDING;
        const maxY = Math.max(box.minY + box.h, visible.minY + visible.h) + PADDING;
        const k = Math.min(WIDTH / (maxX - minX), HEIGHT / (maxY - minY));
        return {
            k,
            offsetX: (WIDTH - (maxX - minX) * k) / 2 - minX * k,
            offsetY: (HEIGHT - (maxY - minY) * k) / 2 - minY * k,
        };
    };

    // While dragging, keep the frame still so the map doesn't slide away
    // from under the pointer.
    const frame = frozenFrame.current || computeFrame();
    const toMap = (x, y) => [x * frame.k + frame.offsetX, y * frame.k + frame.offsetY];

    const moveTo = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const mx = event.clientX - rect.left;
        const my = event.clientY - rect.top;
        const x = (mx - frame.offsetX) / frame.k;
        const y = (my - frame.offsetY) / frame.k;
        transformRef.current?.setTransform(
            viewport.w / 2 - x * view.scale,
            viewport.h / 2 - y * view.scale,
            view.scale,
            0
        );
    };

    const [vx, vy] = toMap(visible.minX, visible.minY);

    return (
        <div className="minimap" title="Minimap: click or drag to move around">
            <svg
                width={WIDTH}
                height={HEIGHT}
                onPointerDown={(e) => {
                    frozenFrame.current = frame;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    moveTo(e);
                }}
                onPointerMove={(e) => {
                    if (frozenFrame.current) moveTo(e);
                }}
                onPointerUp={() => {
                    frozenFrame.current = null;
                }}
                onPointerCancel={() => {
                    frozenFrame.current = null;
                }}
            >
                {Object.values(doc.nodes).map((node) => {
                    const size = sizeOf(sizes, node.id);
                    const [x, y] = toMap(node.x, node.y);
                    const result = results[node.id] || {};
                    const className = [
                        "minimap-card",
                        node.parent === null && "minimap-root",
                        !result.ok && result.kind !== "empty" && "minimap-error",
                        lit(node.id) && "minimap-highlighted",
                    ]
                        .filter(Boolean)
                        .join(" ");
                    return (
                        <rect
                            key={node.id}
                            className={className}
                            x={x}
                            y={y}
                            width={Math.max(2, size.w * frame.k)}
                            height={Math.max(2, size.h * frame.k)}
                            rx={3}
                        />
                    );
                })}
                {Object.values(doc.plots).map((plot) => {
                    const box = boxOf(doc, sizes, plot.id);
                    const [x, y] = toMap(box.x, box.y);
                    const target = doc.nodes[plot.targetId];
                    return (
                        <rect
                            key={plot.id}
                            className={`minimap-card minimap-plot ${
                                target && lit(target.id) ? "minimap-highlighted" : ""
                            }`}
                            x={x}
                            y={y}
                            width={Math.max(2, box.w * frame.k)}
                            height={Math.max(2, box.h * frame.k)}
                            rx={3}
                        />
                    );
                })}
                <rect
                    className="minimap-viewport"
                    x={vx}
                    y={vy}
                    width={visible.w * frame.k}
                    height={visible.h * frame.k}
                />
            </svg>
        </div>
    );
};
