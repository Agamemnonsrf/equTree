import { evaluateAll, evaluateSubtree, parseEquation, toReal } from "./evaluate";

// Builds a state from a compact description:
// { root: "latex", children: { x: "latex" | { latex, children } } }
const build = (spec) => {
    const nodes = {};
    let counter = 0;
    const make = (variable, def, parent) => {
        const id = `n${counter++}`;
        const latex = typeof def === "string" ? def : def.latex;
        nodes[id] = { id, parent, variable, latex, children: [] };
        const children = (typeof def === "object" && def.children) || {};
        Object.entries(children).forEach(([name, childDef]) => {
            nodes[id].children.push(make(name, childDef, id));
        });
        return id;
    };
    const rootId = make(null, spec, null);
    return { state: { trees: [{ id: "t", rootId }], nodes }, rootId };
};

describe("parseEquation", () => {
    test("collects symbols but not function names", () => {
        expect(parseEquation("\\sin\\left(x\\right)+y").symbols).toEqual([
            "x",
            "y",
        ]);
    });

    test("treats juxtaposed brackets as multiplication", () => {
        expect(parseEquation("x\\left(y+1\\right)").symbols).toEqual([
            "x",
            "y",
        ]);
        expect(parseEquation("\\pi\\left(2\\right)").compiled.evaluate()).toBe(
            2 * Math.PI
        );
    });

    test("flags assignments", () => {
        expect(parseEquation("x=3").error).toMatch(/=/);
    });

    test("empty", () => {
        expect(parseEquation("").empty).toBe(true);
    });
});

describe("evaluateAll", () => {
    test("propagates values up the tree", () => {
        const { state, rootId } = build({
            latex: "\\pi\\left(R^2-r^2\\right)",
            children: {
                R: { latex: "a+b", children: { a: "2", b: "3" } },
                r: "\\sqrt{9}",
            },
        });
        const results = evaluateAll(state);
        expect(results[rootId].value).toBeCloseTo(Math.PI * 16);
        expect(results[rootId].ok).toBe(true);
        expect(results[rootId].subtreeOk).toBe(true);
    });

    test("reports missing variables", () => {
        const { state, rootId } = build({ latex: "x+y", children: { x: "1" } });
        const result = evaluateAll(state)[rootId];
        expect(result.kind).toBe("missing");
        expect(result.missing).toEqual(["y"]);
        expect(result.ok).toBe(false);
    });

    test("flags unused and duplicate children", () => {
        const { state, rootId } = build({ latex: "x", children: { x: "1" } });
        const extra = { id: "u", parent: rootId, variable: "z", latex: "2", children: [] };
        const dupe = { id: "d", parent: rootId, variable: "x", latex: "3", children: [] };
        state.nodes.u = extra;
        state.nodes.d = dupe;
        state.nodes[rootId].children.push("u", "d");
        const results = evaluateAll(state);
        expect(results.u.unused).toBe(true);
        expect(results.d.duplicate).toBe(true);
        expect(results[rootId].value).toBe(1);
        expect(results[rootId].ok).toBe(true);
        expect(results[rootId].subtreeOk).toBe(false);
    });

    test("parent waits on a broken child", () => {
        const { state, rootId } = build({ latex: "2x", children: { x: "1+" } });
        const results = evaluateAll(state);
        expect(results[rootId].kind).toBe("child");
        expect(results[rootId].error).toMatch(/x/);
    });

    test("constants work unless a child overrides them", () => {
        const plain = build({ latex: "e" });
        expect(evaluateAll(plain.state)[plain.rootId].value).toBeCloseTo(
            Math.E
        );
        const overridden = build({ latex: "i+1", children: { i: "0.05" } });
        expect(
            evaluateAll(overridden.state)[overridden.rootId].value
        ).toBeCloseTo(1.05);
    });

    test("complex results are displayed", () => {
        const { state, rootId } = build({ latex: "\\sqrt{-4}" });
        expect(evaluateAll(state)[rootId].display).toBe("2i");
    });

    test("division by zero yields Infinity, not a crash", () => {
        const { state, rootId } = build({ latex: "\\frac{1}{0}" });
        expect(evaluateAll(state)[rootId].display).toBe("Infinity");
    });

    test("empty equation", () => {
        const { state, rootId } = build({ latex: "" });
        expect(evaluateAll(state)[rootId].kind).toBe("empty");
    });
});

describe("evaluateSubtree", () => {
    test("pins overridden nodes and solves the rest", () => {
        const { state, rootId } = build({
            latex: "a\\cdot b",
            children: { a: { latex: "c+1", children: { c: "1" } }, b: "10" },
        });
        const cId = state.nodes[state.nodes[rootId].children[0]].children[0];
        expect(evaluateSubtree(state.nodes, rootId)[rootId]).toBe(20);
        expect(evaluateSubtree(state.nodes, rootId, { [cId]: 4 })[rootId]).toBe(50);
    });

    test("leaves unsolvable nodes undefined", () => {
        const { state, rootId } = build({ latex: "x+1" });
        expect(evaluateSubtree(state.nodes, rootId)[rootId]).toBeUndefined();
    });

    test("toReal keeps only real numbers", () => {
        expect(toReal(2)).toBe(2);
        expect(toReal(Infinity)).toBeNull();
        expect(toReal(parseEquation("\\sqrt{-4}").compiled.evaluate())).toBeNull();
        expect(toReal(parseEquation("\\sqrt{4}+0i").compiled.evaluate())).toBe(2);
    });
});

describe("links", () => {
    // Two trees: "first" = g + 1 with g = 9.81, and "second" = 2k, where k
    // is linked to first's g.
    const shared = () => {
        const first = build({ latex: "g+1", children: { g: "9.81" } });
        const gId = first.state.nodes[first.rootId].children[0];
        const nodes = {
            ...first.state.nodes,
            s: { id: "s", parent: null, variable: null, latex: "2k", children: [], links: [{ id: gId, variable: "k" }] },
        };
        return {
            state: { trees: [...first.state.trees, { id: "t2", rootId: "s" }], nodes },
            firstId: first.rootId,
            gId,
        };
    };

    test("one card feeds several equations, under different names", () => {
        const { state, firstId } = shared();
        const results = evaluateAll(state);
        expect(results[firstId].value).toBeCloseTo(10.81);
        expect(results.s.value).toBeCloseTo(19.62);
        expect(results.s.ok).toBe(true);
    });

    test("a link the equation doesn't use is flagged", () => {
        const { state, gId } = shared();
        state.nodes.s = { ...state.nodes.s, latex: "3" };
        const results = evaluateAll(state);
        expect(results.s.strayLinks).toEqual([gId]);
        expect(results.s.ok).toBe(false);
        // g is still fine in its own tree
        expect(results[gId].ok).toBe(true);
    });

    test("evaluateSubtree follows links when sweeping", () => {
        const { state, gId } = shared();
        expect(evaluateSubtree(state.nodes, "s", { [gId]: 5 }).s).toBe(10);
    });

    test("a cycle in an old save doesn't hang", () => {
        const { state, firstId, gId } = shared();
        state.nodes[gId] = { ...state.nodes[gId], latex: "k", links: [{ id: "s", variable: "k" }] };
        const results = evaluateAll(state);
        expect(results.s.error).toBeDefined();
        expect(results[firstId].error).toBeDefined();
    });
});

describe("rounding noise", () => {
    const value = (latex) => {
        const { state, rootId } = build({ latex });
        return evaluateAll(state)[rootId];
    };

    test.each([
        ["\\sin\\left(\\pi\\right)", 0],
        ["\\cos\\left(\\frac{\\pi}{2}\\right)", 0],
        ["\\tan\\left(\\pi\\right)", 0],
        ["\\sin\\left(1000\\pi\\right)", 0],
        ["0.1+0.2-0.3", 0],
    ])("%s is exactly %p", (latex, expected) => {
        expect(value(latex).value).toBe(expected);
        expect(value(latex).display).toBe("0");
    });

    test("real results are untouched", () => {
        expect(value("\\sin\\left(1\\right)").value).toBeCloseTo(Math.sin(1), 15);
        expect(value("0.1+0.2").value).toBe(0.1 + 0.2);
        expect(value("6.626\\cdot10^{-34}").value).toBeCloseTo(6.626e-34, 40);
        expect(value("10^{-20}+10^{-20}").value).toBe(2e-20);
        expect(value("\\sqrt{-4}+1").display).toBe("1 + 2i");
    });
});