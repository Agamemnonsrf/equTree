import { derivative, integrate, limit, product, sum } from "./calculus";

describe("derivative", () => {
    test.each([
        ["x² at 3", (x) => x * x, 3, 1, 6],
        ["x² at 0", (x) => x * x, 0, 1, 0],
        ["sin at 0", Math.sin, 0, 1, 1],
        ["eˣ at 1", Math.exp, 1, 1, Math.E],
        ["x³'' at 2", (x) => x ** 3, 2, 2, 12],
        ["sin''' at 0", Math.sin, 0, 3, -1],
    ])("%s", (_, f, x0, order, expected) => {
        expect(derivative(f, x0, order)).toBeCloseTo(expected, order === 1 ? 8 : 3);
    });

    test("clean results come out exact", () => {
        expect(derivative((x) => x * x, 3)).toBe(6);
        expect(derivative((x) => x * x, 0)).toBe(0);
    });
});

describe("integrate", () => {
    test.each([
        ["x² from 0 to 1", (x) => x * x, 0, 1, 1 / 3],
        ["sin from 0 to π", Math.sin, 0, Math.PI, 2],
        ["backwards", (x) => x, 1, 0, -0.5],
        ["e^-x from 0 to ∞", (x) => Math.exp(-x), 0, Infinity, 1],
        ["Gaussian over everything", (x) => Math.exp(-x * x), -Infinity, Infinity, Math.sqrt(Math.PI)],
        ["1/x² from 1 to ∞", (x) => 1 / (x * x), 1, Infinity, 1],
        ["1/√x from 0 to 1 (blows up at 0)", (x) => 1 / Math.sqrt(x), 0, 1, 2],
    ])("%s", (_, f, a, b, expected) => {
        expect(integrate(f, a, b)).toBeCloseTo(expected, 6);
    });

    test("1/x from 0 to 1 doesn't converge", () => {
        expect(() => integrate((x) => 1 / x, -1, 1)).toThrow();
    });
});

describe("sum and product", () => {
    test("finite sums and products", () => {
        expect(sum((n) => n, 1, 100)).toBe(5050);
        expect(product((n) => n, 1, 5)).toBe(120);
    });

    test("fast infinite sums stop on their own", () => {
        expect(sum((n) => 1 / 2 ** n, 0, Infinity)).toBe(2);
        const factorial = (n) => (n <= 1 ? 1 : n * factorial(n - 1));
        expect(sum((n) => 1 / factorial(n), 0, Infinity)).toBeCloseTo(Math.E, 10);
    });

    test("slow infinite sums are extrapolated", () => {
        expect(sum((n) => 1 / (n * n), 1, Infinity)).toBeCloseTo(Math.PI ** 2 / 6, 7);
        expect(sum((n) => (n % 2 ? 4 : -4) / (2 * n - 1), 1, Infinity)).toBeCloseTo(Math.PI, 6);
    });

    test("divergent sums say so", () => {
        expect(() => sum((n) => 1 / n, 1, Infinity)).toThrow(/doesn't converge/);
    });
});

describe("limit", () => {
    test.each([
        ["sin x / x → 1", (x) => Math.sin(x) / x, 0, 1],
        ["(eˣ - 1) / x → 1", (x) => (Math.exp(x) - 1) / x, 0, 1],
        ["(1 + 1/x)^x → e", (x) => (1 + 1 / x) ** x, Infinity, Math.E],
        ["1/x → 0 at ∞", (x) => 1 / x, Infinity, 0],
        ["continuous: x² at 3", (x) => x * x, 3, 9],
    ])("%s", (_, f, to, expected) => {
        expect(limit(f, to)).toBeCloseTo(expected, 7);
    });

    test("infinite and missing limits", () => {
        expect(limit((x) => 1 / (x * x), 0)).toBe(Infinity);
        expect(() => limit((x) => 1 / x, 0)).toThrow(/doesn't exist/);
        expect(() => limit((x) => Math.sign(x), 0)).toThrow(/disagree/);
    });
});
