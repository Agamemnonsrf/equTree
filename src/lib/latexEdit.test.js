import { findVariable, removeVariable } from "./latexEdit";
import { parseEquation } from "./evaluate";

describe("findVariable", () => {
    test("matches whole names only", () => {
        expect(findVariable("ab+a", "a")).toEqual([{ start: 3, end: 4 }]);
        expect(findVariable("x_1+x_{12}+x", "x_12")).toEqual([{ start: 4, end: 10 }]);
        expect(findVariable("2\\theta", "theta")).toEqual([{ start: 1, end: 7 }]);
    });

    test("skips commands and word arguments", () => {
        expect(findVariable("\\sin\\left(s\\right)", "s")).toHaveLength(1);
        expect(findVariable("\\operatorname{abs}\\left(a\\right)", "a")).toHaveLength(1);
        expect(findVariable("\\cdot", "c")).toEqual([]);
    });
});

describe("removeVariable", () => {
    test.each([
        ["300+R+j", "j", "300+R"],
        ["j+300", "j", "300"],
        ["a-j", "j", "a"],
        ["j-3", "j", "-3"],
        ["2\\cdot j", "j", "2"],
        ["j\\cdot 2", "j", "2"],
        ["2j", "j", "2"],
        ["R^j+1", "j", "R+1"],
        ["R^{j}+1", "j", "R+1"],
        ["\\left(j+2\\right)\\cdot3", "j", "\\left(2\\right)\\cdot3"],
        ["j+j+1", "j", "1"],
        ["ab+a", "a", "ab"],
    ])("%s without %s is %s", (latex, name, expected) => {
        expect(removeVariable(latex, name)).toBe(expected);
    });

    test("the result no longer needs the variable", () => {
        const before = parseEquation("300+R+j");
        const after = parseEquation(removeVariable("300+R+j", "j"));
        expect(before.symbols).toContain("j");
        expect(after.symbols).toEqual(["R"]);
    });
});
