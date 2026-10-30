// Converts the LaTeX produced by MathQuill into an expression string that
// mathjs can parse. Written as a small recursive descent parser so nested
// groups like \frac{\sqrt{x}}{2} come out right.

const FUNCTIONS = {
    sin: "sin",
    cos: "cos",
    tan: "tan",
    cot: "cot",
    sec: "sec",
    csc: "csc",
    cosec: "csc",
    arcsin: "asin",
    arccos: "acos",
    arctan: "atan",
    arccot: "acot",
    arcsec: "asec",
    arccsc: "acsc",
    sinh: "sinh",
    cosh: "cosh",
    tanh: "tanh",
    coth: "coth",
    sech: "sech",
    csch: "csch",
    ln: "log",
    log: "log10",
    lg: "log10",
    exp: "exp",
    max: "max",
    min: "min",
    gcd: "gcd",
    abs: "abs",
    floor: "floor",
    ceil: "ceil",
    round: "round",
    sign: "sign",
    mod: "mod",
};

export const GREEK = [
    "alpha",
    "beta",
    "gamma",
    "delta",
    "epsilon",
    "varepsilon",
    "zeta",
    "eta",
    "theta",
    "vartheta",
    "iota",
    "kappa",
    "lambda",
    "mu",
    "nu",
    "xi",
    "rho",
    "varrho",
    "sigma",
    "varsigma",
    "tau",
    "upsilon",
    "phi",
    "varphi",
    "chi",
    "psi",
    "omega",
    "Gamma",
    "Delta",
    "Theta",
    "Lambda",
    "Xi",
    "Sigma",
    "Upsilon",
    "Phi",
    "Psi",
    "Omega",
];

const OPERATORS = {
    cdot: "*",
    times: "*",
    ast: "*",
    div: "/",
    le: "<=",
    leq: "<=",
    ge: ">=",
    geq: ">=",
    ne: "!=",
    neq: "!=",
    lt: "<",
    gt: ">",
    infty: " Infinity ",
    pi: " pi ",
    "%": "%",
    "{": "(",
    "}": ")",
};

const SPACES = new Set([" ", ",", ";", ":", "!", "quad", "qquad"]);

const OPENERS = { "(": "(", "[": "(", "{": "(", "|": " abs(", ".": "(" };

const IDENTIFIER = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const CALCULUS_COMMANDS = { int: "∫", sum: "Σ", prod: "∏", lim: "lim", partial: "∂" };

/**
 * With `calculus`, calculus notation becomes calls the evaluator handles
 * (see lib/calculus.js and evaluate.js):
 *   \frac{d}{dx}E, \frac{dy}{dx}, \frac{d^2y}{dx^2}  →  calcDerivative(E, x, order)
 *   \int_{a}^{b} E dx                                 →  calcIntegral(E, x, a, b)
 *   \sum_{n=a}^{b} E, \prod_{n=a}^{b} E               →  calcSum / calcProduct(E, n, a, b)
 *   \lim_{x\to a} E                                    →  calcLimit(E, x, a)
 * The operand of d/dx, Σ, ∏ and lim is the term after it (up to a + or -
 * outside brackets); an integral's runs up to its dx.
 */
export const latexToMath = (latex, options = {}) => {
    const s = latex || "";
    const calculus = Boolean(options.calculus);
    let i = 0;

    const peek = (str) => s.startsWith(str, i);
    const convert = (raw) => latexToMath(raw, options);

    const skipSpaces = () => {
        while (i < s.length && /\s/.test(s[i])) i++;
    };

    // Index just past the {group} that starts at `from`.
    const groupEnd = (from) => {
        let depth = 0;
        for (let j = from; j < s.length; j++) {
            if (s[j] === "\\") {
                j++;
                continue;
            }
            if (s[j] === "{") depth++;
            if (s[j] === "}" && --depth === 0) return j + 1;
        }
        throw new Error("Unbalanced brackets");
    };

    // The LaTeX of the next argument, unconverted: {group}, \command or a character.
    const readRaw = () => {
        skipSpaces();
        if (i >= s.length) throw new Error("Missing argument");
        if (s[i] === "{") {
            const end = groupEnd(i);
            const raw = s.slice(i + 1, end - 1);
            i = end;
            return raw;
        }
        if (s[i] === "\\") {
            const match = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
            i += match[0].length;
            return match[0];
        }
        return s[i++];
    };

    const identifier = (raw) => {
        const name = convert(raw).trim();
        if (!IDENTIFIER.test(name)) throw new Error(`"${raw}" isn't a variable name`);
        return name;
    };

    // The term after an operator like d/dx or Σ: everything up to a + or -
    // outside brackets (a leading sign belongs to the term).
    const parseTerm = () => {
        let out = "";
        let first = true;
        skipSpaces();
        while (i < s.length && s[i] !== "}" && !peek("\\right")) {
            if (!first && (s[i] === "+" || s[i] === "-")) break;
            out += parseAtom();
            first = false;
        }
        if (!out.trim()) throw new Error("Write what it applies to right after it");
        return `(${out})`;
    };

    // Optional _{...} and ^{...} after \int, \sum, \prod, \lim (either order).
    const readLimits = () => {
        const limits = {};
        for (let k = 0; k < 2; k++) {
            skipSpaces();
            if (s[i] === "_") {
                i++;
                limits.lower = readRaw();
            } else if (s[i] === "^") {
                i++;
                limits.upper = readRaw();
            }
        }
        return limits;
    };

    // \frac{d}{dx}, \frac{dy}{dx}, \frac{d^2y}{dx^2} (or with \partial).
    const derivative = (numerator, denominator) => {
        const top = /^\s*(?:d|\\partial)\s*(?:\^\s*\{?\s*(\d+)\s*\}?)?\s*([\s\S]*)$/.exec(numerator);
        const bottom = /^\s*(?:d|\\partial)\s*([\s\S]+?)\s*(?:\^\s*\{?\s*(\d+)\s*\}?)?\s*$/.exec(denominator);
        if (!top || !bottom) return null;
        let name;
        try {
            name = identifier(bottom[1]);
        } catch (err) {
            return null;
        }
        const order = Number(top[1] || 1);
        if (order !== Number(bottom[2] || 1)) {
            throw new Error(`The orders in d^${top[1] || 1}/d${name}^${bottom[2] || 1} don't match`);
        }
        const operand = top[2].trim() ? `(${convert(top[2])})` : parseTerm();
        return ` calcDerivative(${operand}, ${name}, ${order})`;
    };

    // \int_{a}^{b} ... dx: the integrand runs up to the last "d<variable>"
    // at this level of brackets.
    const integral = () => {
        const { lower, upper } = readLimits();
        let depth = 0;
        let differential = null;
        let j = i;
        for (; j < s.length; j++) {
            if (s.startsWith("\\left", j)) depth++;
            else if (s.startsWith("\\right", j)) {
                if (depth === 0) break;
                depth--;
            } else if (s[j] === "\\") {
                // skip the command: a word (\cdot) or one character (\ or \,)
                j++;
                if (/[a-zA-Z]/.test(s[j] || "")) {
                    while (/[a-zA-Z]/.test(s[j + 1] || "")) j++;
                }
                continue;
            } else if (s[j] === "{") depth++;
            else if (s[j] === "}") {
                if (depth === 0) break;
                depth--;
            } else if (s[j] === "d" && depth === 0) {
                const variable = /^d\s*(\\[a-zA-Z]+|[a-zA-Z][a-zA-Z0-9]*(?:_(?:\{[^}]*\}|[a-zA-Z0-9]))?)/.exec(s.slice(j));
                if (variable && j > i) differential = { at: j, raw: variable[1], end: j + variable[0].length };
            }
        }
        if (!differential) throw new Error("End the integral with d and its variable, like dx");
        if (lower === undefined || upper === undefined) {
            throw new Error("Give the integral both limits (∫ from a to b)");
        }
        const integrand = s.slice(i, differential.at);
        i = differential.end;
        return ` calcIntegral((${convert(integrand)}), ${identifier(differential.raw)}, (${convert(lower)}), (${convert(upper)}))`;
    };

    // \sum_{n=1}^{10} E and \prod_{n=1}^{10} E
    const series = (fn) => {
        const { lower, upper } = readLimits();
        const start = lower === undefined ? null : /^([\s\S]+?)=([\s\S]+)$/.exec(lower);
        if (!start || upper === undefined) {
            throw new Error("Give the start and end, like n=1 below and 10 above");
        }
        const name = identifier(start[1]);
        return ` ${fn}(${parseTerm()}, ${name}, (${convert(start[2])}), (${convert(upper)}))`;
    };

    // \lim_{x\to a} E, or typed inline: \lim x->a E
    const limit = () => {
        const { lower } = readLimits();
        let target = lower === undefined ? null : /^([\s\S]+?)(?:\\to|\\rightarrow|-\s*(?:>|\\gt|&gt;)|=)([\s\S]+)$/.exec(lower);
        if (!target) {
            target = /^\s*([a-zA-Z][a-zA-Z0-9]*(?:_\{?[a-zA-Z0-9]+\}?)?|\\[a-zA-Z]+)\s*(?:\\to|\\rightarrow|-\s*(?:>|\\gt|&gt;))\s*(-?\s*(?:\\infty|\\pi|[0-9.]+|[a-zA-Z]+))\s*/.exec(s.slice(i));
            if (target) i += target[0].length;
        }
        if (!target) throw new Error("Write where the limit goes, like lim x->0");
        const name = identifier(target[1]);
        return ` calcLimit(${parseTerm()}, ${name}, (${convert(target[2])}))`;
    };

    // Reads a sequence until a closing brace, the given terminator, or \right.
    const parseSeq = (terminator) => {
        let out = "";
        while (i < s.length) {
            if (s[i] === "}" || peek("\\right")) break;
            if (terminator && s[i] === terminator) break;
            out += parseAtom();
        }
        return out;
    };

    const expect = (char) => {
        if (s[i] !== char) {
            throw new Error(`Expected "${char}"`);
        }
        i++;
    };

    // A single argument: {group}, \command or one character.
    const parseArg = () => {
        skipSpaces();
        if (i >= s.length) throw new Error("Missing argument");
        if (s[i] === "{") {
            i++;
            const inner = parseSeq();
            expect("}");
            return inner;
        }
        if (s[i] === "\\") return parseCommand();
        return s[i++];
    };

    const readCommandName = () => {
        // assumes s[i] === "\\"
        i++;
        const match = /^[a-zA-Z]+/.exec(s.slice(i));
        if (match) {
            i += match[0].length;
            return match[0];
        }
        return s[i++] || "";
    };

    const readDelimiter = () => {
        skipSpaces();
        if (s[i] === "\\") {
            const name = readCommandName();
            if (name === "{") return "{";
            if (name === "}") return "}";
            if (name === "|") return "|";
            if (name === "lbrace") return "{";
            if (name === "rbrace") return "}";
            if (name === "vert") return "|";
            return name;
        }
        return s[i++];
    };

    const parseFunction = (fn) => {
        let base = null;
        skipSpaces();
        if (s[i] === "_") {
            i++;
            base = parseArg();
        }
        skipSpaces();
        let arg;
        if (peek("\\left") || s[i] === "(") {
            arg = parseAtom();
        } else {
            arg = `(${parseAtom()})`;
        }
        if (base !== null && fn === "log10") {
            return ` log(${arg}, ${base})`;
        }
        return ` ${fn}${arg}`;
    };

    const parseCommand = () => {
        const name = readCommandName();

        if (name === "left") {
            const open = readDelimiter();
            const inner = parseSeq();
            if (!peek("\\right")) throw new Error("Unbalanced brackets");
            readCommandName();
            readDelimiter();
            return `${OPENERS[open] || "("}${inner})`;
        }
        if (name === "right") {
            readDelimiter();
            return ")";
        }
        if (name === "frac" || name === "dfrac" || name === "tfrac") {
            if (calculus) {
                const numerator = readRaw();
                const denominator = readRaw();
                // Typing "lim_{x→0} sin(x) / x", MathQuill's "/" pulls the lim
                // into the numerator; it belongs in front of the fraction.
                const pulledIn = /^\s*\\lim\s*((?:[_^]\s*(?:\{[^{}]*\}|\\?[a-zA-Z0-9]))*)([\s\S]+)$/.exec(numerator);
                if (pulledIn && pulledIn[1] && pulledIn[2].trim()) {
                    return convert(`\\lim${pulledIn[1]}\\frac{${pulledIn[2]}}{${denominator}}`);
                }
                return (
                    derivative(numerator, denominator) ||
                    `((${convert(numerator)})/(${convert(denominator)}))`
                );
            }
            const num = parseArg();
            const den = parseArg();
            return `((${num})/(${den}))`;
        }
        if (name in CALCULUS_COMMANDS) {
            if (!calculus) throw new Error(`Turn on calculus mode to use ${CALCULUS_COMMANDS[name]}`);
            if (name === "int") return integral();
            if (name === "sum") return series("calcSum");
            if (name === "prod") return series("calcProduct");
            if (name === "lim") return limit();
            throw new Error("Use ∂ in a fraction, like ∂f/∂x");
        }
        if (name === "sqrt") {
            skipSpaces();
            if (s[i] === "[") {
                i++;
                const n = parseSeq("]");
                expect("]");
                const radicand = parseArg();
                return ` nthRoot(${radicand}, ${n})`;
            }
            return ` sqrt(${parseArg()})`;
        }
        if (
            name === "operatorname" ||
            name === "mathrm" ||
            name === "text" ||
            name === "mathit"
        ) {
            const word = parseArg().replace(/[^a-zA-Z0-9_]/g, "");
            // MathQuill may write a typed "lim" as \operatorname{lim}
            if (word === "lim") {
                if (!calculus) throw new Error("Turn on calculus mode to use lim");
                return limit();
            }
            if (FUNCTIONS[word]) return parseFunction(FUNCTIONS[word]);
            return ` ${word}`;
        }
        if (FUNCTIONS[name]) return parseFunction(FUNCTIONS[name]);
        if (GREEK.includes(name)) return ` ${name} `;
        if (name in OPERATORS) return OPERATORS[name];
        if (SPACES.has(name)) return " ";

        throw new Error(`Unsupported symbol \\${name}`);
    };

    const parseAtom = () => {
        const c = s[i];
        if (c === "{") {
            i++;
            const inner = parseSeq();
            expect("}");
            return `(${inner})`;
        }
        if (c === "\\") return parseCommand();
        if (c === "^") {
            i++;
            return `^(${parseArg()})`;
        }
        if (c === "_") {
            i++;
            const sub = parseArg().replace(/[^a-zA-Z0-9]/g, "");
            return `_${sub}`;
        }
        i++;
        if (/\s/.test(c)) return "";
        return c;
    };

    let out = "";
    while (i < s.length) {
        out += parseSeq();
        if (i < s.length) {
            // stray "}" or "\right" at the top level
            throw new Error("Unbalanced brackets");
        }
    }
    return out.trim();
};
