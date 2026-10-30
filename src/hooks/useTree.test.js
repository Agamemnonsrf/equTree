import {
    docReducer,
    appReducer,
    historyReducer,
    initialHistory,
    loadAppState,
    createExampleDoc,
    emptyDoc,
    getTreeIds,
} from "./useTree";

describe("docReducer", () => {
    const base = createExampleDoc();
    const treeId = base.trees[0].id;
    const rootId = base.trees[0].rootId;
    const [bigR, smallR] = base.nodes[rootId].children;

    const addChild = (doc, parentId, id) =>
        docReducer(doc, { type: "ADD_CHILD", parentId, id, variable: id, x: 0, y: 0 });

    test("adds and removes children (with their subtree)", () => {
        let doc = addChild(base, rootId, "k");
        doc = addChild(doc, "k", "g");
        expect(doc.nodes[rootId].children).toContain("k");
        expect(doc.nodes.g.treeId).toBe(treeId);

        doc = docReducer(doc, { type: "REMOVE_NODE", id: "k" });
        expect(doc.nodes.k).toBeUndefined();
        expect(doc.nodes.g).toBeUndefined();
        expect(doc.nodes[rootId].children).not.toContain("k");
    });

    test("never removes a root through REMOVE_NODE", () => {
        expect(docReducer(base, { type: "REMOVE_NODE", id: rootId })).toBe(base);
    });

    test("adds and removes whole trees", () => {
        let doc = docReducer(base, {
            type: "ADD_TREE",
            treeId: "t2",
            rootId: "r2",
            name: "Second",
            x: 0,
            y: 0,
        });
        expect(doc.trees).toHaveLength(2);
        expect(getTreeIds(doc, "t2")).toEqual(["r2"]);

        doc = docReducer(doc, { type: "REMOVE_TREE", treeId });
        expect(doc.trees.map((t) => t.id)).toEqual(["t2"]);
        expect(Object.keys(doc.nodes)).toEqual(["r2"]);
    });

    test("detaches a branch into its own tree", () => {
        let doc = addChild(base, bigR, "a");
        doc = docReducer(doc, { type: "DETACH", id: bigR, treeId: "tR", name: "R" });
        expect(doc.nodes[rootId].children).toEqual([smallR]);
        expect(doc.nodes[bigR].parent).toBeNull();
        expect(doc.nodes[bigR].variable).toBeNull();
        expect(doc.nodes.a.treeId).toBe("tR");
        expect(doc.trees.find((t) => t.id === "tR")).toEqual({
            id: "tR",
            name: "R",
            rootId: bigR,
        });
    });

    const withTree2 = () =>
        docReducer(base, {
            type: "ADD_TREE",
            treeId: "t2",
            rootId: "r2",
            name: "Other",
            x: 0,
            y: 0,
        });
    const link = (doc, sourceId, consumerId, variable) =>
        docReducer(doc, { type: "LINK", sourceId, consumerId, variable });

    test("one card can feed several equations", () => {
        let doc = link(withTree2(), smallR, "r2", "k");
        expect(doc.nodes.r2.links).toEqual([{ id: smallR, variable: "k" }]);
        // r keeps its home in the first tree
        expect(doc.nodes[rootId].children).toContain(smallR);
        expect(doc.nodes[smallR].treeId).toBe(treeId);
        expect(doc.trees).toHaveLength(2);

        doc = docReducer(doc, { type: "UNLINK", consumerId: "r2", sourceId: smallR });
        expect(doc.nodes.r2.links).toEqual([]);
    });

    test("refuses links that would make a cycle or repeat an input", () => {
        // the root depends on R, so R can't use the root
        expect(link(base, rootId, bigR, "x")).toBe(base);
        expect(link(base, bigR, bigR, "x")).toBe(base);
        // R is already the root's child
        expect(link(base, bigR, rootId, "y")).toBe(base);
        // a cycle through links: r2 uses R, so R can't use r2
        const doc = link(withTree2(), bigR, "r2", "q");
        expect(link(doc, "r2", bigR, "z")).toBe(doc);
    });

    test("deleting a card removes the links to it", () => {
        let doc = link(withTree2(), smallR, "r2", "k");
        doc = docReducer(doc, { type: "REMOVE_NODE", id: smallR });
        expect(doc.nodes.r2.links).toEqual([]);
        doc = link(doc, "r2", bigR, "w");
        doc = docReducer(doc, { type: "REMOVE_TREE", treeId: "t2" });
        expect(doc.nodes[bigR].links).toEqual([]);
    });

    test("a parent's link to its own grandchild goes when that branch is deleted", () => {
        let doc = addChild(base, bigR, "a");
        doc = link(doc, "a", rootId, "a");
        doc = docReducer(doc, { type: "REMOVE_NODE", id: bigR });
        expect(doc.nodes[rootId].links).toEqual([]);
    });

    test("plots follow their equation and lose deleted variables", () => {
        let doc = docReducer(base, {
            type: "ADD_PLOT",
            plot: {
                id: "p",
                targetId: rootId,
                xId: smallR,
                series: [rootId, bigR],
                extra: [],
                overrides: { [smallR]: 4, [bigR]: 1 },
                view: null,
                x: 0,
                y: 0,
            },
        });
        doc = docReducer(doc, { type: "REMOVE_NODE", id: smallR });
        expect(doc.plots.p.xId).toBeNull();
        expect(doc.plots.p.overrides).toEqual({ [bigR]: 1 });
        doc = docReducer(doc, { type: "REMOVE_TREE", treeId });
        expect(doc.plots.p).toBeUndefined();
    });

    test("moves and resizes plots like cards", () => {
        let doc = docReducer(base, {
            type: "ADD_PLOT",
            plot: { id: "p", targetId: rootId, xId: null, series: [], view: null, x: 0, y: 0 },
        });
        doc = docReducer(doc, { type: "MOVE", id: "p", x: 5, y: 6 });
        doc = docReducer(doc, { type: "RESIZE", id: "p", w: 500, h: 400 });
        expect(doc.plots.p).toMatchObject({ x: 5, y: 6, w: 500, h: 400 });
    });

    test("does not mutate the previous state", () => {
        const before = JSON.stringify(base);
        docReducer(base, { type: "SET_LATEX", id: rootId, latex: "1" });
        docReducer(base, { type: "MOVE", id: rootId, x: 5, y: 5 });
        docReducer(base, { type: "SET_EDITING", ids: [rootId], editing: false });
        docReducer(base, { type: "DETACH", id: bigR, treeId: "x", name: "R" });
        docReducer(base, { type: "LINK", sourceId: smallR, consumerId: bigR, variable: "r" });
        expect(JSON.stringify(base)).toBe(before);
    });
});

describe("appReducer", () => {
    const app = {
        canvases: [{ id: "c1", name: "Canvas 1" }],
        activeId: "c1",
        docs: { c1: createExampleDoc() },
    };

    test("adds, switches, renames and removes canvases", () => {
        let next = appReducer(app, { type: "ADD_CANVAS", id: "c2", name: "Canvas 2" });
        expect(next.activeId).toBe("c2");
        expect(next.docs.c2).toEqual(emptyDoc());

        next = appReducer(next, { type: "RENAME_CANVAS", id: "c2", name: "Physics" });
        expect(next.canvases[1].name).toBe("Physics");

        next = appReducer(next, { type: "SWITCH_CANVAS", id: "c1" });
        expect(next.activeId).toBe("c1");

        next = appReducer(next, { type: "REMOVE_CANVAS", id: "c1" });
        expect(next.canvases.map((c) => c.id)).toEqual(["c2"]);
        expect(next.activeId).toBe("c2");
        expect(next.docs.c1).toBeUndefined();
    });

    test("keeps the last canvas", () => {
        expect(appReducer(app, { type: "REMOVE_CANVAS", id: "c1" })).toBe(app);
    });

    test("doc actions edit the active canvas, or the one named", () => {
        let next = appReducer(app, { type: "ADD_CANVAS", id: "c2", name: "Canvas 2" });
        next = appReducer(next, {
            type: "ADD_TREE",
            treeId: "t",
            rootId: "r",
            name: "T",
            x: 0,
            y: 0,
        });
        expect(next.docs.c2.trees).toHaveLength(1);
        expect(next.docs.c1.trees).toHaveLength(1);

        const view = { scale: 2, positionX: 1, positionY: 1 };
        next = appReducer(next, { type: "SET_VIEW", canvasId: "c1", view });
        expect(next.docs.c1.view).toEqual(view);
        expect(next.docs.c2.view).toBeNull();
    });
});

test("older plots become graphs of their first variable on load", () => {
    const doc = createExampleDoc();
    const rootId = doc.trees[0].rootId;
    const [bigR] = doc.nodes[rootId].children;
    doc.plots = { p: { id: "p", targetId: rootId, varId: bigR, min: 1, max: 2, series: [rootId], x: 0, y: 0 } };
    window.localStorage.setItem(
        "equtree:v2",
        JSON.stringify({ canvases: [{ id: "c", name: "C" }], activeId: "c", docs: { c: doc } })
    );
    const loaded = loadAppState().docs.c.plots.p;
    expect(loaded).toMatchObject({ xId: bigR, overrides: {}, view: null });
    expect(loaded.mode).toBeUndefined();
    expect(loaded.varId).toBeUndefined();
    expect(loaded.min).toBeUndefined();
    window.localStorage.clear();
});

describe("undo history", () => {
    const start = () => {
        const app = { canvases: [{ id: "c1", name: "Canvas 1" }], activeId: "c1", docs: { c1: createExampleDoc() } };
        return initialHistory(app);
    };
    const rootOf = (state) => state.app.docs[state.app.activeId].trees[0].rootId;
    const latexOf = (state) => state.app.docs.c1.nodes[rootOf(state)].latex;
    const run = (state, ...actions) => actions.reduce(historyReducer, state);

    test("undoes and redoes changes", () => {
        let state = start();
        const rootId = rootOf(state);
        state = run(state, { type: "MOVE", id: rootId, x: 1, y: 2, at: 0 });
        state = run(state, { type: "UNDO" });
        expect(state.app.docs.c1.nodes[rootId].x).toBe(120);
        state = run(state, { type: "REDO" });
        expect(state.app.docs.c1.nodes[rootId].x).toBe(1);
        expect(state.future).toHaveLength(0);
    });

    test("a new change clears redo", () => {
        let state = start();
        const rootId = rootOf(state);
        state = run(
            state,
            { type: "MOVE", id: rootId, x: 1, y: 2, at: 0 },
            { type: "UNDO" },
            { type: "MOVE", id: rootId, x: 5, y: 5, at: 10 }
        );
        expect(state.future).toHaveLength(0);
    });

    test("a burst of typing in one equation is one step, a pause starts another", () => {
        let state = start();
        const id = rootOf(state);
        state = run(
            state,
            { type: "SET_LATEX", id, latex: "1", at: 0 },
            { type: "SET_LATEX", id, latex: "12", at: 300 },
            { type: "SET_LATEX", id, latex: "123", at: 600 },
            { type: "SET_LATEX", id, latex: "1234", at: 5000 }
        );
        expect(state.past).toHaveLength(2);
        state = run(state, { type: "UNDO" });
        expect(latexOf(state)).toBe("123");
        state = run(state, { type: "UNDO" });
        expect(latexOf(state)).toBe("\\pi\\left(R^2-r^2\\right)");
    });

    test("a drag or resize is one step", () => {
        let state = start();
        const id = rootOf(state);
        state = run(
            state,
            { type: "BEGIN_GROUP" },
            { type: "MOVE", id, x: 1, y: 1, at: 0 },
            { type: "MOVE", id, x: 2, y: 2, at: 16 },
            { type: "MOVE", id, x: 3, y: 3, at: 32 },
            { type: "END_GROUP" }
        );
        expect(state.past).toHaveLength(1);
        state = run(state, { type: "UNDO" });
        expect(state.app.docs.c1.nodes[id].x).toBe(120);
    });

    test("views and canvas switches aren't steps, and undo keeps the current view", () => {
        let state = start();
        const id = rootOf(state);
        const view = { scale: 2, positionX: 3, positionY: 4 };
        state = run(state, { type: "MOVE", id, x: 1, y: 1, at: 0 }, { type: "SET_VIEW", canvasId: "c1", view });
        expect(state.past).toHaveLength(1);
        state = run(state, { type: "UNDO" });
        expect(state.app.docs.c1.view).toEqual(view);
    });

    test("undo shows the canvas the change was made on", () => {
        let state = start();
        state = run(state, { type: "ADD_CANVAS", id: "c2", name: "Canvas 2", at: 0 });
        state = run(state, { type: "ADD_TREE", treeId: "t", rootId: "r", name: "T", x: 0, y: 0, at: 1 });
        state = run(state, { type: "SWITCH_CANVAS", id: "c1" });
        state = run(state, { type: "UNDO" });
        expect(state.app.activeId).toBe("c2");
        expect(state.app.docs.c2.trees).toHaveLength(0);
    });
});
