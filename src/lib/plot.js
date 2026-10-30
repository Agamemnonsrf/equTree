import { evaluateSubtree, toReal } from "./evaluate";
import { dependencyIds, dependsOn, inputsOf, nodeLabel } from "./tree";

// A plot graphs an equation against one of its inputs, like a graphing
// calculator. Only plain-number cards (no inputs of their own) can be the
// x-axis, so no card's equation is ever overridden. The lines are cards that
// change with that input, so they all share meaningful axes. Every other
// input the lines use gets a slider: a "what if" kept on the plot
// (plot.overrides) that never changes the cards themselves.

export const SAMPLES = 241;

// The smallest of 1, 2, 2.5, 5 × 10^k that is at least `value`.
const niceCeil = (value) => {
    const magnitude = 10 ** Math.floor(Math.log10(value));
    return [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= value * (1 - 1e-12));
};

// Cards with no inputs: plain numbers like `r = 3` (or `2+3`, `\pi`).
export const isLeaf = (nodes, id) => inputsOf(nodes, nodes[id]).length === 0;

// The plain-number cards an equation is computed from, nearest first.
export const leafInputs = (nodes, id) =>
    dependencyIds(nodes, id).filter((n) => n !== id && isLeaf(nodes, n));

export const defaultPlotFor = (nodes, targetId) => ({
    xId: leafInputs(nodes, targetId)[0] || null,
    series: [targetId],
    extra: [],
    overrides: {},
    view: null,
});

// Labels for cards, disambiguating repeated names ("a (in R)") since
// different branches can use the same variable name.
const labelsFor = (doc, ids) => {
    const names = Object.fromEntries(ids.map((id) => [id, nodeLabel(doc, id)]));
    const counts = {};
    ids.forEach((id) => (counts[names[id]] = (counts[names[id]] || 0) + 1));
    return Object.fromEntries(
        ids.map((id) => {
            const parent = doc.nodes[id].parent;
            const repeated = counts[names[id]] > 1 && parent;
            return [id, repeated ? `${names[id]} (in ${nodeLabel(doc, parent)})` : names[id]];
        })
    );
};

/**
 * The y range to show: everything, unless a few values shoot far beyond the
 * rest (next to an asymptote), in which case those spikes are left out.
 */
export const robustRange = (values) => {
    const finite = values.filter((v) => v !== null).sort((a, b) => a - b);
    if (finite.length === 0) return [-1, 1];
    let lo = finite[0];
    let hi = finite[finite.length - 1];
    if (finite.length >= 20) {
        const pick = (q) => finite[Math.min(finite.length - 1, Math.floor(q * finite.length))];
        const p02 = pick(0.02);
        const p98 = pick(0.98);
        const core = Math.max(p98 - p02, 1e-12);
        if (hi - p98 > 2 * core) hi = p98;
        if (p02 - lo > 2 * core) lo = p02;
    }
    if (hi - lo < 1e-9) {
        const pad = Math.max(Math.abs(lo) * 0.5, 1);
        return [lo - pad, hi + pad];
    }
    const pad = (hi - lo) * 0.06;
    return [lo - pad, hi + pad];
};

const valueOf = (nodes, id, overrides = {}) => toReal(evaluateSubtree(nodes, id, overrides)[id]);

// Values of several cards with some cards pinned to fixed values. Cards
// outside what's already been evaluated (from other trees) get their own pass.
const valuesWith = (nodes, ids, overrides) => {
    const values = {};
    return ids.map((id) => {
        if (!(id in values)) Object.assign(values, evaluateSubtree(nodes, id, overrides));
        return toReal(values[id]);
    });
};

// A slider's range: around the card's own value, stretched to include the
// slider's current value.
export const sliderRange = (base, value) => {
    const center = base === null ? value || 0 : base;
    const span = Math.max(Math.abs(center), 1);
    return [Math.min(center - span, value), Math.max(center + span, value)];
};

const sample = (from, to, samples, valuesAtX) => {
    const xs = [];
    const columns = [];
    for (let i = 0; i < samples; i++) {
        const x = from + ((to - from) * i) / (samples - 1);
        xs.push(x);
        columns.push(valuesAtX(x));
    }
    return { xs, columns };
};

const noTarget = { message: "This equation was deleted", lines: [] };

/**
 * A graph of plot.targetId (and any cards dropped onto it, plot.extra)
 * against the input plot.xId, with plot.overrides holding slider values for
 * the other inputs. Any plain-number input of the equation or of a dropped
 * card can be the x-axis. Only lines that change with x are drawn; the others
 * are listed with `uses: false`. `visibleX` ([x0, x1]) is the part of the
 * x-axis on screen, so only that is sampled, at `samples` points per line.
 */
export const buildPlot = (doc, plot, targetLabel, visibleX = null, samples = SAMPLES) => {
    const { nodes } = doc;
    const target = plot.targetId;
    if (!nodes[target]) return noTarget;

    const closure = dependencyIds(nodes, target);
    const extra = (plot.extra || []).filter((id) => nodes[id] && id !== target);
    const leaves = [...new Set([target, ...extra].flatMap((id) => leafInputs(nodes, id)))];
    const named = [...new Set([...closure.slice(1), ...extra, ...leaves])];
    const labels = { ...labelsFor(doc, named), [target]: targetLabel };
    const candidates = leaves.map((id) => ({ id, label: labels[id] }));
    if (leaves.length === 0) {
        return {
            candidates,
            lines: [],
            sliders: [],
            message: isLeaf(nodes, target)
                ? `${targetLabel} is a plain number: plot an equation that uses it instead`
                : `Add a variable to ${targetLabel} to plot it`,
        };
    }
    const xId = leaves.includes(plot.xId) ? plot.xId : leaves[0];
    const uses = (id) => id !== xId && dependsOn(nodes, id, xId);

    // the lines to choose from: the equation, the cards between it and x,
    // and the dropped cards (whether or not they use x, so they can be seen)
    const between = closure.slice(1).filter(uses);
    const options = [
        { id: target, kind: "target" },
        ...between.map((id) => ({ id, kind: "between" })),
        ...extra.filter((id) => !between.includes(id)).map((id) => ({ id, kind: "extra" })),
    ].map((option, index) => ({
        ...option,
        index,
        color: index,
        label: labels[option.id] || nodeLabel(doc, option.id),
        uses: uses(option.id),
        // a dropped card that doesn't use x can be seen against its own inputs
        inputs: uses(option.id) ? [] : leafInputs(nodes, option.id).map((id) => ({ id, label: labels[id] })),
    }));
    const picked = options.filter((o) => (plot.series || []).includes(o.id));
    const shown = (picked.length > 0 ? picked : options.slice(0, 1)).filter((o) => o.uses);
    const ids = shown.map((o) => o.id);

    // sliders: every other plain-number input of the drawn lines
    const sliderIds = [...new Set(ids.flatMap((id) => dependencyIds(nodes, id)))].filter(
        (id) => id !== xId && isLeaf(nodes, id)
    );
    const overrides = {};
    sliderIds.forEach((id) => {
        const value = (plot.overrides || {})[id];
        if (typeof value === "number") overrides[id] = value;
    });
    const sliders = sliderIds.map((id) => {
        const base = valueOf(nodes, id);
        const value = id in overrides ? overrides[id] : base;
        return {
            id,
            label: labels[id] || nodeLabel(doc, id),
            base,
            value,
            changed: id in overrides && overrides[id] !== base,
            range: sliderRange(base, value === null ? 0 : value),
        };
    });

    const xLabel = labels[xId];
    const currentX = valueOf(nodes, xId);
    const half = Math.max(10, currentX ? niceCeil(Math.abs(currentX) * 1.5) : 10);
    const [from, to] = visibleX || [-half, half];
    const { xs, columns } = sample(from, to, ids.length ? samples : 2, (x) =>
        valuesWith(nodes, ids, { ...overrides, [xId]: x })
    );
    const lines = shown.map((o, k) => ({ ...o, xs, ys: columns.map((column) => column[k]) }));
    const allYs = lines.flatMap((line) => line.ys);

    return {
        candidates,
        xId,
        xLabel,
        options,
        lines,
        sliders,
        current: { x: currentX, ys: valuesWith(nodes, ids, overrides) },
        autoView: { x0: -half, x1: half, ...(([y0, y1]) => ({ y0, y1 }))(robustRange(allYs)) },
        message:
            lines.length === 0
                ? `Nothing shown here uses ${xLabel}: pick another x-axis or line`
                : allYs.some((y) => y !== null)
                ? null
                : "No real values here",
    };
};

// The plotted lines' values at one x, for the hover readout.
export const valuesAt = (doc, plot, model, x) => {
    const overrides = { ...(plot.overrides || {}), [model.xId]: x };
    const ys = valuesWith(doc.nodes, model.lines.map((line) => line.id), overrides);
    return model.lines.map((line, k) => ({ ...line, y: ys[k] }));
};

// Zooms a view by `factor` (< 1 zooms in) around the point (cx, cy).
export const zoomView = (view, factor, cx, cy, axes = "xy") => ({
    x0: axes.includes("x") ? cx - (cx - view.x0) * factor : view.x0,
    x1: axes.includes("x") ? cx + (view.x1 - cx) * factor : view.x1,
    y0: axes.includes("y") ? cy - (cy - view.y0) * factor : view.y0,
    y1: axes.includes("y") ? cy + (view.y1 - cy) * factor : view.y1,
});

// Round tick positions covering [min, max].
export const niceTicks = (min, max, count = 5) => {
    const span = max - min;
    if (!(span > 0)) return [min];
    const raw = span / Math.max(1, count);
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const step =
        [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ||
        10 * magnitude;
    const ticks = [];
    for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) {
        ticks.push(Math.abs(t) < step * 1e-9 ? 0 : Number(t.toPrecision(12)));
    }
    return ticks;
};

export const formatNumber = (value) => {
    if (value === null || value === undefined) return "–";
    const abs = Math.abs(value);
    if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return value.toExponential(2);
    return String(Number(value.toPrecision(6)));
};

const SUFFIXES = [
    [1e12, "T"],
    [1e9, "G"],
    [1e6, "M"],
    [1e3, "k"],
];

// Short axis labels: 2.5k, 1.2M, 0.003, 1e-7.
export const formatTick = (value) => {
    const abs = Math.abs(value);
    if (abs === 0) return "0";
    if (abs < 1e-3) return value.toExponential(0);
    if (abs >= 1e15) return value.toExponential(1);
    const suffix = SUFFIXES.find(([size]) => abs >= size);
    if (suffix) return `${Number((value / suffix[0]).toPrecision(4))}${suffix[1]}`;
    return String(Number(value.toPrecision(6)));
};
