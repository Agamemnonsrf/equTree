import { create, all } from "mathjs";
import { latexToMath } from "./latex";
import { inputsOf } from "./tree";
import { derivative, integrate, limit, product, sum } from "./calculus";

const math = create(all);

// Symbols that resolve on their own unless a child card defines them.
const CONSTANTS = new Set(["pi", "e", "i", "Infinity"]);

const parseCache = new Map();

// In handwritten math "x(y+1)" means x times (y+1), but mathjs reads it as a
// call to a function named x. Rewrite calls to anything that isn't a real
// function into multiplications.
const toImplicitMultiplication = (root) =>
    root.transform((node) => {
        if (
            !node.isFunctionNode ||
            !node.fn.isSymbolNode ||
            typeof math[node.fn.name] === "function"
        ) {
            return node;
        }
        if (node.args.length !== 1) {
            throw new Error(`${node.fn.name} is not a function`);
        }
        return new math.OperatorNode(
            "*",
            "multiply",
            [
                node.fn,
                new math.ParenthesisNode(
                    toImplicitMultiplication(node.args[0])
                ),
            ],
            true
        );
    });

// Floating point can't store π exactly, so sin(π) comes out as 1.2e-16 instead of
// 0, and 0.1 + 0.2 - 0.3 as 5.6e-17. Like a calculator, results of trig
// functions and of sums that cancel out are snapped to 0 when they're only that
// kind of rounding noise. Genuinely tiny numbers (6.6·10^-34) are left alone,
// since they don't come from either.
const NOISE = 1e-12;
const TRIG = new Set(["sin", "cos", "tan", "cot"]);
const isNumber = (v) => typeof v === "number";
const cancelled = (result, a, b) =>
    isNumber(result) &&
    isNumber(a) &&
    isNumber(b) &&
    Math.abs(result) < NOISE * Math.max(Math.abs(a), Math.abs(b))
        ? 0
        : result;
math.import({
    snapNoise: (value) => (isNumber(value) && Math.abs(value) < NOISE ? 0 : value),
    cancelAdd: (a, b) => cancelled(math.add(a, b), a, b),
    cancelSubtract: (a, b) => cancelled(math.subtract(a, b), a, b),
});

const cleanRounding = (root) =>
    root.transform((node) => {
        if (node.isOperatorNode && node.args.length === 2 && (node.fn === "add" || node.fn === "subtract")) {
            const name = node.fn === "add" ? "cancelAdd" : "cancelSubtract";
            return new math.FunctionNode(new math.SymbolNode(name), node.args.map(cleanRounding));
        }
        if (node.isFunctionNode && node.fn.isSymbolNode && TRIG.has(node.fn.name)) {
            return new math.FunctionNode(new math.SymbolNode("snapNoise"), [
                new math.FunctionNode(node.fn, node.args.map(cleanRounding)),
            ]);
        }
        return node;
    });

// ---------- Calculus mode ----------
//
// With calculus mode on, equations can use derivatives, integrals, sums,
// products and limits (see latex.js for the notation, calculus.js for the
// numerics). Their variable is found through the tree: if what's
// differentiated (or integrated...) depends on a card of that name, that card
// is pinned to each value tried and everything in between is worked out
// again (so dΦ/dt works when Φ's card depends on t); otherwise it's a local
// variable, like x in ∫ x² dx.

let calculusMode = false;

// Calculus notation is only read in calculus mode, like a setting of the
// parser; the app sets it before evaluating.
export const setCalculusMode = (on) => {
    calculusMode = Boolean(on);
};

const CONTEXT = "equtreeCalculus";
const CALCULUS_FUNCTIONS = new Set([
    "calcDerivative",
    "calcIntegral",
    "calcSum",
    "calcProduct",
    "calcLimit",
]);

const freeSymbols = new WeakMap();
const symbolsOf = (body) => {
    if (!freeSymbols.has(body)) freeSymbols.set(body, new Set(collectSymbols(body).symbols));
    return freeSymbols.get(body);
};

// The cards named `name` that `body` (in `cardId`'s equation) depends on,
// nearest first. Only what the body reads counts: in -N dΦ/dt, a card t
// beside Φ that Φ doesn't use isn't the t that Φ changes with.
const findCards = (nodes, cardId, name, body) => {
    const symbols = symbolsOf(body);
    const found = [];
    const seen = new Set([cardId]);
    const queue = [];
    const visit = (input) => {
        if (seen.has(input.id)) return;
        seen.add(input.id);
        if (input.variable === name) found.push(input.id);
        queue.push(input.id);
    };
    inputsOf(nodes, nodes[cardId])
        .filter((input) => symbols.has(input.variable))
        .forEach(visit);
    while (queue.length) inputsOf(nodes, nodes[queue.shift()]).forEach(visit);
    return found;
};

// Lets calculus inside a card's equation vary a variable: `bind(name, body)`
// gives a function from a value to a scope where `name` has that value, and
// `pointOf(name, body)` is the value it has now (where a derivative is taken).
// Every card of that name the body depends on is pinned: t is t throughout.
const withCalculus = (scope, nodes, cardId, overrides) => {
    if (!calculusMode) return scope;
    scope[CONTEXT] = {
        bind(name, body) {
            const cards = findCards(nodes, cardId, name, body);
            if (!cards.length) {
                const local = withCalculus({ ...scope }, nodes, cardId, overrides);
                return (value) => {
                    local[name] = value;
                    return local;
                };
            }
            const byName = inputsByName(inputsOf(nodes, nodes[cardId]));
            return (value) => {
                const pins = { ...overrides };
                cards.forEach((id) => {
                    pins[id] = value;
                });
                const varied = { ...scope, [name]: value };
                Object.keys(scope).forEach((key) => {
                    const inputId = byName.get(key);
                    if (inputId) varied[key] = evaluateSubtree(nodes, inputId, pins)[inputId];
                });
                return withCalculus(varied, nodes, cardId, pins);
            };
        },
        pointOf(name, body) {
            const [pinned] = findCards(nodes, cardId, name, body);
            if (pinned) {
                return pinned in overrides ? overrides[pinned] : evaluateSubtree(nodes, pinned, overrides)[pinned];
            }
            if (name in scope) return scope[name];
            throw new Error(`d/d${name} needs a card named ${name} to say where to take it`);
        },
    };
    return scope;
};

const compiledNodes = new WeakMap();
const run = (node, scope) => {
    let compiled = compiledNodes.get(node);
    if (!compiled) {
        compiled = node.compile();
        compiledNodes.set(node, compiled);
    }
    return compiled.evaluate(scope);
};
const contextOf = (scope) => {
    const context = scope.get(CONTEXT);
    if (!context) throw new Error("Turn on calculus mode to use calculus");
    return context;
};
const realOf = (value, what) => {
    const number = toReal(value);
    if (number === null) throw new Error(`${what} isn't a real number`);
    return number;
};
const limitOf = (value) => (value === Infinity || value === -Infinity ? value : realOf(value, "A limit"));

// The calculus functions get their arguments unevaluated (rawArgs), so the
// body can be evaluated again for every value its variable takes.
const calcDerivative = ([body, variable, order], _, scope) => {
    const context = contextOf(scope);
    const at = realOf(context.pointOf(variable.name, body), variable.name);
    const bind = context.bind(variable.name, body);
    const f = (x) => realOf(run(body, bind(x)), "The function");
    return derivative(f, at, order ? realOf(run(order, scope), "The order") : 1);
};
const calcIntegral = ([body, variable, from, to], _, scope) => {
    const bind = contextOf(scope).bind(variable.name, body);
    const f = (x) => realOf(run(body, bind(x)), "What's integrated");
    return integrate(f, limitOf(run(from, scope)), limitOf(run(to, scope)));
};
const calcSeries = (combine) => ([body, variable, from, to], _, scope) => {
    const bind = contextOf(scope).bind(variable.name, body);
    const f = (n) => realOf(run(body, bind(n)), `Term ${n}`);
    return combine(f, limitOf(run(from, scope)), limitOf(run(to, scope)));
};
const calcLimit = ([body, variable, to], _, scope) => {
    const bind = contextOf(scope).bind(variable.name, body);
    const f = (x) => {
        const value = run(body, bind(x));
        return value === Infinity || value === -Infinity ? value : toReal(value) ?? NaN;
    };
    return limit(f, limitOf(run(to, scope)));
};
const calcSum = calcSeries(sum);
const calcProduct = calcSeries(product);
[calcDerivative, calcIntegral, calcSum, calcProduct, calcLimit].forEach((fn) => {
    fn.rawArgs = true;
});
math.import({ calcDerivative, calcIntegral, calcSum, calcProduct, calcLimit });

// The variables an equation needs (`symbols`) and those its calculus varies
// directly (`bound`): x in ∫ x² dx is bound there, so it isn't a missing
// input, though a card x would be used. t in -N dΦ/dt reads no card t.
const collectSymbols = (root) => {
    const symbols = [];
    const bound = [];
    const add = (list, name) => !list.includes(name) && list.push(name);
    const walk = (node, locals) => {
        if (node.isFunctionNode && node.fn.isSymbolNode && CALCULUS_FUNCTIONS.has(node.fn.name)) {
            const [body, variable, ...rest] = node.args;
            walk(body, new Set([...locals, variable.name]));
            rest.forEach((arg) => walk(arg, locals));
            return;
        }
        if (node.isSymbolNode) {
            add(locals.has(node.name) ? bound : symbols, node.name);
            return;
        }
        node.forEach((child, path) => {
            if (!(node.isFunctionNode && path === "fn")) walk(child, locals);
        });
    };
    walk(root, new Set());
    return { symbols, bound };
};

export const parseEquation = (latex) => {
    const key = `${calculusMode ? "∂" : ""}${latex || ""}`;
    if (parseCache.has(key)) return parseCache.get(key);

    let parsed;
    if (!latex || latex.trim() === "") {
        parsed = { empty: true, symbols: [], bound: [] };
    } else {
        try {
            const expression = latexToMath(latex, { calculus: calculusMode });
            const node = toImplicitMultiplication(math.parse(expression));
            if (
                node.filter(
                    (n) => n.isAssignmentNode || n.isFunctionAssignmentNode
                ).length > 0
            ) {
                throw new Error(
                    "Leave out the '=': the card's name is the variable"
                );
            }
            const { symbols, bound } = collectSymbols(node);
            parsed = {
                expression,
                symbols,
                bound,
                compiled: cleanRounding(node).compile(),
            };
        } catch (err) {
            parsed = { error: cleanError(err.message), symbols: [], bound: [] };
        }
    }

    if (parseCache.size > 500) parseCache.clear();
    parseCache.set(key, parsed);
    return parsed;
};

const cleanError = (message) => {
    if (/Unexpected end of expression/.test(message)) return "Incomplete";
    if (/Syntax error|Unexpected|Value expected|Parenthesis/.test(message)) {
        return "Invalid expression";
    }
    return message;
};

export const formatValue = (value) => math.format(value, { precision: 10 });

const isUsableValue = (value) =>
    value !== undefined &&
    value !== null &&
    typeof value !== "function" &&
    !(typeof value === "number" && Number.isNaN(value));

// Maps each variable name to the first input that provides it.
const inputsByName = (inputs) => {
    const byName = new Map();
    inputs.forEach((input) => {
        if (!byName.has(input.variable)) byName.set(input.variable, input.id);
    });
    return byName;
};

/**
 * Evaluates every card on a canvas.
 *
 * Returns { [nodeId]: {
 *   value, display, error, kind, missing, unused, duplicate, strayLinks,
 *   ok, subtreeOk
 * } }
 * where `kind` is one of "empty", "parse", "missing", "child", "eval".
 * `unused`/`duplicate` describe a card as its parent's child; `strayLinks`
 * lists the linked cards this card's equation doesn't (or can't) use.
 */
export const evaluateAll = (state) => {
    const { nodes } = state;
    const results = {};
    const inProgress = new Set();
    const resultOf = (id) =>
        (results[id] = results[id] || { unused: false, duplicate: false });

    const evaluateNode = (id) => {
        const result = resultOf(id);
        if (result.evaluated) return result;
        // links are checked for cycles when made; this guards old saves
        if (inProgress.has(id)) return { kind: "eval", error: "Circular reference" };
        inProgress.add(id);

        const node = nodes[id];
        const inputs = inputsOf(nodes, node);
        const byName = inputsByName(inputs);
        const parsed = parseEquation(node.latex);
        // a variable is used if the equation reads it, or calculus varies it
        const used = new Set([...parsed.symbols, ...(parsed.bound || [])]);
        const readable = !parsed.empty && !parsed.error;
        const strayLinks = [];

        inputs.forEach((input) => {
            const duplicate = byName.get(input.variable) !== input.id;
            const unused = readable && !used.has(input.variable);
            if (input.owned) {
                Object.assign(resultOf(input.id), { duplicate, unused });
            } else if (duplicate || unused) {
                strayLinks.push(input.id);
            }
            evaluateNode(input.id);
        });

        const finish = (fields) => {
            Object.assign(result, { missing: [], strayLinks }, fields, { evaluated: true });
            inProgress.delete(id);
            return result;
        };

        if (parsed.empty) {
            return finish({ kind: "empty", error: "Type an equation" });
        }
        if (parsed.error) {
            return finish({ kind: "parse", error: parsed.error });
        }

        const missing = parsed.symbols.filter(
            (name) => !byName.has(name) && !CONSTANTS.has(name)
        );
        if (missing.length > 0) {
            return finish({
                kind: "missing",
                missing,
                error: `Needs ${missing.join(", ")}`,
            });
        }

        const scope = {};
        for (const name of parsed.symbols) {
            const inputId = byName.get(name);
            if (!inputId) continue;
            const inputResult = evaluateNode(inputId);
            if (inputResult.error !== undefined) {
                return finish({ kind: "child", error: `Waiting on ${name}` });
            }
            scope[name] = inputResult.value;
        }

        withCalculus(scope, nodes, id, {});
        try {
            const value = parsed.compiled.evaluate(scope);
            if (!isUsableValue(value)) {
                return finish({ kind: "eval", error: "Not a number" });
            }
            return finish({ value, display: formatValue(value) });
        } catch (err) {
            return finish({ kind: "eval", error: err.message });
        }
    };

    state.trees.forEach((tree) => evaluateNode(tree.rootId));
    Object.keys(nodes).forEach((id) => evaluateNode(id));

    // A card may be evaluated (through a link) before its own parent flags
    // it as unused, so the verdicts are worked out once everything is in.
    Object.keys(nodes).forEach((id) => {
        const r = results[id];
        r.ok = r.error === undefined && !r.unused && !r.duplicate && r.strayLinks.length === 0;
    });
    const subtreeOk = (id) => {
        const r = results[id];
        if (r.subtreeOk === undefined) {
            r.subtreeOk = r.ok && nodes[id].children.every(subtreeOk);
        }
        return r.subtreeOk;
    };
    Object.keys(nodes).forEach(subtreeOk);
    return results;
};

// A plain number for plotting, or null when the value has no place on a
// real axis (complex results, infinities, matrices...).
export const toReal = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value && value.isComplex) {
        return Math.abs(value.im) < 1e-9 && Number.isFinite(value.re)
            ? value.re
            : null;
    }
    if (value && (value.isBigNumber || value.isFraction)) {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }
    return null;
};

/**
 * Evaluates the cards `rootId` depends on, with the cards in `overrides`
 * pinned to fixed values instead of their own equations. Used to sweep a
 * variable when plotting. Returns { [nodeId]: value } for every card it
 * could solve.
 */
export const evaluateSubtree = (nodes, rootId, overrides = {}) => {
    const values = {};

    const visit = (id) => {
        if (id in values) return values[id];
        if (id in overrides) return (values[id] = overrides[id]);
        values[id] = undefined;

        const node = nodes[id];
        const parsed = parseEquation(node.latex);
        if (parsed.empty || parsed.error) return undefined;

        const byName = inputsByName(inputsOf(nodes, node));
        const scope = {};
        for (const name of parsed.symbols) {
            const inputId = byName.get(name);
            if (!inputId) {
                if (CONSTANTS.has(name)) continue;
                return undefined;
            }
            const value = visit(inputId);
            if (value === undefined) return undefined;
            scope[name] = value;
        }

        withCalculus(scope, nodes, id, overrides);
        try {
            const value = parsed.compiled.evaluate(scope);
            if (isUsableValue(value)) values[id] = value;
        } catch (err) {}
        return values[id];
    };

    visit(rootId);
    return values;
};
