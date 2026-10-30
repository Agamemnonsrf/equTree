import { evaluateAll, evaluateSubtree, parseEquation, setCalculusMode } from "./evaluate";
import { latexToMath } from "./latex";

// Builds a state from a compact description:
// { latex, children: { name: "latex" | { latex, children } } }
const build = (spec) => {
    const nodes = {};
    const make = (variable, def, parent) => {
        let id = variable || "root";
        while (nodes[id]) id += "'"; // two cards may share a name
        const latex = typeof def === "string" ? def : def.latex;
        nodes[id] = { id, parent, variable, latex, children: [] };
        Object.entries((typeof def === "object" && def.children) || {}).forEach(([name, child]) => {
            nodes[id].children.push(make(name, child, id));
        });
        return id;
    };
    make(null, spec, null);
    return { trees: [{ id: "t", rootId: "root" }], nodes };
};
const valueOf = (spec) => evaluateAll(build(spec)).root;

beforeAll(() => setCalculusMode(true));
afterAll(() => setCalculusMode(false));

describe("reading calculus notation", () => {
    const calc = (latex) => latexToMath(latex, { calculus: true }).replace(/\s+/g, " ").trim();

    test.each([
        ["\\frac{d}{dx}\\left(x^2\\right)", "calcDerivative(((x^(2))), x, 1)"],
        ["\\frac{d\\Phi}{dt}", "calcDerivative((Phi), t, 1)"],
        ["\\frac{d^2y}{dx^2}", "calcDerivative((y), x, 2)"],
        ["\\frac{\\partial f}{\\partial x}", "calcDerivative((f), x, 1)"],
        ["\\int_{0}^{1}x^2dx", "calcIntegral((x^(2)), x, (0), (1))"],
        ["\\int_0^{\\infty}e^{-t}\\ dt+1", "calcIntegral((e^(-t)), t, (0), (Infinity))+1"],
        ["\\sum_{n=1}^{10}n^2+1", "calcSum((n^(2)), n, (1), (10))+1"],
        ["\\prod_{k=1}^{5}k", "calcProduct((k), k, (1), (5))"],
        ["\\lim_{x\\to0}\\frac{\\sin\\left(x\\right)}{x}", "calcLimit((((sin(x))/(x))), x, (0))"],
        // typed without a subscript, as MathQuill writes "lim x->0 ..."
        ["\\lim x->0\\frac{\\sin\\left(x\\right)}{x}", "calcLimit((((sin(x))/(x))), x, (0))"],
        ["\\lim_{x->\\infty}\\frac{1}{x}", "calcLimit((((1)/(x))), x, (Infinity))"],
        // typed lim_{x→0} sin(x) / x: MathQuill puts the lim in the numerator
        ["\\frac{\\lim_{x->0}\\sin\\left(x\\right)}{x}", "calcLimit((((sin(x))/(x))), x, (0))"],
    ])("%s", (latex, expected) => {
        expect(calc(latex)).toBe(expected);
    });

    test("a plain fraction stays a fraction", () => {
        expect(calc("\\frac{d}{2}")).toBe("((d)/(2))");
    });

    test("helpful errors", () => {
        expect(() => calc("\\int_0^1x^2")).toThrow(/dx/);
        expect(() => calc("\\int x\\ dx")).toThrow(/limits/);
        expect(() => calc("\\sum_{n}^{5}n")).toThrow(/n=1/);
        expect(() => latexToMath("\\int_0^1xdx")).toThrow(/calculus mode/);
    });
});

describe("calculus in cards", () => {
    test("variables bound by calculus aren't missing inputs", () => {
        expect(parseEquation("\\int_{0}^{1}x^2dx").symbols).toEqual([]);
        expect(parseEquation("\\int_{0}^{a}x\\cdot b\\ dx").symbols.sort()).toEqual(["a", "b"]);
    });

    test("integrals, sums, products and limits with local variables", () => {
        expect(valueOf({ latex: "\\int_{0}^{1}x^2dx" }).value).toBeCloseTo(1 / 3, 10);
        expect(valueOf({ latex: "\\int_0^{\\infty}e^{-x}dx" }).value).toBeCloseTo(1, 10);
        expect(valueOf({ latex: "\\sum_{n=1}^{100}n" }).value).toBe(5050);
        expect(valueOf({ latex: "\\sum_{n=1}^{\\infty}\\frac{1}{n^2}" }).value).toBeCloseTo(Math.PI ** 2 / 6, 7);
        expect(valueOf({ latex: "\\prod_{k=1}^{5}k" }).value).toBe(120);
        expect(valueOf({ latex: "\\lim_{x\\to0}\\frac{\\sin\\left(x\\right)}{x}" }).value).toBeCloseTo(1, 9);
    });

    test("limits and other inputs can come from cards", () => {
        const result = valueOf({ latex: "\\int_{0}^{a}k\\cdot x\\ dx", children: { a: "2", k: "3" } });
        expect(result.value).toBeCloseTo(6, 10);
        expect(result.ok).toBe(true);
    });

    test("a derivative is taken at the value of the card it's about", () => {
        const result = valueOf({ latex: "\\frac{d}{dx}\\left(x^3\\right)", children: { x: "2" } });
        expect(result.value).toBe(12);
        // x is used (by the derivative), so it isn't flagged unused
        expect(result.ok).toBe(true);
    });

    test("Faraday's law: dΦ/dt through the tree", () => {
        // EMF = -N dΦ/dt, Φ = B·A·cos(ωt): EMF = N·B·A·ω·sin(ωt)
        const doc = build({
            latex: "-N\\frac{d\\Phi}{dt}",
            children: {
                N: "100",
                Phi: {
                    latex: "B\\cdot A\\cos\\left(\\omega t\\right)",
                    children: { B: "0.5", A: "0.02", omega: "60", t: "0.01" },
                },
            },
        });
        // the equation writes ω as \omega, so the card is named omega
        const results = evaluateAll(doc);
        expect(results.root.value).toBeCloseTo(100 * 0.5 * 0.02 * 60 * Math.sin(0.6), 6);
        // and it plots: sweeping t moves the EMF along its sine
        const at = (t) => evaluateSubtree(doc.nodes, "root", { t })["root"];
        expect(at(0)).toBeCloseTo(0, 6);
        expect(at(Math.PI / 120)).toBeCloseTo(60, 5);
    });

    test("dΦ/dt uses the t that Φ depends on, not another card named t", () => {
        // the root also has a card t of its own, which Φ doesn't read
        const doc = build({
            latex: "-N\\frac{df}{dt}",
            children: {
                N: "10",
                f: {
                    latex: "B\\cdot A\\cdot\\cos\\left(w\\cdot t\\right)",
                    children: { B: "2", A: "3", w: "4", t: "5" },
                },
                t: "20",
            },
        });
        const results = evaluateAll(doc);
        expect(results.root.value).toBeCloseTo(10 * 2 * 3 * 4 * Math.sin(20), 5);
        // and the root's own t, which changes nothing, is marked unused
        const rootT = doc.nodes.root.children.find((id) => id !== "f" && doc.nodes[id].variable === "t");
        expect(results[rootT].unused).toBe(true);
    });

    test("a derivative with nothing to say where it's taken explains itself", () => {
        expect(valueOf({ latex: "\\frac{d}{dq}\\left(q^2\\right)" }).error).toMatch(/card named q/);
    });

    test("calculus notation needs calculus mode", () => {
        setCalculusMode(false);
        expect(valueOf({ latex: "\\int_{0}^{1}x^2dx" }).error).toMatch(/calculus mode/);
        setCalculusMode(true);
    });
});
