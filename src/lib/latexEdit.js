import { GREEK } from "./latex";

// Commands whose {argument} is a word, not variables (\operatorname{abs}).
const WORD_COMMANDS = new Set(["operatorname", "mathrm", "text", "mathit"]);

const isLetter = (c) => /[a-zA-Z]/.test(c || "");

// Reads a {group} starting at `i`; returns the index just past it.
const skipGroup = (latex, i) => {
    let depth = 0;
    for (let j = i; j < latex.length; j++) {
        if (latex[j] === "{") depth++;
        if (latex[j] === "}" && --depth === 0) return j + 1;
    }
    return latex.length;
};

/**
 * Finds where variable `name` appears in MathQuill LaTeX, reading names the
 * way latexToMath does: a letter followed by letters or digits with an
 * optional subscript (x, ab, x2, x_1, x_{12}), or a Greek letter (\theta).
 * Returns [{ start, end }] ranges in the string.
 */
export const findVariable = (latex, name) => {
    const found = [];
    let i = 0;
    while (i < latex.length) {
        const c = latex[i];
        if (c === "\\") {
            let j = i + 1;
            while (isLetter(latex[j])) j++;
            const command = latex.slice(i + 1, j);
            if (command === name && GREEK.includes(command)) found.push({ start: i, end: j });
            if (WORD_COMMANDS.has(command) && latex[j] === "{") j = skipGroup(latex, j);
            i = Math.max(j, i + 2);
            continue;
        }
        if (!isLetter(c)) {
            i++;
            continue;
        }
        const start = i;
        while (/[a-zA-Z0-9]/.test(latex[i] || "")) i++;
        let identifier = latex.slice(start, i);
        if (latex[i] === "_") {
            const subStart = i + 1;
            const subEnd = latex[subStart] === "{" ? skipGroup(latex, subStart) : subStart + 1;
            identifier += `_${latex.slice(subStart, subEnd).replace(/[^a-zA-Z0-9]/g, "")}`;
            i = subEnd;
        }
        if (identifier === name) found.push({ start, end: i });
    }
    return found;
};

const LEFT_OPERATOR = /(\+|-|\\cdot|\\times|\\div|\^|_)\s*$/;
const RIGHT_OPERATOR = /^\s*(\+|-|\\cdot|\\times|\\div)\s?/;

/**
 * Removes every use of variable `name` from an equation, together with the
 * operator joining it to the rest: "300+R+j" → "300+R", "j\cdot 2" → "2".
 * A minus on its right is kept so "j-3" becomes "-3", not "3".
 */
export const removeVariable = (latex, name) => {
    let out = latex;
    findVariable(latex, name)
        .reverse()
        .forEach(({ start, end }) => {
            let before = out.slice(0, start);
            let after = out.slice(end);
            const left = LEFT_OPERATOR.exec(before);
            const right = RIGHT_OPERATOR.exec(after);
            if (left) {
                before = before.slice(0, left.index);
            } else if (right && right[1] !== "-") {
                after = after.slice(right[0].length);
            }
            out = before + after;
        });
    return out
        .replace(/[\^_]\{\s*\}/g, "")
        .replace(/^\s*\+/, "")
        .replace(/(\\left\(|\{)\s*\+/g, "$1")
        .trim();
};
