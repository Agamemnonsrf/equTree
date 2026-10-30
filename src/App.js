import React from "react";
import uuid from "react-uuid";
import { Canvas } from "./Components/Canvas";
import { SideBar } from "./Components/SideBar";
import "./App.css";
import { Context } from "./context/context";
import { useAppState, getSubtreeIds, getTreeIds, VARIABLE_NAME } from "./hooks/useTree";
import { useTheme } from "./hooks/useTheme";
import { usePreference } from "./hooks/usePreference";
import { evaluateAll, setCalculusMode } from "./lib/evaluate";
import { defaultPlotFor } from "./lib/plot";
import { removeVariable } from "./lib/latexEdit";
import { ConfirmDialog } from "./Components/ConfirmDialog";
import { consumersOf, dependencyIds, dependsOn, inputsOf, nodeLabel } from "./lib/tree";
import {
    boundingBox,
    childPosition,
    DEFAULT_PLOT_SIZE,
    DEFAULT_SIZE,
    MIN_SCALE,
    newTreePosition,
    plotPosition,
    TAB_HEIGHT,
    tidyLayout,
    withPositions,
} from "./lib/layout";

const sameResult = (a, b) =>
    Boolean(a && b) &&
    a.display === b.display &&
    a.error === b.error &&
    a.kind === b.kind &&
    a.unused === b.unused &&
    a.duplicate === b.duplicate &&
    a.ok === b.ok &&
    a.subtreeOk === b.subtreeOk &&
    (a.missing || []).join() === (b.missing || []).join() &&
    (a.strayLinks || []).join() === (b.strayLinks || []).join() &&
    (a.unusedInputs || []).map((i) => i.id).join() ===
        (b.unusedInputs || []).map((i) => i.id).join();

// Everything about the cards that affects the math, but not where they sit,
// so dragging a card doesn't re-evaluate every equation.
const mathKeyOf = (nodes) =>
    Object.values(nodes)
        .map(
            (n) =>
                `${n.id}|${n.variable}|${n.latex}|${n.children.join(",")}|${(n.links || [])
                    .map((l) => `${l.id}:${l.variable}`)
                    .join(",")}`
        )
        .join(";");

const uniqueName = (taken, base) => {
    let n = taken.length + 1;
    while (taken.includes(`${base} ${n}`)) n++;
    return `${base} ${n}`;
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl+";

function App() {
    const [app, dispatch, history] = useAppState();
    const doc = app.docs[app.activeId];
    const [themePreference, setThemePreference] = useTheme();
    const [lineStyle, setLineStyle] = usePreference("equtree:lines", "normal", ["normal", "bold"]);
    // curved is the default again; a new key so the earlier default resets
    const [lineShape, setLineShape] = usePreference("equtree:line-shape:v2", "curved", ["curved", "angled"]);
    const [calculusPreference, setCalculusPreference] = usePreference("equtree:calculus", "off", ["off", "on"]);
    const calculus = calculusPreference === "on";
    // calculus notation is read only in calculus mode (see lib/evaluate.js)
    setCalculusMode(calculus);

    // Results that didn't change keep their old object, so memoized cards
    // whose result is unchanged skip re-rendering.
    const previousResults = React.useRef({});
    const { trees, nodes } = doc;
    const mathKey = mathKeyOf(nodes);
    const results = React.useMemo(() => {
        const fresh = evaluateAll({ trees, nodes });
        const previous = previousResults.current;
        Object.keys(fresh).forEach((id) => {
            if (sameResult(fresh[id], previous[id])) fresh[id] = previous[id];
        });
        previousResults.current = fresh;
        return fresh;
        // `nodes` changes on every drag; mathKey only when the math does
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trees, mathKey, calculus]);

    const [sizes, setSizes] = React.useState({});
    const [scale, setScale] = React.useState(1);
    const [viewport, setViewport] = React.useState({ w: 0, h: 0 });
    const [highlightedTreeId, setHighlightedTreeId] = React.useState(null);
    const [showMinimap, setShowMinimap] = React.useState(true);
    const [autoFocusId, setAutoFocusId] = React.useState(null);
    const [linkDrag, setLinkDrag] = React.useState(null);
    const [connectRequest, setConnectRequest] = React.useState(null);
    // cards moving together while one of them is Shift-dragged
    const [groupDrag, setGroupDrag] = React.useState(null);
    // asks a card to open its new-variable panel or start renaming
    const [cardRequest, setCardRequest] = React.useState(null);
    const [contextMenu, setContextMenu] = React.useState(null);
    // { title, message, confirmLabel, onConfirm } while asking before a delete
    const [confirmDialog, setConfirmDialog] = React.useState(null);
    const [hoveredCardId, setHoveredCardId] = React.useState(null);
    const transformRef = React.useRef(null);
    const canvasRef = React.useRef(null);

    // Hovering a card highlights every card its value is computed from, down
    // to the leaves; hovering a tree in the sidebar does the same for its
    // root, including cards from other trees whose values it uses.
    const highlightedIds = React.useMemo(() => {
        if (hoveredCardId && nodes[hoveredCardId]) {
            return new Set(dependencyIds(nodes, hoveredCardId));
        }
        const tree = trees.find((t) => t.id === highlightedTreeId);
        return tree && nodes[tree.rootId] ? new Set(dependencyIds(nodes, tree.rootId)) : null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hoveredCardId, highlightedTreeId, trees, mathKey]);

    // Actions read the latest state through refs so they can stay stable,
    // which lets memoized cards ignore unrelated updates.
    const latest = React.useRef();
    latest.current = { app, doc, sizes, viewport, showMinimap, results, linkDrag, history };

    React.useEffect(() => {
        const el = canvasRef.current;
        const observer = new ResizeObserver(() =>
            setViewport({ w: el.clientWidth, h: el.clientHeight })
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const actions = React.useMemo(() => {
        const getDoc = () => latest.current.doc;
        const getTransform = () =>
            transformRef.current?.instance.transformState || {
                scale: 1,
                positionX: 0,
                positionY: 0,
            };

        const clientToContent = (clientX, clientY) => {
            const rect = canvasRef.current.getBoundingClientRect();
            const { scale, positionX, positionY } = getTransform();
            return {
                x: (clientX - rect.left - positionX) / scale,
                y: (clientY - rect.top - positionY) / scale,
            };
        };

        const fitBox = (box, maxScale = 1) => {
            const { w, h } = latest.current.viewport;
            if (!box || !transformRef.current || !w || !h) return;
            const fit = Math.min((w - 120) / box.w, (h - 120) / box.h);
            const s = Math.min(Math.max(fit, MIN_SCALE), maxScale);
            transformRef.current.setTransform(
                w / 2 - (box.minX + box.w / 2) * s,
                h / 2 - (box.minY + box.h / 2) * s,
                s,
                400,
                "easeOut"
            );
        };

        // Pans just enough to bring a card fully into view, keeping clear of
        // the minimap in the bottom right corner.
        const ensureVisible = (x, y, w, h) => {
            const { viewport, showMinimap } = latest.current;
            const t = transformRef.current;
            if (!t || !viewport.w) return;
            const { scale, positionX, positionY } = getTransform();
            const pad = 60;
            const bottomPad = showMinimap ? 190 : pad;
            const left = positionX + x * scale;
            const top = positionY + (y - TAB_HEIGHT) * scale;
            const right = positionX + (x + w) * scale;
            const bottom = positionY + (y + h) * scale;
            let dx = 0;
            let dy = 0;
            if (right > viewport.w - pad) dx = viewport.w - pad - right;
            if (left + dx < pad) dx = pad - left;
            if (bottom > viewport.h - bottomPad) dy = viewport.h - bottomPad - bottom;
            if (top + dy < pad) dy = pad - top;
            if (dx || dy) {
                t.setTransform(positionX + dx, positionY + dy, scale, 300, "easeOut");
            }
        };

        // Variable names a card already gets from its children and links.
        const inputNames = (cardId, exceptId) => {
            const doc = getDoc();
            const card = doc.nodes[cardId];
            if (!card) return [];
            return inputsOf(doc.nodes, card)
                .filter((input) => input.id !== exceptId)
                .map((input) => input.variable);
        };

        const canLink = (sourceId, consumerId) => {
            const { nodes } = getDoc();
            const consumer = nodes[consumerId];
            if (!nodes[sourceId] || !consumer || sourceId === consumerId) return false;
            if (inputsOf(nodes, consumer).some((input) => input.id === sourceId)) return false;
            return !dependsOn(nodes, sourceId, consumerId);
        };

        const link = (sourceId, consumerId, variable) => {
            setConnectRequest(null);
            if (!canLink(sourceId, consumerId)) return;
            dispatch({ type: "LINK", sourceId, consumerId, variable });
        };

        // Links directly when the name is obviously right (it was asked for,
        // or it's a variable the equation is waiting on); otherwise asks.
        const requestLink = (sourceId, consumerId, preferred) => {
            if (!canLink(sourceId, consumerId)) return;
            const name = preferred || nodeLabel(getDoc(), sourceId);
            const free = VARIABLE_NAME.test(name) && !inputNames(consumerId).includes(name);
            const missing = (latest.current.results[consumerId] || {}).missing || [];
            if (free && (preferred || missing.includes(name))) {
                link(sourceId, consumerId, name);
                return;
            }
            setConnectRequest({
                sourceId,
                targetId: consumerId,
                suggested: free ? name : missing[0] || "",
            });
        };

        const detachNode = (id) => {
            const doc = getDoc();
            const node = doc.nodes[id];
            if (!node || node.parent === null) return;
            const taken = doc.trees.map((t) => t.name);
            const name = taken.includes(node.variable)
                ? uniqueName(taken, node.variable)
                : node.variable;
            dispatch({ type: "DETACH", id, treeId: uuid(), name });
        };

        const finishBranch = (id) =>
            dispatch({
                type: "SET_EDITING",
                ids: getSubtreeIds(getDoc().nodes, id),
                editing: false,
            });
        const editNode = (id) => dispatch({ type: "SET_EDITING", ids: [id], editing: true });

        const addPlot = (targetId) => {
            const { doc, sizes } = latest.current;
            const { x, y } = plotPosition(doc, sizes, targetId);
            const plot = { id: uuid(), targetId, ...defaultPlotFor(doc.nodes, targetId), x, y };
            dispatch({ type: "ADD_PLOT", plot });
            ensureVisible(x, y, DEFAULT_PLOT_SIZE.w, DEFAULT_PLOT_SIZE.h);
        };

        // Every delete asks first, in the app's own dialog.
        const askConfirm = (dialog) => setConfirmDialog(dialog);

        const confirmDeleteNode = (id) => {
            const doc = getDoc();
            const node = doc.nodes[id];
            if (!node || node.parent === null) return;
            const below = getSubtreeIds(doc.nodes, id).length - 1;
            const parentLabel = nodeLabel(doc, node.parent);
            const alsoUsedBy = consumersOf(doc.nodes, id)
                .map((c) => nodeLabel(doc, c))
                .filter((l) => l !== parentLabel);
            const details = [
                below > 0 && `${below} ${below === 1 ? "card" : "cards"} below it will be deleted too.`,
                alsoUsedBy.length > 0 && `${alsoUsedBy.join(", ")} will lose the value it shares.`,
                `${parentLabel} will need ${node.variable} again.`,
            ].filter(Boolean);
            askConfirm({
                title: `Delete "${node.variable}"?`,
                message: details.join(" "),
                confirmLabel: "Delete",
                onConfirm: () => dispatch({ type: "REMOVE_NODE", id }),
            });
        };

        const confirmRemoveTree = (treeId) => {
            const doc = getDoc();
            const tree = doc.trees.find((t) => t.id === treeId);
            if (!tree) return;
            const count = getSubtreeIds(doc.nodes, tree.rootId).length;
            askConfirm({
                title: `Delete "${tree.name}"?`,
                message: `Its ${count} ${count === 1 ? "card" : "cards"} and their plots will be deleted.`,
                confirmLabel: "Delete tree",
                onConfirm: () => {
                    setHighlightedTreeId(null);
                    dispatch({ type: "REMOVE_TREE", treeId });
                },
            });
        };

        const confirmRemovePlot = (id) =>
            askConfirm({
                title: "Remove this plot?",
                message: "The equations it shows stay as they are.",
                confirmLabel: "Remove",
                onConfirm: () => dispatch({ type: "REMOVE_PLOT", id }),
            });

        const confirmRemoveCanvas = (id) => {
            const { app } = latest.current;
            const canvas = app.canvases.find((c) => c.id === id);
            if (!canvas || app.canvases.length <= 1) return;
            const count = app.docs[id].trees.length;
            askConfirm({
                title: `Delete the canvas "${canvas.name}"?`,
                message: `Its ${count} ${count === 1 ? "tree" : "trees"} will be deleted.`,
                confirmLabel: "Delete canvas",
                onConfirm: () => dispatch({ type: "REMOVE_CANVAS", id }),
            });
        };

        // Takes a variable that has no card out of an equation's text.
        const removeFromEquation = (id, name) => {
            const node = getDoc().nodes[id];
            if (node) dispatch({ type: "SET_LATEX", id, latex: removeVariable(node.latex, name) });
        };

        // Any card can be dragged onto a graph: it's drawn if it uses the
        // graph's x input, and its own inputs join the x-axis choices.
        const canAddToPlot = (nodeId, plotId) => {
            const { nodes, plots } = getDoc();
            const plot = plots[plotId];
            return Boolean(
                plot && nodes[nodeId] && nodeId !== plot.targetId && !(plot.extra || []).includes(nodeId)
            );
        };
        const addPlotLine = (plotId, nodeId) => {
            if (!canAddToPlot(nodeId, plotId)) return;
            const plot = getDoc().plots[plotId];
            const series = plot.series && plot.series.length ? plot.series : [plot.targetId];
            dispatch({
                type: "UPDATE_PLOT",
                id: plotId,
                changes: {
                    extra: [...(plot.extra || []), nodeId],
                    series: [...series.filter((id) => id !== nodeId), nodeId],
                },
            });
        };

        const addTreeAt = ({ x, y }) => {
            const name = uniqueName(getDoc().trees.map((t) => t.name), "Tree");
            const rootId = uuid();
            setAutoFocusId(rootId);
            dispatch({ type: "ADD_TREE", treeId: uuid(), rootId, name, x, y: y + TAB_HEIGHT });
        };

        const copy = (text) => {
            try {
                navigator.clipboard.writeText(text);
            } catch (err) {}
        };

        const requestCard = (id, kind) => setCardRequest({ id, kind, at: Date.now() });

        const undo = () => dispatch({ type: "UNDO" });
        const redo = () => dispatch({ type: "REDO" });

        const fitAll = () => {
            const { doc, sizes } = latest.current;
            fitBox(boundingBox(doc, sizes));
        };
        const tidy = () => {
            const { doc, sizes } = latest.current;
            const positions = tidyLayout(doc, sizes);
            dispatch({ type: "SET_POSITIONS", positions });
            fitBox(boundingBox(withPositions(doc, positions), sizes));
        };

        // ---- right-click menus ----
        const nodeMenu = (id) => {
            const { doc, results } = latest.current;
            const node = doc.nodes[id];
            const result = results[id] || {};
            const isRoot = node.parent === null;
            const missing = (node.editing && result.missing) || [];
            return [
                node.editing
                    ? {
                          label: "Lock branch",
                          hint: "Enter",
                          disabled: !result.subtreeOk,
                          onSelect: () => finishBranch(id),
                      }
                    : { label: "Unlock to edit", onSelect: () => editNode(id) },
                node.editing && { label: "Add variable…", onSelect: () => requestCard(id, "popup") },
                {
                    label: isRoot ? "Rename tree…" : "Rename variable…",
                    onSelect: () => requestCard(id, "rename"),
                },
                { label: "Plot this equation", onSelect: () => addPlot(id) },
                ...missing.map((name) => ({
                    label: `Remove ${name} from the equation`,
                    onSelect: () => removeFromEquation(id, name),
                })),
                "-",
                result.display !== undefined && {
                    label: "Copy value",
                    onSelect: () => copy(result.display),
                },
                node.latex && { label: "Copy LaTeX", onSelect: () => copy(node.latex) },
                "-",
                !isRoot && { label: "Disconnect into its own tree", onSelect: () => detachNode(id) },
                isRoot
                    ? {
                          label: "Delete tree",
                          danger: true,
                          onSelect: () => confirmRemoveTree(node.treeId),
                      }
                    : { label: "Delete card", danger: true, onSelect: () => confirmDeleteNode(id) },
            ].filter(Boolean);
        };

        const plotMenu = (id) => {
            const plot = getDoc().plots[id];
            return [
                {
                    label: "Fit plot to its lines",
                    disabled: !plot.view,
                    onSelect: () =>
                        dispatch({ type: "UPDATE_PLOT", id, changes: { view: null }, transient: true }),
                },
                {
                    label: "Reset sliders",
                    disabled: Object.keys(plot.overrides || {}).length === 0,
                    onSelect: () =>
                        dispatch({ type: "UPDATE_PLOT", id, changes: { overrides: {} }, transient: true }),
                },
                "-",
                { label: "Remove plot", danger: true, onSelect: () => confirmRemovePlot(id) },
            ].filter(Boolean);
        };

        const canvasMenu = (point) => {
            const { canUndo, canRedo } = latest.current.history;
            return [
                { label: "Add new tree here", onSelect: () => addTreeAt(point) },
                { label: "Fit all", onSelect: fitAll },
                { label: "Tidy layout", onSelect: tidy },
                "-",
                { label: "Undo", hint: `${MOD}Z`, disabled: !canUndo, onSelect: undo },
                { label: "Redo", hint: `${MOD}${isMac ? "⇧Z" : "Y"}`, disabled: !canRedo, onSelect: redo },
            ];
        };

        let viewTimer = null;
        const moving = new Set();

        return {
            getDoc,
            getResults: () => latest.current.results,
            getScale: () => getTransform().scale,
            labelOf: (id) => nodeLabel(getDoc(), id),
            inputNames,
            siblingNames: (id) => {
                const node = getDoc().nodes[id];
                return node && node.parent ? inputNames(node.parent, id) : [];
            },
            linkableTrees: (consumerId) => {
                const { doc, results } = latest.current;
                return doc.trees
                    .filter((tree) => canLink(tree.rootId, consumerId))
                    .map((tree) => ({
                        rootId: tree.rootId,
                        name: tree.name,
                        display: (results[tree.rootId] || {}).display,
                    }));
            },
            // cards report their size and their name tab's width
            reportSize: (id, w, h, tab) =>
                setSizes((prev) =>
                    prev[id] && prev[id].w === w && prev[id].h === h && prev[id].tab === tab
                        ? prev
                        : { ...prev, [id]: { w, h, tab } }
                ),
            // While something is being dragged, panned or zoomed the canvas
            // gets an `is-moving` class: the content moves as one composited
            // layer and the connector animation pauses, which keeps it smooth.
            // Each source (pan, wheel, pinch, drag) is tracked by name, so a
            // missed "stop" from one can't leave the canvas stuck.
            setMoving: (source, on) => {
                if (on) moving.add(source);
                else moving.delete(source);
                canvasRef.current?.classList.toggle("is-moving", moving.size > 0);
            },

            // ---- history ----
            undo,
            redo,
            // A drag or resize is recorded as one undoable step.
            beginGesture: () => dispatch({ type: "BEGIN_GROUP" }),
            endGesture: () => dispatch({ type: "END_GROUP" }),

            // ---- trees and cards ----
            addTree: () => {
                const { doc, sizes } = latest.current;
                const name = uniqueName(doc.trees.map((t) => t.name), "Tree");
                const { x, y } = newTreePosition(doc, sizes);
                const rootId = uuid();
                setAutoFocusId(rootId);
                dispatch({ type: "ADD_TREE", treeId: uuid(), rootId, name, x, y });
                fitBox({
                    minX: x,
                    minY: y - TAB_HEIGHT,
                    w: DEFAULT_SIZE.w,
                    h: DEFAULT_SIZE.h + TAB_HEIGHT,
                });
            },
            confirmRemoveTree,
            renameTree: (treeId, name) => dispatch({ type: "RENAME_TREE", treeId, name }),
            addChild: (parentId, variable) => {
                const { doc, sizes } = latest.current;
                const id = uuid();
                const { x, y } = childPosition(doc, sizes, parentId);
                setAutoFocusId(id);
                dispatch({ type: "ADD_CHILD", parentId, id, variable, x, y });
                ensureVisible(x, y, DEFAULT_SIZE.w, DEFAULT_SIZE.h);
            },
            confirmDeleteNode,
            removeFromEquation,
            closeConfirm: () => setConfirmDialog(null),
            // hovering a card highlights the cards it's computed from
            setHoveredCard: (id) => setHoveredCardId(id),
            renameNode: (id, variable) => dispatch({ type: "RENAME_NODE", id, variable }),
            detachNode,
            setLatex: (id, latex) => dispatch({ type: "SET_LATEX", id, latex }),
            moveItem: (id, x, y) => dispatch({ type: "MOVE", id, x, y }),
            moveItems: (positions) => dispatch({ type: "SET_POSITIONS", positions }),
            // A card, everything below it and their plots: what Shift-drag moves.
            branchIds: (id) => {
                const doc = getDoc();
                const ids = getSubtreeIds(doc.nodes, id);
                const plots = Object.values(doc.plots)
                    .filter((plot) => ids.includes(plot.targetId))
                    .map((plot) => plot.id);
                return [...ids, ...plots];
            },
            setGroupDrag: (ids) => setGroupDrag(ids ? new Set(ids) : null),
            resizeItem: (id, w, h) => dispatch({ type: "RESIZE", id, w, h }),
            finishBranch,
            editNode,
            clearCardRequest: () => setCardRequest(null),

            // ---- sharing values by dragging a card's plug ----
            startLink: (fromId, clientX, clientY) =>
                setLinkDrag({
                    fromId,
                    point: clientToContent(clientX, clientY),
                    targetId: null,
                    valid: false,
                }),
            // Over a card, the drop links values; over a plot, it adds the card
            // as another line on the plot.
            updateLink: (clientX, clientY) => {
                const el = document.elementFromPoint(clientX, clientY);
                const card = el && el.closest(".equ-card");
                const plot = el && el.closest(".plot-card");
                const hit = card ? card.dataset.id : plot ? plot.dataset.plotId : null;
                setLinkDrag((prev) => {
                    if (!prev) return prev;
                    const targetId = hit && hit !== prev.fromId ? hit : null;
                    const onPlot = Boolean(targetId && !card);
                    return {
                        ...prev,
                        point: clientToContent(clientX, clientY),
                        targetId,
                        onPlot,
                        valid: !targetId
                            ? false
                            : onPlot
                            ? canAddToPlot(prev.fromId, targetId)
                            : canLink(prev.fromId, targetId),
                    };
                });
            },
            endLink: () => {
                const drag = latest.current.linkDrag;
                setLinkDrag(null);
                if (!drag || !drag.targetId || !drag.valid) return;
                if (drag.onPlot) addPlotLine(drag.targetId, drag.fromId);
                else requestLink(drag.fromId, drag.targetId);
            },
            requestLink,
            link,
            cancelConnect: () => setConnectRequest(null),
            // Cuts one connection: a child leaves its tree to become a tree of
            // its own, a link is simply removed.
            cutConnection: (consumerId, sourceId) => {
                const source = getDoc().nodes[sourceId];
                if (!source) return;
                if (source.parent === consumerId) detachNode(sourceId);
                else dispatch({ type: "UNLINK", consumerId, sourceId });
            },

            // ---- plots ----
            addPlot,
            updatePlot: (id, changes) => dispatch({ type: "UPDATE_PLOT", id, changes }),
            // Panning or zooming inside a plot isn't an undo step.
            setPlotView: (id, view) =>
                dispatch({ type: "UPDATE_PLOT", id, changes: { view }, transient: true }),
            // Nor is moving a slider: they're a "what if" on the plot.
            setPlotOverrides: (id, overrides) =>
                dispatch({ type: "UPDATE_PLOT", id, changes: { overrides }, transient: true }),
            confirmRemovePlot,
            removePlotLine: (plotId, nodeId) => {
                const plot = getDoc().plots[plotId];
                if (!plot) return;
                dispatch({
                    type: "UPDATE_PLOT",
                    id: plotId,
                    changes: {
                        extra: (plot.extra || []).filter((id) => id !== nodeId),
                        series: (plot.series || []).filter((id) => id !== nodeId),
                    },
                });
            },

            // ---- menus ----
            openContextMenu: (event) => {
                const target = event.target;
                // plain text boxes keep the browser's own menu (paste, etc.)
                if (target.closest("input, select")) return;
                event.preventDefault();
                const card = target.closest(".equ-card");
                const plot = target.closest(".plot-card");
                const items = card
                    ? nodeMenu(card.dataset.id)
                    : plot
                    ? plotMenu(plot.dataset.plotId)
                    : canvasMenu(clientToContent(event.clientX, event.clientY));
                setContextMenu({ x: event.clientX, y: event.clientY, items });
            },
            closeContextMenu: () => setContextMenu(null),

            // ---- view ----
            tidy,
            fitAll,
            focusTree: (treeId) => {
                const { doc, sizes } = latest.current;
                const tree = doc.trees.find((t) => t.id === treeId);
                if (!tree) return;
                // the tree's own cards, the cards it borrows values from, and plots
                const ids = [...new Set([...getTreeIds(doc, treeId), ...dependencyIds(doc.nodes, tree.rootId)])];
                const plots = Object.values(doc.plots)
                    .filter((plot) => ids.includes(plot.targetId))
                    .map((plot) => plot.id);
                fitBox(boundingBox(doc, sizes, [...ids, ...plots]));
            },
            zoomIn: () => transformRef.current?.zoomIn(0.25),
            zoomOut: () => transformRef.current?.zoomOut(0.25),
            resetZoom: () => {
                const { w, h } = latest.current.viewport;
                const t = transformRef.current;
                if (!t) return;
                const { scale, positionX, positionY } = getTransform();
                // zoom to 100% around the center of the screen
                const cx = (w / 2 - positionX) / scale;
                const cy = (h / 2 - positionY) / scale;
                t.setTransform(w / 2 - cx, h / 2 - cy, 1, 300, "easeOut");
            },
            // Remembers each canvas's pan and zoom once the view settles.
            saveView: (view) => {
                const canvasId = latest.current.app.activeId;
                clearTimeout(viewTimer);
                viewTimer = setTimeout(
                    () => dispatch({ type: "SET_VIEW", canvasId, view }),
                    400
                );
            },

            // ---- canvases ----
            addCanvas: () => {
                const name = uniqueName(
                    latest.current.app.canvases.map((c) => c.name),
                    "Canvas"
                );
                setAutoFocusId(null);
                dispatch({ type: "ADD_CANVAS", id: uuid(), name });
            },
            confirmRemoveCanvas,
            renameCanvas: (id, name) => dispatch({ type: "RENAME_CANVAS", id, name }),
            switchCanvas: (id) => {
                setAutoFocusId(null);
                setHighlightedTreeId(null);
                dispatch({ type: "SWITCH_CANVAS", id });
            },
        };
    }, [dispatch]);

    // Ctrl/⌘+Z undoes, Ctrl+Y or Ctrl/⌘+Shift+Z redoes. Plain text boxes keep
    // their own undo; equations (MathQuill has none) use the app's history.
    React.useEffect(() => {
        const onKey = (e) => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
            const key = e.key.toLowerCase();
            if (key !== "z" && key !== "y") return;
            const target = e.target;
            const inEquation = target.closest && target.closest(".mq-editable-field");
            const inTextBox =
                target.tagName === "INPUT" ||
                target.tagName === "SELECT" ||
                (target.tagName === "TEXTAREA" && !inEquation) ||
                target.isContentEditable;
            if (inTextBox) return;
            e.preventDefault();
            e.stopPropagation();
            if (key === "y" || e.shiftKey) actions.redo();
            else actions.undo();
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [actions]);

    // When a canvas is opened, go back to where it was left, or frame
    // everything on it the first time.
    const framedCanvas = React.useRef(null);
    React.useEffect(() => {
        if (!viewport.w || framedCanvas.current === app.activeId) return;
        const timeout = setTimeout(() => {
            framedCanvas.current = app.activeId;
            const view = latest.current.doc.view;
            if (view && transformRef.current) {
                transformRef.current.setTransform(view.positionX, view.positionY, view.scale, 0);
            } else {
                actions.fitAll();
            }
        }, 150);
        return () => clearTimeout(timeout);
    }, [app.activeId, viewport.w, actions]);

    // The sidebar only needs a summary of the canvases; tree counts don't
    // change while cards are dragged, so neither does this.
    const treeCounts = app.canvases.map((c) => app.docs[c.id].trees.length).join();
    const canvasSummaries = React.useMemo(
        () =>
            app.canvases.map((c) => ({ ...c, trees: app.docs[c.id].trees.length })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [app.canvases, treeCounts]
    );

    return (
        <Context.Provider
            value={{
                app,
                doc,
                results,
                sizes,
                scale,
                setScale,
                viewport,
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
            }}
        >
            <div className="app">
                <SideBar
                    canvases={canvasSummaries}
                    activeCanvasId={app.activeId}
                    trees={doc.trees}
                    results={results}
                    scale={scale}
                    showMinimap={showMinimap}
                    setShowMinimap={setShowMinimap}
                    setHighlightedTreeId={setHighlightedTreeId}
                    themePreference={themePreference}
                    setThemePreference={setThemePreference}
                    lineStyle={lineStyle}
                    setLineStyle={setLineStyle}
                    lineShape={lineShape}
                    setLineShape={setLineShape}
                    calculus={calculus}
                    setCalculus={setCalculusPreference}
                    actions={actions}
                />
                <Canvas />
            </div>
            {confirmDialog && <ConfirmDialog dialog={confirmDialog} onClose={actions.closeConfirm} />}
        </Context.Provider>
    );
}

export default App;
