import React from "react";
import uuid from "react-uuid";
import { Context } from "../context/context";
import { dependsOn, getSubtreeIds, inputsOf } from "../lib/tree";

export { getSubtreeIds };

// App state:
// {
//   canvases: [{ id, name }],
//   activeId,
//   docs: { [canvasId]: doc },
// }
// Each canvas doc:
// {
//   trees: [{ id, name, rootId }],
//   nodes: { [id]: { id, treeId, parent, children: [ids], links: [{ id, variable }],
//                    variable, latex, x, y, w, h, editing } },
//   plots: { [id]: { id, targetId, xId, series: [ids], extra: [ids],
//                    overrides: { [id]: number }, view: { x0, x1, y0, y1 } | null,
//                    x, y, w, h } },
// (see lib/plot.js; a plot's `extra` cards were dragged onto it to be drawn too)
//   view: { scale, positionX, positionY } | null,
// }
// w/h on cards are optional sizes set by the resize handle; content can still
// make a card bigger. `links` let a card use other cards' values on top of its
// own children (see lib/tree.js).

const STORAGE_KEY = "equtree:v2";
const LEGACY_KEY = "equtree:v1";

export const VARIABLE_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const makeNode = (fields) => ({
    children: [],
    links: [],
    latex: "",
    editing: true,
    ...fields,
});

export const emptyDoc = () => ({ trees: [], nodes: {}, plots: {}, view: null });

export const createExampleDoc = () => {
    const treeId = uuid();
    const rootId = uuid();
    const bigR = uuid();
    const smallR = uuid();
    return {
        ...emptyDoc(),
        trees: [{ id: treeId, name: "Ring area", rootId }],
        nodes: {
            [rootId]: makeNode({
                id: rootId,
                treeId,
                parent: null,
                variable: null,
                latex: "\\pi\\left(R^2-r^2\\right)",
                children: [bigR, smallR],
                x: 120,
                y: 160,
            }),
            [bigR]: makeNode({
                id: bigR,
                treeId,
                parent: rootId,
                variable: "R",
                latex: "2+3",
                x: 620,
                y: 40,
            }),
            [smallR]: makeNode({
                id: smallR,
                treeId,
                parent: rootId,
                variable: "r",
                latex: "\\sqrt{9}",
                x: 620,
                y: 300,
            }),
        },
    };
};

const isValidDoc = (doc) => {
    if (!doc || !Array.isArray(doc.trees) || !doc.nodes) return false;
    return doc.trees.every((tree) => {
        const check = (id, parent) => {
            const node = doc.nodes[id];
            return (
                node &&
                node.parent === parent &&
                Array.isArray(node.children) &&
                node.children.every((childId) => check(childId, id))
            );
        };
        return check(tree.rootId, null);
    });
};

// Drops plots whose equation is gone and clears variables that no longer exist.
// Older plots swept one or more variables over ranges ({ varId, min, max } or
// sweeps: [...]) or had a "what matters most" mode; they become graphs of
// their first variable.
const upgradePlot = (plot) => {
    const { varId, min, max, sweeps, yScale, mode, hidden, spread, ...rest } = plot;
    const old = Boolean(sweeps || varId !== undefined || mode === "sensitivity");
    return {
        ...rest,
        xId: rest.xId !== undefined ? rest.xId : (sweeps && sweeps[0] && sweeps[0].varId) || varId || null,
        series: rest.series && rest.series.length ? rest.series : [rest.targetId],
        extra: rest.extra || [],
        overrides: rest.overrides || {},
        view: old ? null : rest.view || null,
    };
};

// Drops plots whose equation is gone, and references to cards that are.
const prunePlots = (plots, nodes) =>
    Object.fromEntries(
        Object.entries(plots || {})
            .filter(([, plot]) => nodes[plot.targetId])
            .map(([id, plot]) => {
                const upgraded = upgradePlot(plot);
                const keep = (ids) => (ids || []).filter((s) => nodes[s]);
                return [
                    id,
                    {
                        ...upgraded,
                        xId: nodes[upgraded.xId] ? upgraded.xId : null,
                        series: keep(upgraded.series),
                        extra: keep(upgraded.extra),
                        overrides: Object.fromEntries(
                            Object.entries(upgraded.overrides || {}).filter(([s]) => nodes[s])
                        ),
                    },
                ];
            })
    );

// Drops links to cards that no longer exist.
const pruneLinks = (nodes) => {
    const pruned = { ...nodes };
    Object.values(nodes).forEach((node) => {
        const links = (node.links || []).filter((link) => nodes[link.id]);
        if (!node.links || links.length !== node.links.length) {
            pruned[node.id] = { ...node, links };
        }
    });
    return pruned;
};

const normalizeDoc = (doc) => {
    const nodes = pruneLinks(doc.nodes);
    return {
        trees: doc.trees,
        nodes,
        plots: prunePlots(doc.plots, nodes),
        view: doc.view || null,
    };
};

const singleCanvas = (doc) => {
    const id = uuid();
    return { canvases: [{ id, name: "Canvas 1" }], activeId: id, docs: { [id]: doc } };
};

const readJson = (key) => {
    try {
        return JSON.parse(window.localStorage.getItem(key));
    } catch (err) {
        return null;
    }
};

export const loadAppState = () => {
    const saved = readJson(STORAGE_KEY);
    if (
        saved &&
        Array.isArray(saved.canvases) &&
        saved.canvases.length > 0 &&
        saved.docs &&
        saved.canvases.every((c) => isValidDoc(saved.docs[c.id]))
    ) {
        const docs = {};
        saved.canvases.forEach((c) => (docs[c.id] = normalizeDoc(saved.docs[c.id])));
        const activeId = docs[saved.activeId] ? saved.activeId : saved.canvases[0].id;
        return { canvases: saved.canvases, activeId, docs };
    }
    // saves from before canvases existed hold a single doc
    const legacy = readJson(LEGACY_KEY);
    if (isValidDoc(legacy)) return singleCanvas(normalizeDoc(legacy));
    return singleCanvas(createExampleDoc());
};

export const getTreeIds = (doc, treeId) => {
    const tree = doc.trees.find((t) => t.id === treeId);
    return tree ? getSubtreeIds(doc.nodes, tree.rootId) : [];
};

const withoutKeys = (obj, keys) => {
    const copy = { ...obj };
    keys.forEach((key) => delete copy[key]);
    return copy;
};

const setTreeId = (nodes, rootId, treeId) => {
    getSubtreeIds(nodes, rootId).forEach((id) => {
        nodes[id] = { ...nodes[id], treeId };
    });
};

// Applies `update` to a card or a plot, whichever has that id.
const updateItem = (doc, id, update) => {
    if (doc.nodes[id]) {
        return { ...doc, nodes: { ...doc.nodes, [id]: update(doc.nodes[id]) } };
    }
    if (doc.plots[id]) {
        return { ...doc, plots: { ...doc.plots, [id]: update(doc.plots[id]) } };
    }
    return doc;
};

export const docReducer = (doc, action) => {
    switch (action.type) {
        case "ADD_TREE": {
            const { treeId, rootId, name, x, y } = action;
            return {
                ...doc,
                trees: [...doc.trees, { id: treeId, name, rootId }],
                nodes: {
                    ...doc.nodes,
                    [rootId]: makeNode({
                        id: rootId,
                        treeId,
                        parent: null,
                        variable: null,
                        x,
                        y,
                    }),
                },
            };
        }
        case "REMOVE_TREE": {
            const tree = doc.trees.find((t) => t.id === action.treeId);
            if (!tree) return doc;
            const nodes = pruneLinks(
                withoutKeys(doc.nodes, getSubtreeIds(doc.nodes, tree.rootId))
            );
            return {
                ...doc,
                trees: doc.trees.filter((t) => t.id !== action.treeId),
                nodes,
                plots: prunePlots(doc.plots, nodes),
            };
        }
        case "RENAME_TREE":
            return {
                ...doc,
                trees: doc.trees.map((t) =>
                    t.id === action.treeId ? { ...t, name: action.name } : t
                ),
            };
        case "ADD_CHILD": {
            const { parentId, id, variable, x, y } = action;
            const parent = doc.nodes[parentId];
            if (!parent) return doc;
            return {
                ...doc,
                nodes: {
                    ...doc.nodes,
                    [parentId]: { ...parent, children: [...parent.children, id] },
                    [id]: makeNode({
                        id,
                        treeId: parent.treeId,
                        parent: parentId,
                        variable,
                        x,
                        y,
                    }),
                },
            };
        }
        case "REMOVE_NODE": {
            const node = doc.nodes[action.id];
            if (!node || node.parent === null) return doc;
            const nodes = pruneLinks(
                withoutKeys(doc.nodes, getSubtreeIds(doc.nodes, action.id))
            );
            // read the parent after pruning so its own links stay pruned
            const parent = nodes[node.parent];
            nodes[parent.id] = {
                ...parent,
                children: parent.children.filter((c) => c !== action.id),
            };
            return { ...doc, nodes, plots: prunePlots(doc.plots, nodes) };
        }
        case "RENAME_NODE": {
            const node = doc.nodes[action.id];
            if (!node || node.parent === null) return doc;
            return updateItem(doc, action.id, (n) => ({ ...n, variable: action.variable }));
        }
        // Cuts a card (and everything below it) loose into a tree of its own.
        case "DETACH": {
            const node = doc.nodes[action.id];
            if (!node || node.parent === null) return doc;
            const parent = doc.nodes[node.parent];
            const nodes = {
                ...doc.nodes,
                [parent.id]: {
                    ...parent,
                    children: parent.children.filter((c) => c !== action.id),
                },
                [action.id]: { ...node, parent: null, variable: null },
            };
            setTreeId(nodes, action.id, action.treeId);
            return {
                ...doc,
                trees: [
                    ...doc.trees,
                    { id: action.treeId, name: action.name, rootId: action.id },
                ],
                nodes,
            };
        }
        // Lets `consumerId` use `sourceId`'s value as the variable `variable`,
        // on top of wherever else that card is used.
        case "LINK": {
            const { consumerId, sourceId, variable } = action;
            const consumer = doc.nodes[consumerId];
            if (!consumer || !doc.nodes[sourceId]) return doc;
            const alreadyFeeds = inputsOf(doc.nodes, consumer).some(
                (input) => input.id === sourceId
            );
            // the source can't depend on the card it feeds
            if (alreadyFeeds || dependsOn(doc.nodes, sourceId, consumerId)) return doc;
            return updateItem(doc, consumerId, (n) => ({
                ...n,
                links: [...(n.links || []), { id: sourceId, variable }],
            }));
        }
        case "UNLINK":
            return updateItem(doc, action.consumerId, (n) => ({
                ...n,
                links: (n.links || []).filter((link) => link.id !== action.sourceId),
            }));
        case "SET_LATEX": {
            const node = doc.nodes[action.id];
            if (!node || node.latex === action.latex) return doc;
            return updateItem(doc, action.id, (n) => ({ ...n, latex: action.latex }));
        }
        case "MOVE":
            return updateItem(doc, action.id, (item) => ({
                ...item,
                x: action.x,
                y: action.y,
            }));
        case "RESIZE":
            return updateItem(doc, action.id, (item) => ({
                ...item,
                w: action.w,
                h: action.h,
            }));
        case "SET_POSITIONS": {
            const nodes = { ...doc.nodes };
            const plots = { ...doc.plots };
            Object.entries(action.positions).forEach(([id, pos]) => {
                if (nodes[id]) nodes[id] = { ...nodes[id], x: pos.x, y: pos.y };
                if (plots[id]) plots[id] = { ...plots[id], x: pos.x, y: pos.y };
            });
            return { ...doc, nodes, plots };
        }
        case "SET_EDITING": {
            const nodes = { ...doc.nodes };
            action.ids.forEach((id) => {
                if (nodes[id]) nodes[id] = { ...nodes[id], editing: action.editing };
            });
            return { ...doc, nodes };
        }
        case "ADD_PLOT":
            if (!doc.nodes[action.plot.targetId]) return doc;
            return { ...doc, plots: { ...doc.plots, [action.plot.id]: action.plot } };
        case "UPDATE_PLOT":
            return updateItem(doc, action.id, (plot) => ({ ...plot, ...action.changes }));
        case "REMOVE_PLOT":
            return { ...doc, plots: withoutKeys(doc.plots, [action.id]) };
        case "SET_VIEW":
            return { ...doc, view: action.view };
        default:
            return doc;
    }
};

export const appReducer = (app, action) => {
    switch (action.type) {
        case "ADD_CANVAS":
            return {
                canvases: [...app.canvases, { id: action.id, name: action.name }],
                activeId: action.id,
                docs: { ...app.docs, [action.id]: emptyDoc() },
            };
        case "REMOVE_CANVAS": {
            if (app.canvases.length <= 1) return app;
            const canvases = app.canvases.filter((c) => c.id !== action.id);
            return {
                canvases,
                activeId: app.activeId === action.id ? canvases[0].id : app.activeId,
                docs: withoutKeys(app.docs, [action.id]),
            };
        }
        case "RENAME_CANVAS":
            return {
                ...app,
                canvases: app.canvases.map((c) =>
                    c.id === action.id ? { ...c, name: action.name } : c
                ),
            };
        case "SWITCH_CANVAS":
            if (!app.docs[action.id]) return app;
            return { ...app, activeId: action.id };
        default: {
            // Everything else edits a canvas: the one named, or the active one.
            const canvasId = action.canvasId || app.activeId;
            const doc = app.docs[canvasId];
            if (!doc) return app;
            const next = docReducer(doc, action);
            if (next === doc) return app;
            return { ...app, docs: { ...app.docs, [canvasId]: next } };
        }
    }
};

// ---------- Undo history ----------
//
// Wraps appReducer with past/future stacks of app snapshots. Each entry
// remembers which canvas changed, so undo shows that canvas. Pan/zoom views
// aren't part of history: undoing keeps every canvas's current view.
//
// Continuous edits become a single step: everything between BEGIN_GROUP and
// END_GROUP (a drag or a resize), and a burst of typing in one equation.

const HISTORY_LIMIT = 200;
const TYPING_PAUSE = 1000;

// Actions that change nothing worth undoing.
const NOT_UNDOABLE = new Set(["SET_VIEW", "SWITCH_CANVAS"]);

const keepViews = (snapshot, current) => ({
    ...snapshot,
    docs: Object.fromEntries(
        Object.entries(snapshot.docs).map(([id, doc]) => {
            const now = current.docs[id];
            if (!now) return [id, doc];
            // plot views (pans and zooms) and slider positions aren't undone either
            const plots = Object.fromEntries(
                Object.entries(doc.plots).map(([plotId, plot]) => {
                    const current = now.plots[plotId];
                    return [
                        plotId,
                        current ? { ...plot, view: current.view, overrides: current.overrides } : plot,
                    ];
                })
            );
            return [id, { ...doc, view: now.view, plots }];
        })
    ),
});

const restore = (entry, current) => {
    const app = keepViews(entry.snapshot, current);
    const activeId = app.docs[entry.canvasId]
        ? entry.canvasId
        : app.docs[current.activeId]
        ? current.activeId
        : app.canvases[0].id;
    return { ...app, activeId };
};

export const initialHistory = (app) => ({
    app,
    past: [],
    future: [],
    group: null,
    lastKey: null,
    lastAt: 0,
});

export const historyReducer = (state, action) => {
    switch (action.type) {
        case "UNDO": {
            if (state.past.length === 0) return state;
            const entry = state.past[state.past.length - 1];
            return {
                ...state,
                app: restore(entry, state.app),
                past: state.past.slice(0, -1),
                future: [...state.future, { snapshot: state.app, canvasId: entry.canvasId }],
                lastKey: null,
            };
        }
        case "REDO": {
            if (state.future.length === 0) return state;
            const entry = state.future[state.future.length - 1];
            return {
                ...state,
                app: restore(entry, state.app),
                future: state.future.slice(0, -1),
                past: [...state.past, { snapshot: state.app, canvasId: entry.canvasId }],
                lastKey: null,
            };
        }
        case "BEGIN_GROUP":
            return { ...state, group: { pushed: false }, lastKey: null };
        case "END_GROUP":
            return { ...state, group: null };
        default: {
            const app = appReducer(state.app, action);
            if (app === state.app) return state;
            if (NOT_UNDOABLE.has(action.type) || action.transient) {
                return { ...state, app };
            }
            const canvasId = action.canvasId || state.app.activeId;
            const key = action.type === "SET_LATEX" ? `latex:${action.id}` : null;
            const at = action.at || 0;
            const coalesce =
                (state.group && state.group.pushed) ||
                (key && key === state.lastKey && at - state.lastAt < TYPING_PAUSE);
            const past = coalesce
                ? state.past
                : [...state.past, { snapshot: state.app, canvasId }].slice(-HISTORY_LIMIT);
            return {
                ...state,
                app,
                past,
                future: [],
                group: state.group ? { pushed: true } : null,
                lastKey: key,
                lastAt: at,
            };
        }
    }
};

export const useAppState = () => {
    const [state, rawDispatch] = React.useReducer(historyReducer, null, () =>
        initialHistory(loadAppState())
    );
    const { app } = state;

    // timestamps let the history merge a burst of typing into one step
    const dispatch = React.useCallback(
        (action) => rawDispatch({ ...action, at: Date.now() }),
        []
    );

    React.useEffect(() => {
        const timeout = setTimeout(() => {
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(app));
            } catch (err) {}
        }, 300);
        return () => clearTimeout(timeout);
    }, [app]);

    return [app, dispatch, { canUndo: state.past.length > 0, canRedo: state.future.length > 0 }];
};

export const useTree = () => React.useContext(Context);
