import {
    childPosition,
    connectBoxes,
    elbowBetween,
    layoutConnections,
    tidyLayout,
    newTreePosition,
    DEFAULT_SIZE,
} from "./layout";

const node = (id, parent, children, x = 0, y = 0) => ({ id, parent, children, x, y });

const doc = {
    trees: [
        { id: "t1", rootId: "a" },
        { id: "t2", rootId: "z" },
    ],
    nodes: {
        a: node("a", null, ["b", "c"], 100, 100),
        b: node("b", "a", ["d"], 900, 900),
        c: node("c", "a", [], -50, 20),
        d: node("d", "b", [], 0, 0),
        z: node("z", null, [], 0, 0),
    },
    plots: {
        p: { id: "p", targetId: "a", x: 100, y: 400 },
    },
};

const overlaps = (p, q) =>
    p.x < q.x + DEFAULT_SIZE.w &&
    q.x < p.x + DEFAULT_SIZE.w &&
    p.y < q.y + DEFAULT_SIZE.h &&
    q.y < p.y + DEFAULT_SIZE.h;

test("tidy layout keeps the first root in place and avoids overlaps", () => {
    const positions = tidyLayout(doc, {});
    expect(positions.a).toEqual({ x: 100, y: 100 });
    expect(positions.b.x).toBeGreaterThan(positions.a.x);
    expect(positions.d.x).toBeGreaterThan(positions.b.x);
    const ids = ["a", "b", "c", "d", "z"];
    ids.forEach((p, i) =>
        ids.slice(i + 1).forEach((q) => {
            expect(overlaps(positions[p], positions[q])).toBe(false);
        })
    );
    // a plot goes straight below its equation, after the whole branch
    expect(positions.p.x).toBe(positions.a.x);
    const branchBottom = Math.max(...["a", "b", "c", "d"].map((id) => positions[id].y + DEFAULT_SIZE.h));
    expect(positions.p.y).toBeGreaterThan(branchBottom);
    // the second tree goes below the first tree and its plot
    expect(positions.z.y).toBeGreaterThan(positions.p.y + 420);
});

test("new children are placed right of the parent, below their siblings", () => {
    expect(childPosition(doc, {}, "c")).toEqual({ x: -50 + DEFAULT_SIZE.w + 180, y: 20 });
    expect(childPosition(doc, {}, "a").y).toBeGreaterThan(900);
});

test("new trees go below everything", () => {
    expect(newTreePosition(doc, {}).y).toBeGreaterThan(900);
    expect(newTreePosition({ trees: [], nodes: {}, plots: {} }, {})).toEqual({ x: 120, y: 160 });
});

describe("connectBoxes", () => {
    const box = (x, y) => ({ x, y, w: 300, h: 200 });
    const parent = box(0, 0);
    // [child position, expected side of the parent, start point]
    test.each([
        ["right", box(500, 0), 0, { x: 300, y: 100 }],
        ["right, a little lower", box(500, 150), 0, { x: 300, y: 100 }],
        ["below", box(0, 400), 1, { x: 150, y: 200 }],
        ["below, a little right", box(150, 400), 1, { x: 150, y: 200 }],
        ["left", box(-500, 0), 2, { x: 0, y: 100 }],
        ["above", box(0, -400), 3, { x: 150, y: 0 }],
        ["far diagonal, mostly sideways", box(600, 400), 0, { x: 300, y: 100 }],
        ["far diagonal, mostly vertical", box(-400, -500), 3, { x: 150, y: 0 }],
    ])("%s", (_, child, direction, start) => {
        const link = connectBoxes(parent, child);
        expect(link.direction).toBe(direction);
        expect(link.start).toEqual(start);
        // the other end uses the opposite side of the child
        expect(link.endDir[0]).toBeCloseTo(-link.startDir[0]);
        expect(link.endDir[1]).toBeCloseTo(-link.startDir[1]);
    });
});

describe("connections arriving from above avoid the name tab", () => {
    const below = { x: 0, y: 600, w: 300, h: 200 };
    test("a narrow tab leaves the middle of the top edge free", () => {
        expect(connectBoxes(below, { x: 0, y: 0, w: 300, h: 200, tab: 60 }).end).toEqual({ x: 150, y: 200 });
        expect(connectBoxes({ x: 0, y: 0, w: 300, h: 200 }, { ...below, tab: 60 }).end).toEqual({ x: 150, y: 600 });
    });
    test("a wide tab pushes the arrow to the free part of the edge", () => {
        const end = connectBoxes({ x: 0, y: 0, w: 300, h: 200 }, { ...below, tab: 140 }).end;
        expect(end).toEqual({ x: (166 + 300) / 2, y: 600 });
    });
    test("with no room beside the tab the arrow lands on top of it", () => {
        const end = connectBoxes({ x: 0, y: 0, w: 240, h: 200 }, { ...below, w: 240, tab: 180 }).end;
        expect(end).toEqual({ x: 26 + 90, y: 600 - 36 });
    });
});

describe("layoutConnections", () => {
    const boxes = {
        p: { x: 0, y: 0, w: 300, h: 200 },
        a: { x: 600, y: -200, w: 200, h: 100 },
        b: { x: 600, y: 300, w: 200, h: 100 },
    };
    test("connections meeting the same side sit next to each other, in order", () => {
        const planned = layoutConnections(
            [
                { key: "b", from: "b", to: "p" },
                { key: "a", from: "a", to: "p" },
            ],
            (id) => boxes[id]
        );
        // both arrive on p's right side
        expect(planned.a.end.x).toBe(300);
        expect(planned.b.end.x).toBe(300);
        // a is above b, so its arrow is the upper one, and they don't overlap
        expect(planned.a.end.y).toBeLessThan(planned.b.end.y);
        expect(planned.b.end.y - planned.a.end.y).toBe(34);
        // single connections on a side stay centred
        expect(planned.a.start).toEqual({ x: 600, y: -150 });
    });
});

describe("right-angled routes", () => {
    test("level cards get a straight line", () => {
        const route = elbowBetween({ x: 0, y: 50 }, [1, 0], { x: 200, y: 50 }, [-1, 0]);
        expect(route.d).toBe("M 0 50 L 200 50");
    });

    test("offset cards turn twice, at right angles, halfway across", () => {
        const route = elbowBetween({ x: 0, y: 0 }, [1, 0], { x: 200, y: 100 }, [-1, 0]);
        expect(route.d).toBe("M 0 0 L 90 0 Q 100 0 100 10 L 100 90 Q 100 100 110 100 L 200 100");
        // the label sits on the first segment, level with where the line starts
        expect(route.mid).toEqual({ x: 50, y: 0 });
    });

    test("vertical routes work the same way", () => {
        const route = elbowBetween({ x: 0, y: 0 }, [0, 1], { x: 50, y: 200 }, [0, -1]);
        expect(route.d.startsWith("M 0 0 L 0 90 Q 0 100 10 100")).toBe(true);
    });

    test("sides that don't face each other fall back to a curve", () => {
        expect(elbowBetween({ x: 0, y: 0 }, [1, 0], { x: -100, y: 50 }, [-1, 0])).toBeNull();
    });

    test("lines into one side get lanes, the outermost nearest the card", () => {
        const boxes = {
            p: { x: 500, y: 0, w: 300, h: 200 },
            near: { x: 0, y: -100, w: 200, h: 100 },
            far: { x: -400, y: -300, w: 200, h: 100 },
        };
        const planned = layoutConnections(
            [
                { key: "near", from: "near", to: "p" },
                { key: "far", from: "far", to: "p" },
            ],
            (id) => boxes[id]
        );
        // both arrive on p's left side
        expect(planned.far.end.x).toBe(500);
        expect(planned.near.end.x).toBe(500);
        expect(planned.far.lane).toBeGreaterThan(planned.near.lane);
    });
});
