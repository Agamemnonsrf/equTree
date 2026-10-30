import { latexToMath } from "./latex";
import { evaluate } from "mathjs";

const evalLatex = (latex, scope = {}) => evaluate(latexToMath(latex), scope);

describe("latexToMath", () => {
    test.each([
        ["1+2", 3],
        ["2\\cdot3", 6],
        ["6\\div4", 1.5],
        ["\\frac{1}{4}", 0.25],
        ["\\frac{\\sqrt{16}}{2}", 2],
        ["\\frac{1}{\\frac{1}{2}}", 2],
        ["\\sqrt{9}", 3],
        ["\\sqrt[3]{27}", 3],
        ["\\sqrt[3]{-8}", -2],
        ["2^{10}", 1024],
        ["2^3", 8],
        ["2^{1+2}", 8],
        ["\\left(1+2\\right)\\cdot4", 12],
        ["2\\left(3\\right)", 6],
        ["\\left|-5\\right|", 5],
        ["\\operatorname{abs}\\left(-3\\right)", 3],
        ["\\ln\\left(e\\right)", 1],
        ["\\log\\left(1000\\right)", 3],
        ["\\log_2\\left(8\\right)", 3],
        ["\\log_{2}\\left(8\\right)", 3],
        ["\\sin\\left(0\\right)", 0],
        ["\\cos 0", 1],
        ["\\arctan\\left(0\\right)", 0],
        ["5!", 120],
    ])("%s = %p", (latex, expected) => {
        expect(evalLatex(latex)).toBeCloseTo(expected, 10);
    });

    test("pi and implicit multiplication", () => {
        expect(evalLatex("2\\pi")).toBeCloseTo(2 * Math.PI);
        expect(evalLatex("\\pi r^2", { r: 2 })).toBeCloseTo(4 * Math.PI);
        expect(evalLatex("x\\sqrt{y}", { x: 2, y: 9 })).toBe(6);
        expect(evalLatex("2x", { x: 4 })).toBe(8);
    });

    test("multi-letter, greek and subscripted variables", () => {
        expect(latexToMath("ab+c")).toBe("ab+c");
        expect(evalLatex("\\theta+1", { theta: 1 })).toBe(2);
        expect(evalLatex("x_1+x_{2}", { x_1: 1, x_2: 2 })).toBe(3);
    });

    test("rejects unbalanced or unsupported input", () => {
        expect(() => latexToMath("\\frac{1}")).toThrow();
        expect(() => latexToMath("\\left(1+2")).toThrow();
        expect(() => latexToMath("1}")).toThrow();
        expect(() => latexToMath("\\pm 1")).toThrow(/Unsupported/);
    });

    test("empty input", () => {
        expect(latexToMath("")).toBe("");
        expect(latexToMath(undefined)).toBe("");
    });
});
