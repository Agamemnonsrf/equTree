// Pure layout helpers. `sizes` maps card ids (equations and plots) to their
// measured { w, h }; cards that haven't been measured yet use the defaults.

export const DEFAULT_SIZE = { w: 300, h: 190 };
export const DEFAULT_PLOT_SIZE = { w: 480, h: 420 };
export const MIN_CARD_SIZE = { w: 240, h: 150 };
export const MIN_PLOT_SIZE = { w: 360, h: 320 };
export const MIN_SCALE = 0.2;
export const MAX_SCALE = 2;
// gaps leave room for the name tab above each card and the labels on lines
const GAP_X = 180;
const GAP_Y = 100;
const TREE_GAP = 200;
const PLOT_GAP = 90;
// height of the name tab sitting above each card
export const TAB_HEIGHT = 40;

const plotsOf = (doc) => doc.plots || {};

export const itemOf = (doc, id) => doc.nodes[id] || plotsOf(doc)[id];

export const sizeOf = (sizes, id, fallback = DEFAULT_SIZE) =>
    sizes[id] || fallback;

export const boxOf = (doc, sizes, id) => {
    const item = itemOf(doc, id);
    const isPlot = !doc.nodes[id];
    const size = sizeOf(sizes, id, isPlot ? DEFAULT_PLOT_SIZE : DEFAULT_SIZE);
    return { x: item.x, y: item.y, w: size.w, h: size.h, tab: size.tab || 0 };
};

export const allItemIds = (doc) => [
    ...Object.keys(doc.nodes),
    ...Object.keys(plotsOf(doc)),
];

export const childPosition = (doc, sizes, parentId) => {
    const parent = doc.nodes[parentId];
    const x = parent.x + sizeOf(sizes, parentId).w + GAP_X;
    if (parent.children.length === 0) return { x, y: parent.y };
    const bottom = Math.max(
        ...parent.children.map((id) => doc.nodes[id].y + sizeOf(sizes, id).h)
    );
    return { x, y: bottom + GAP_Y };
};

// Plots start under the equation they belong to, stacked if there are several.
export const plotPosition = (doc, sizes, targetId) => {
    const target = boxOf(doc, sizes, targetId);
    const below = Object.values(plotsOf(doc))
        .filter((plot) => plot.targetId === targetId)
        .map((plot) => boxOf(doc, sizes, plot.id))
        .reduce((bottom, box) => Math.max(bottom, box.y + box.h), target.y + target.h);
    return { x: target.x, y: below + PLOT_GAP };
};

export const boundingBox = (doc, sizes, ids = allItemIds(doc)) => {
    if (ids.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    ids.forEach((id) => {
        const box = boxOf(doc, sizes, id);
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y - TAB_HEIGHT);
        maxX = Math.max(maxX, box.x + box.w);
        maxY = Math.max(maxY, box.y + box.h);
    });
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
};

export const newTreePosition = (doc, sizes) => {
    const box = boundingBox(doc, sizes);
    if (!box) return { x: 120, y: 160 };
    return { x: box.minX, y: box.maxY + TREE_GAP };
};

// Returns a copy of the doc with the given positions applied.
export const withPositions = (doc, positions) => {
    const move = (items) =>
        Object.fromEntries(
            Object.entries(items).map(([id, item]) => [
                id,
                positions[id] ? { ...item, ...positions[id] } : item,
            ])
        );
    return { ...doc, nodes: move(doc.nodes), plots: move(plotsOf(doc)) };
};

// Lays a tree out left-to-right: one column per depth, leaves stacked
// vertically and each parent centered on its children. A card's plots go
// straight below it, after its whole branch, so the line into each plot
// runs through empty space rather than across other cards.
const layoutTree = (doc, sizes, rootId, originX) => {
    const plotsByTarget = {};
    Object.values(plotsOf(doc)).forEach((plot) => {
        (plotsByTarget[plot.targetId] = plotsByTarget[plot.targetId] || []).push(plot);
    });

    const columnWidths = [];
    const measureColumns = (id, depth) => {
        columnWidths[depth] = Math.max(columnWidths[depth] || 0, sizeOf(sizes, id).w);
        doc.nodes[id].children.forEach((c) => measureColumns(c, depth + 1));
    };
    measureColumns(rootId, 0);

    const columnX = [originX];
    for (let d = 1; d < columnWidths.length; d++) {
        columnX[d] = columnX[d - 1] + columnWidths[d - 1] + GAP_X;
    }

    const positions = {};
    // Places the branch starting at `top`; returns the lowest y it used.
    const place = (id, depth, top) => {
        const { h } = sizeOf(sizes, id);
        const children = doc.nodes[id].children;
        let bottom;
        if (children.length === 0) {
            positions[id] = { x: columnX[depth], y: top };
            bottom = top + h;
        } else {
            let cursor = top;
            children.forEach((childId, index) => {
                cursor = place(childId, depth + 1, cursor + (index ? GAP_Y : 0));
            });
            // centre on the first and last child, so a single child sits level
            const centerOf = (childId) => positions[childId].y + sizeOf(sizes, childId).h / 2;
            const center = (centerOf(children[0]) + centerOf(children[children.length - 1])) / 2;
            const y = Math.max(top, center - h / 2);
            positions[id] = { x: columnX[depth], y };
            bottom = Math.max(cursor, y + h);
        }
        (plotsByTarget[id] || []).forEach((plot) => {
            const y = bottom + GAP_Y;
            positions[plot.id] = { x: columnX[depth], y };
            bottom = y + sizeOf(sizes, plot.id, DEFAULT_PLOT_SIZE).h;
        });
        return bottom;
    };
    const bottom = place(rootId, 0, 0);
    return { positions, bottom };
};

// Tidies every tree and stacks the trees vertically, keeping the first
// tree's root where it is.
export const tidyLayout = (doc, sizes) => {
    const positions = {};
    if (doc.trees.length === 0) return positions;
    const firstRoot = doc.nodes[doc.trees[0].rootId];
    let nextTop = firstRoot.y;
    doc.trees.forEach((tree, index) => {
        const { positions: treePositions, bottom } = layoutTree(doc, sizes, tree.rootId, firstRoot.x);
        const offset =
            index === 0 ? firstRoot.y - treePositions[tree.rootId].y : nextTop;
        Object.values(treePositions).forEach((p) => (p.y += offset));
        Object.assign(positions, treePositions);
        // trees after the first start below everything the last one used
        nextTop = bottom + offset + TREE_GAP;
    });
    return positions;
};

// ---------- Connections ----------

// The 4 sides a connection can leave a card from, clockwise from the right
// (screen y points down).
const DIRECTIONS = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
];

// where the name tab sits along a card's top edge (see .equCard-varBox)
const TAB_LEFT = 26;
const TAB_TALL = 36;

const anchorPoint = (box, [dx, dy]) => {
    if (dy < 0 && box.tab) {
        // The middle of the top edge may be under the name tab, which would
        // hide the arrow: use the free part of the edge beside the tab, or
        // the top of the tab when there's no room.
        const tabRight = TAB_LEFT + box.tab;
        if (box.w / 2 < tabRight + 12) {
            if (box.w - tabRight >= 48) {
                return { x: box.x + (tabRight + box.w) / 2, y: box.y };
            }
            return { x: box.x + TAB_LEFT + box.tab / 2, y: box.y - TAB_TALL };
        }
    }
    return {
        x: box.x + (box.w * (1 + dx)) / 2,
        y: box.y + (box.h * (1 + dy)) / 2,
    };
};

// Picks the side of each box that faces the other one. Offsets are measured
// relative to the boxes' sizes, so wide cards side by side connect sideways
// even when they're a little apart vertically.
export const connectBoxes = (from, to) => {
    const dx =
        (to.x + to.w / 2 - (from.x + from.w / 2)) / Math.max(1, (from.w + to.w) / 2);
    const dy =
        (to.y + to.h / 2 - (from.y + from.h / 2)) / Math.max(1, (from.h + to.h) / 2);
    const direction = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 0 : 2) : dy >= 0 ? 1 : 3;
    const dir = DIRECTIONS[direction];
    const back = [-dir[0], -dir[1]];
    return {
        start: anchorPoint(from, dir),
        startDir: dir,
        end: anchorPoint(to, back),
        endDir: back,
        direction,
    };
};

// A cubic curve leaving `start` along startDir and arriving at `end` from
// endDir (both pointing outwards from their card). Also returns the curve's
// midpoint for labels.
export const curveBetween = (start, startDir, end, endDir) => {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const bend = Math.min(160, Math.max(40, distance * 0.4));
    const c1 = { x: start.x + startDir[0] * bend, y: start.y + startDir[1] * bend };
    const c2 = { x: end.x + endDir[0] * bend, y: end.y + endDir[1] * bend };
    return {
        d: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
        mid: {
            x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
            y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
        },
    };
};

// Most space between neighbouring connections on one side of a card.
const SPREAD = 34;

// Where the i-th of n connections meeting `side` of `box` attaches: one sits
// in the middle (or beside the name tab), several line up around the middle.
const spreadPoint = (box, side, i, n) => {
    if (n === 1) return anchorPoint(box, DIRECTIONS[side]);
    const along = (lo, hi) => {
        const mid = (lo + hi) / 2;
        const gap = Math.min(SPREAD, (hi - lo) / n);
        return mid + (i - (n - 1) / 2) * gap;
    };
    if (side === 0 || side === 2) {
        const x = side === 0 ? box.x + box.w : box.x;
        return { x, y: along(box.y + 24, box.y + box.h - 24) };
    }
    if (side === 1) {
        return { x: along(box.x + 30, box.x + box.w - 30), y: box.y + box.h };
    }
    // top: beside the name tab if there's room, otherwise on top of the tab
    const free = box.x + TAB_LEFT + (box.tab || 0) + 12;
    if (box.x + box.w - 24 - free >= 24 * n) {
        return { x: along(free, box.x + box.w - 24), y: box.y };
    }
    return {
        x: along(box.x + TAB_LEFT + 8, box.x + TAB_LEFT + (box.tab || 60) - 8),
        y: box.y - TAB_TALL,
    };
};

/**
 * Plans many connections at once ([{ key, from, to }] of item ids), so that
 * connections meeting the same side of a card sit next to each other,
 * ordered by where their other ends are, instead of on a single point.
 * Returns { [key]: { start, startDir, end, endDir } }.
 */
export const layoutConnections = (pairs, boxOfId) => {
    const sides = new Map();
    const center = (box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
    const meet = (id, side, entry) => {
        const key = `${id}:${side}`;
        if (!sides.has(key)) sides.set(key, []);
        sides.get(key).push(entry);
    };
    const planned = {};
    pairs.forEach(({ key, from, to }) => {
        const fromBox = boxOfId(from);
        const toBox = boxOfId(to);
        const { direction } = connectBoxes(fromBox, toBox);
        const back = (direction + 2) % 4;
        planned[key] = {
            startDir: DIRECTIONS[direction],
            endDir: DIRECTIONS[back],
        };
        meet(from, direction, { key, end: "start", box: fromBox, side: direction, other: center(toBox) });
        meet(to, back, { key, end: "end", box: toBox, side: back, other: center(fromBox) });
    });
    sides.forEach((entries) => {
        const vertical = entries[0].side === 0 || entries[0].side === 2;
        entries.sort((a, b) => (vertical ? a.other.y - b.other.y : a.other.x - b.other.x));
        entries.forEach((entry, i) => {
            planned[entry.key][entry.end] = spreadPoint(entry.box, entry.side, i, entries.length);
        });
        // Lines arriving at one side get their own lane for the crossing
        // segment of a right-angled route; the line coming from farthest out
        // takes the lane nearest the card, so they nest instead of crossing.
        const arriving = entries.filter((entry) => entry.end === "end");
        const box = entries[0].box;
        const middle = vertical ? box.y + box.h / 2 : box.x + box.w / 2;
        const offset = (entry) => Math.abs((vertical ? entry.other.y : entry.other.x) - middle);
        [...arriving]
            .sort((a, b) => offset(b) - offset(a))
            .forEach((entry, i) => {
                planned[entry.key].lane = ((arriving.length - 1) / 2 - i) * LANE;
            });
    });
    return planned;
};

const LANE = 12;
const CORNER = 10;

/**
 * A right-angled route: out of `start` along its side, across, and into
 * `end` along its side, with rounded corners. `lane` shifts the crossing
 * segment towards `end` (see layoutConnections). Returns null when the two
 * sides don't face each other with room between them; a curve is used then.
 * `mid` is a spot on the first segment for the line's label, so labels of
 * lines arriving at one card each stay level with their own card.
 */
export const elbowBetween = (start, startDir, end, endDir, lane = 0) => {
    const horizontal = startDir[0] !== 0;
    const a = horizontal ? "x" : "y";
    const c = horizontal ? "y" : "x";
    const outward = horizontal ? startDir[0] : startDir[1];
    if ((end[a] - start[a]) * outward < 2 * CORNER + 8) return null;
    const point = (along, across) => (horizontal ? `${along} ${across}` : `${across} ${along}`);
    const at = (along, across) => (horizontal ? { x: along, y: across } : { x: across, y: along });

    const lo = Math.min(start[a], end[a]) + CORNER + 2;
    const hi = Math.max(start[a], end[a]) - CORNER - 2;
    const turn = Math.min(hi, Math.max(lo, (start[a] + end[a]) / 2 + outward * lane));
    const shift = end[c] - start[c];
    const label = at((start[a] + turn) / 2, start[c]);
    if (Math.abs(shift) < 1) {
        return { d: `M ${point(start[a], start[c])} L ${point(end[a], end[c])}`, mid: label };
    }
    const r = Math.min(CORNER, Math.abs(shift) / 2);
    const s = Math.sign(shift);
    return {
        d: [
            `M ${point(start[a], start[c])}`,
            `L ${point(turn - outward * r, start[c])}`,
            `Q ${point(turn, start[c])} ${point(turn, start[c] + s * r)}`,
            `L ${point(turn, end[c] - s * r)}`,
            `Q ${point(turn, end[c])} ${point(turn + outward * r, end[c])}`,
            `L ${point(end[a], end[c])}`,
        ].join(" "),
        mid: label,
    };
};
