import React from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { EquCard } from "./EquCard";
import { PlotCard } from "./PlotCard";
import { Connectors } from "./Connectors";
import { ConnectDialog } from "./ConnectDialog";
import { ContextMenu } from "./ContextMenu";
import { Icon } from "./Icons";
import { MiniMap } from "./MiniMap";
import { useTree } from "../hooks/useTree";
import { MIN_SCALE, MAX_SCALE } from "../lib/layout";
import { dependencyIds, nodeLabel } from "../lib/tree";

const GRID_SIZE = 40;
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl+";
const REDO_KEY = isMac ? "⌘⇧Z" : "Ctrl+Y";

// Changes whenever an equation `id` depends on (or how they're wired) does,
// but not when cards are only moved, so plots don't resample needlessly.
const branchSignature = (nodes, id) =>
    dependencyIds(nodes, id)
        .map((nodeId) => {
            const n = nodes[nodeId];
            const links = (n.links || []).map((l) => `${l.id}:${l.variable}`).join(",");
            return `${nodeId}|${n.variable}|${n.latex}|${n.children.join(",")}|${links}`;
        })
        .join(";");

export const Canvas = () => {
    const {
        app,
        doc,
        results,
        sizes,
        setScale,
        highlightedIds,
        hoveredCardId,
        showMinimap,
        autoFocusId,
        linkDrag,
        connectRequest,
        groupDrag,
        cardRequest,
        contextMenu,
        history,
        lineStyle,
        lineShape,
        calculus,
        transformRef,
        canvasRef,
        actions,
    } = useTree();

    // The grid is its own layer, slightly bigger than the canvas. Panning only
    // shifts it by less than one cell with a transform, which the browser can
    // do without repainting; only zooming changes the cell size.
    const gridRef = React.useRef(null);
    const gridScale = React.useRef(null);
    const updateGrid = (s, x, y) => {
        const el = gridRef.current;
        if (!el) return;
        const cell = GRID_SIZE * s;
        if (gridScale.current !== s) {
            gridScale.current = s;
            el.style.backgroundSize = `${cell}px ${cell}px`;
        }
        const offsetX = ((x % cell) + cell) % cell;
        const offsetY = ((y % cell) + cell) % cell;
        el.style.transform = `translate3d(${offsetX - cell}px, ${offsetY - cell}px, 0)`;
    };
    const moving = (key, on) => () => actions.setMoving(key, on);

    // Focusing a field near the edge makes the browser scroll the clipped
    // wrapper, which would knock the cards out of line with the transform.
    React.useEffect(() => {
        const el = canvasRef.current;
        const resetScroll = (e) => {
            const target = e.target;
            if (target === el || target.classList?.contains("canvas-wrapper")) {
                target.scrollTop = 0;
                target.scrollLeft = 0;
            }
        };
        el.addEventListener("scroll", resetScroll, true);
        return () => el.removeEventListener("scroll", resetScroll, true);
    }, [canvasRef]);

    const linkStateOf = (id) => {
        if (!linkDrag) return null;
        if (linkDrag.fromId === id) return "source";
        if (linkDrag.targetId === id) return linkDrag.valid ? "valid" : "invalid";
        return null;
    };

    return (
        <div
            className={`canvas ${linkDrag ? "canvas-linking" : ""} ${lineStyle === "bold" ? "lines-bold" : ""}`}
            ref={canvasRef}
            onContextMenu={actions.openContextMenu}
        >
            <div className="canvas-grid" ref={gridRef} />
            <TransformWrapper
                ref={transformRef}
                limitToBounds={false}
                minScale={MIN_SCALE}
                maxScale={MAX_SCALE}
                doubleClick={{ disabled: true }}
                wheel={{ step: 0.08 }}
                panning={{ velocityDisabled: true }}
                onPanningStart={moving("pan", true)}
                onPanningStop={moving("pan", false)}
                onWheelStart={moving("wheel", true)}
                onWheelStop={moving("wheel", false)}
                onPinchingStart={moving("pinch", true)}
                onPinchingStop={moving("pinch", false)}
                onTransformed={(ref, t) => {
                    updateGrid(t.scale, t.positionX, t.positionY);
                    setScale(t.scale);
                    actions.saveView({
                        scale: t.scale,
                        positionX: t.positionX,
                        positionY: t.positionY,
                    });
                }}
            >
                <TransformComponent wrapperClass="canvas-wrapper" contentClass="canvas-content">
                    <Connectors
                        doc={doc}
                        sizes={sizes}
                        results={results}
                        highlightedIds={highlightedIds}
                        linkDrag={linkDrag}
                        lineStyle={lineStyle}
                        lineShape={lineShape}
                        actions={actions}
                    />
                    {Object.values(doc.nodes).map((node) => (
                        <EquCard
                            key={node.id}
                            node={node}
                            label={nodeLabel(doc, node.id)}
                            result={results[node.id] || {}}
                            highlighted={Boolean(
                                highlightedIds && highlightedIds.has(node.id) && node.id !== hoveredCardId
                            )}
                            autoFocus={autoFocusId === node.id}
                            linkState={linkStateOf(node.id)}
                            groupDragging={Boolean(groupDrag && groupDrag.has(node.id))}
                            request={cardRequest && cardRequest.id === node.id ? cardRequest : null}
                            calculus={calculus}
                            actions={actions}
                        />
                    ))}
                    {Object.values(doc.plots).map((plot) => (
                        <PlotCard
                            key={plot.id}
                            plot={plot}
                            targetLabel={nodeLabel(doc, plot.targetId)}
                            signature={[plot.targetId, ...(plot.extra || [])]
                                .filter((id) => doc.nodes[id])
                                .map((id) => branchSignature(doc.nodes, id))
                                .concat(calculus ? "calculus" : "")
                                .join("#")}
                            highlighted={Boolean(highlightedIds && highlightedIds.has(plot.targetId))}
                            linkState={linkStateOf(plot.id)}
                            actions={actions}
                        />
                    ))}
                </TransformComponent>
                {showMinimap && doc.trees.length > 0 && <MiniMap />}
            </TransformWrapper>
            {doc.trees.length === 0 && (
                <div className="empty-state">
                    <p>
                        {app.canvases.find((c) => c.id === app.activeId)?.name} is empty.
                    </p>
                    <button className="btn btn-primary" onClick={actions.addTree}>
                        Add a new tree
                    </button>
                </div>
            )}
            <div className="canvas-toolbar">
                <button
                    className="toolbar-btn"
                    onClick={actions.undo}
                    disabled={!history.canUndo}
                    title={`Undo (${MOD}Z)`}
                    aria-label="Undo"
                >
                    <Icon name="undo" />
                </button>
                <button
                    className="toolbar-btn"
                    onClick={actions.redo}
                    disabled={!history.canRedo}
                    title={`Redo (${REDO_KEY})`}
                    aria-label="Redo"
                >
                    <Icon name="redo" />
                </button>
            </div>
            {connectRequest && (
                <ConnectDialog
                    key={`${connectRequest.sourceId}-${connectRequest.targetId}`}
                    request={connectRequest}
                    actions={actions}
                />
            )}
            {contextMenu && <ContextMenu menu={contextMenu} onClose={actions.closeContextMenu} />}
        </div>
    );
};
