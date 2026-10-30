import {
    buildPlot,
    defaultPlotFor,
    formatNumber,
    formatTick,
    leafInputs,
    niceTicks,
    robustRange,
    sliderRange,
    valuesAt,
    zoomView,
} from "./plot";

// Ring area: pi (R^2 - r^2) with R = a + 2, a = 3, r = 3
const nodes = {
    root: { id: "root", parent: null, variable: null, latex: "\\pi\\left(R^2-r^2\\right)", children: ["R", "r"] },
    R: { id: "R", parent: "root", variable: "R", latex: "a+2", children: ["a"] },
    a: { id: "a", parent: "R", variable: "a", latex: "3", children: [] },
    r: { id: "r", parent: "root", variable: "r", latex: "3", children: [] },
};
const doc = { nodes, trees: [{ id: "t", name: "Ring", rootId: "root" }] };
const graph = (fields) => ({ ...defaultPlotFor(nodes, "root"), targetId: "root", ...fields });

test("only plain-number cards are inputs", () => {
    // R is computed from a, so it can't be the x-axis; a and r can
    expect(leafInputs(nodes, "root")).toEqual(["r", "a"]);
    expect(defaultPlotFor(nodes, "root")).toMatchObject({ xId: "r", series: ["root"] });
});

describe("function plots", () => {
    test("plot the equation against one input, like a calculator", () => {
        const model = buildPlot(doc, graph({ xId: "r" }), "Ring");
        expect(model.xLabel).toBe("r");
        const [line] = model.lines;
        expect([line.xs[0], line.xs[line.xs.length - 1]]).toEqual([-10, 10]);
        // at r = 0 the ring is a full disc of radius R = 5
        expect(line.ys[(line.xs.length - 1) / 2]).toBeCloseTo(Math.PI * 25);
        expect(model.current).toEqual({ x: 3, ys: [expect.any(Number)] });
    });

    test("a computed card can't be the x-axis", () => {
        const model = buildPlot(doc, graph({ xId: "R" }), "Ring");
        expect(model.candidates.map((c) => c.label)).toEqual(["r", "a"]);
        expect(model.xId).toBe("r");
    });

    test("lines are the cards that change with x", () => {
        const model = buildPlot(doc, graph({ xId: "a", series: ["root", "R"] }), "Ring");
        // r doesn't change with a, so it isn't offered
        expect(model.options.map((o) => o.label)).toEqual(["Ring", "R"]);
        expect(model.lines.map((l) => [l.label, l.color])).toEqual([
            ["Ring", 0],
            ["R", 1],
        ]);
        expect(model.lines[1].ys[0]).toBe(-8);
    });

    test("other inputs become sliders that change the plot, not the cards", () => {
        const plain = buildPlot(doc, graph({ xId: "r" }), "Ring");
        expect(plain.sliders.map((s) => [s.label, s.value, s.changed])).toEqual([["a", 3, false]]);

        const what = buildPlot(doc, graph({ xId: "r", overrides: { a: 8 } }), "Ring");
        expect(what.sliders[0]).toMatchObject({ value: 8, base: 3, changed: true });
        // R = a + 2 = 10 now, so at r = 0 the area is 100 pi
        const [line] = what.lines;
        expect(line.ys[(line.xs.length - 1) / 2]).toBeCloseTo(Math.PI * 100);
        // the cards are untouched
        expect(nodes.a.latex).toBe("3");
    });

    test("cards dropped onto the plot are drawn if they use x", () => {
        const withOther = {
            nodes: {
                ...nodes,
                other: { id: "other", parent: null, variable: null, latex: "10r", children: [], links: [{ id: "r", variable: "r" }] },
            },
            trees: [...doc.trees, { id: "t2", name: "Ten r", rootId: "other" }],
        };
        const model = buildPlot(withOther, graph({ xId: "r", series: ["root", "other"], extra: ["other"] }), "Ring");
        expect(model.options.find((o) => o.id === "other")).toMatchObject({ kind: "extra", label: "Ten r" });
        const line = model.lines.find((l) => l.id === "other");
        expect(line.ys[line.ys.length - 1]).toBe(100);
    });

    test("any card can be dropped on; its inputs join the x-axis choices", () => {
        const wave = {
            nodes: {
                ...nodes,
                w: { id: "w", parent: null, variable: null, latex: "\\sin\\left(y\\right)", children: ["y"] },
                y: { id: "y", parent: "w", variable: "y", latex: "1", children: [] },
            },
            trees: [...doc.trees, { id: "t2", name: "Wave", rootId: "w" }],
        };
        const plot = graph({ xId: "r", series: ["root", "w"], extra: ["w"] });
        const againstR = buildPlot(wave, plot, "Ring");
        expect(againstR.candidates.map((c) => c.label)).toEqual(["r", "a", "y"]);
        // the wave doesn't use r: it's listed, with its own input to plot against
        expect(againstR.options.find((o) => o.id === "w")).toMatchObject({
            uses: false,
            inputs: [{ id: "y", label: "y" }],
        });
        expect(againstR.lines.map((l) => l.id)).toEqual(["root"]);

        const againstY = buildPlot(wave, { ...plot, xId: "y" }, "Ring");
        // now the ring area doesn't use x, and the wave is drawn
        expect(againstY.lines.map((l) => l.id)).toEqual(["w"]);
        expect(againstY.options.find((o) => o.id === "root").uses).toBe(false);
        const [line] = againstY.lines;
        expect(Math.max(...line.ys)).toBeCloseTo(1, 3);
    });

    test("says so when nothing shown uses x", () => {
        const plot = graph({ xId: "r", series: ["R"] });
        // R = a + 2 doesn't use r and isn't offered, so the equation is shown
        expect(buildPlot(doc, plot, "Ring").lines.map((l) => l.id)).toEqual(["root"]);
    });

    test("explains what can't be plotted", () => {
        const lone = { nodes: { x: { id: "x", parent: null, latex: "1", children: [] } }, trees: [] };
        expect(buildPlot(lone, { targetId: "x" }, "X").message).toMatch(/plain number/);
    });

    test("only the visible part is sampled", () => {
        const model = buildPlot(doc, graph({ xId: "r" }), "Ring", [100, 200], 50);
        expect(model.lines[0].xs).toHaveLength(50);
        expect(model.lines[0].xs[0]).toBe(100);
    });

    test("hover values respect the sliders", () => {
        const plot = graph({ xId: "r", overrides: { a: 8 } });
        const model = buildPlot(doc, plot, "Ring");
        expect(valuesAt(doc, plot, model, 0)[0].y).toBeCloseTo(Math.PI * 100);
    });
});

test("slider ranges centre on the card's value and stretch to the slider", () => {
    expect(sliderRange(5, 5)).toEqual([0, 10]);
    expect(sliderRange(5, 30)).toEqual([0, 30]);
    expect(sliderRange(0, 0)).toEqual([-1, 1]);
});

test("zoomView keeps the point under the cursor still", () => {
    const view = { x0: 0, x1: 10, y0: 0, y1: 10 };
    expect(zoomView(view, 0.5, 5, 5)).toEqual({ x0: 2.5, x1: 7.5, y0: 2.5, y1: 7.5 });
    expect(zoomView(view, 2, 0, 10, "x")).toEqual({ x0: 0, x1: 20, y0: 0, y1: 10 });
});

test("niceTicks returns round numbers", () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(-1, 1, 4)).toEqual([-1, -0.5, 0, 0.5, 1]);
});

test("robustRange keeps whole curves but drops asymptote spikes", () => {
    const parabola = Array.from({ length: 101 }, (_, i) => (i - 50) ** 2);
    expect(robustRange(parabola)[1]).toBeGreaterThanOrEqual(2500);
    const spiky = Array.from({ length: 100 }, (_, i) => (i === 50 ? 1e9 : i % 10));
    expect(robustRange(spiky)[1]).toBeLessThan(20);
});

test("number formats", () => {
    expect(formatNumber(1 / 3)).toBe("0.333333");
    expect(formatNumber(null)).toBe("–");
    expect(formatTick(2000000)).toBe("2M");
    expect(formatTick(1500)).toBe("1.5k");
});
