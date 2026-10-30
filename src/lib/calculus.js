// Numerical calculus behind calculus mode. Every function takes `f`, a plain
// JS function of one number returning a number (or throwing), so the same
// code works whether the variable is local (∫ x² dx) or a card deep in the
// tree (dΦ/dt). Results are rounded to the digits the method can vouch for,
// so rounding noise doesn't show up as 6.00000000004.

// Snaps a result to `digits` significant digits, and to 0 when it's that
// small next to `scale` (the size of the numbers it came from).
const settle = (value, digits, scale = 1) => {
    if (!Number.isFinite(value)) return value;
    if (Math.abs(value) < 10 ** -digits * Math.max(1, Math.abs(scale))) return 0;
    return Number(value.toPrecision(digits));
};

const binomial = (n, k) => {
    let result = 1;
    for (let j = 1; j <= k; j++) result = (result * (n - k + j)) / j;
    return result;
};

// Step sizes and the digits each order of derivative can be trusted to.
const DERIVATIVE_STEP = { 1: 1e-4, 2: 1e-3, 3: 1e-2, 4: 2e-2 };
const DERIVATIVE_DIGITS = { 1: 9, 2: 7, 3: 5, 4: 4 };

/**
 * The `order`-th derivative of f at x0, by central differences at two step
 * sizes combined so their leading error cancels (Richardson extrapolation);
 * that keeps it accurate for functions that change quickly, too.
 */
export const derivative = (f, x0, order = 1) => {
    if (!Number.isInteger(order) || order < 1 || order > 4) {
        throw new Error("Derivatives go up to the 4th order");
    }
    let scale = 0;
    const central = (h) => {
        let total = 0;
        for (let k = 0; k <= order; k++) {
            const y = f(x0 + (order / 2 - k) * h);
            scale = Math.max(scale, Math.abs(y));
            total += (k % 2 ? -1 : 1) * binomial(order, k) * y;
        }
        return total / h ** order;
    };
    const h = DERIVATIVE_STEP[order] * Math.max(1, Math.abs(x0));
    const result = (4 * central(h / 2) - central(h)) / 3;
    return settle(result, DERIVATIVE_DIGITS[order], scale / Math.max(1, Math.abs(x0)) ** order);
};

// 7-point Gauss–Legendre: never evaluates at the ends of an interval, so
// integrands that blow up there (or infinite ranges, mapped onto finite
// ones) still work.
const GAUSS = [
    [0, 0.4179591836734694],
    [0.4058451513773972, 0.3818300505051189],
    [-0.4058451513773972, 0.3818300505051189],
    [0.7415311855993945, 0.2797053914892766],
    [-0.7415311855993945, 0.2797053914892766],
    [0.9491079123427585, 0.1294849661688697],
    [-0.9491079123427585, 0.1294849661688697],
];

const gauss = (f, a, b) => {
    const mid = (a + b) / 2;
    const half = (b - a) / 2;
    return half * GAUSS.reduce((total, [x, w]) => total + w * f(mid + half * x), 0);
};

/**
 * ∫ f from a to b; either limit can be ±Infinity. Adaptive: halves an
 * interval until both halves agree with the whole.
 */
export const integrate = (f, a, b) => {
    if (a === b) return 0;
    if (a > b) return -integrate(f, b, a);
    // map infinite ranges onto finite ones
    let g = f;
    let lo = a;
    let hi = b;
    if (a === -Infinity && b === Infinity) {
        g = (t) => f(t / (1 - t * t)) * ((1 + t * t) / (1 - t * t) ** 2);
        lo = -1;
        hi = 1;
    } else if (b === Infinity) {
        g = (t) => f(a + t / (1 - t)) / (1 - t) ** 2;
        lo = 0;
        hi = 1;
    } else if (a === -Infinity) {
        g = (t) => f(b - (1 - t) / t) / (t * t);
        lo = 0;
        hi = 1;
    }
    let budget = 20000;
    const checked = (t) => {
        if (--budget < 0) throw new Error("The integral is too hard to work out");
        const y = g(t);
        if (!Number.isFinite(y)) throw new Error("The integral doesn't converge");
        return y;
    };
    const step = (x0, x1, whole, depth) => {
        const mid = (x0 + x1) / 2;
        const left = gauss(checked, x0, mid);
        const right = gauss(checked, mid, x1);
        const both = left + right;
        if (depth > 40 || Math.abs(both - whole) <= 1e-12 * Math.max(1, Math.abs(both))) return both;
        return step(x0, mid, left, depth + 1) + step(mid, x1, right, depth + 1);
    };
    const total = step(lo, hi, gauss(checked, lo, hi), 0);
    return settle(total, 11, total);
};

// Most terms a sum adds one by one.
const MAX_TERMS = 20000;

/**
 * f(lo) + f(lo+1) + ... + f(hi); hi can be Infinity. Infinite sums stop once
 * terms stop mattering; slowly converging ones are finished off by
 * extrapolating from the partial sums at 5000, 10000 and 20000 terms.
 */
export const sum = (f, lo, hi) => {
    if (!Number.isInteger(lo) || !(Number.isInteger(hi) || hi === Infinity)) {
        throw new Error("A sum runs over whole numbers");
    }
    if (hi < lo) return 0;
    if (hi !== Infinity && hi - lo > 1e6) throw new Error("That sum has too many terms");
    let total = 0;
    let quiet = 0;
    const checkpoints = [];
    const last = hi === Infinity ? lo + MAX_TERMS - 1 : hi;
    for (let n = lo; n <= last; n++) {
        const term = f(n);
        if (!Number.isFinite(term)) throw new Error(`Term ${n} of the sum isn't a number`);
        total += term;
        if (hi !== Infinity) continue;
        quiet = Math.abs(term) <= 1e-17 * Math.abs(total) || term === 0 ? quiet + 1 : 0;
        if (quiet >= 20) return settle(total, 12, total);
        const count = n - lo + 1;
        if (count === MAX_TERMS / 4 || count === MAX_TERMS / 2) checkpoints.push(total);
    }
    if (hi !== Infinity) return total;
    const [s1, s2] = checkpoints;
    const s3 = total;
    const d1 = s2 - s1;
    const d2 = s3 - s2;
    if (!(Math.abs(d2) < Math.abs(d1) * 0.9)) throw new Error("This sum doesn't converge");
    // the errors at 5000, 10000, 20000 terms shrink geometrically: Aitken's Δ²
    const denominator = d2 - d1;
    const estimate = denominator === 0 ? s3 : s3 - (d2 * d2) / denominator;
    return settle(Number.isFinite(estimate) ? estimate : s3, 8, estimate);
};

/**
 * f(lo) · f(lo+1) · ... · f(hi), over whole numbers.
 */
export const product = (f, lo, hi) => {
    if (!Number.isInteger(lo) || !Number.isInteger(hi)) {
        throw new Error("A product runs over whole numbers, up to a whole number");
    }
    if (hi - lo > 1e6) throw new Error("That product has too many terms");
    let total = 1;
    for (let n = lo; n <= hi; n++) {
        total *= f(n);
        if (!Number.isFinite(total)) break;
    }
    return total;
};

/**
 * lim f(x) as x → to (to can be ±Infinity). Approaches from both sides,
 * sharpening each estimate with Richardson extrapolation; the two sides must
 * agree. Grows without bound → ±Infinity.
 */
export const limit = (f, to) => {
    const safe = (x) => {
        const y = f(x);
        return Number.isFinite(y) ? y : y === Infinity || y === -Infinity ? y : null;
    };
    if (to === Infinity || to === -Infinity) {
        const sign = to === Infinity ? 1 : -1;
        const near = safe(sign * 1e5);
        const nearer = safe(sign * 1e6);
        const far = safe(sign * 1e12);
        if (near === null || nearer === null) throw new Error("The function isn't defined out there");
        if (Math.abs(far) > 1e6 * Math.max(1, Math.abs(nearer))) return Math.sign(far) * Infinity;
        // f(x) ≈ L + c/x
        const estimate = (10 * nearer - near) / 9;
        if (Math.abs(nearer - near) > 1e-3 * Math.max(1, Math.abs(nearer)) && Math.abs(far - nearer) > Math.abs(nearer - near)) {
            throw new Error("This limit doesn't settle");
        }
        return settle(estimate, 9, estimate);
    }
    const scale = Math.max(1, Math.abs(to));
    const h = 1e-3 * scale;
    // each side: f(to ± h) ≈ L + c·h, so 2f(h/2) - f(h) cancels the c·h
    const side = (sign) => {
        const a = safe(to + sign * h);
        const b = safe(to + (sign * h) / 2);
        return a === null || b === null ? null : 2 * b - a;
    };
    const tiny = (sign) => safe(to + sign * 1e-9 * scale);
    const left = side(-1);
    const right = side(1);
    const leftTiny = tiny(-1);
    const rightTiny = tiny(1);
    // growing without bound on both sides, the same way
    const big = (y, at) => y !== null && Math.abs(y) > 1e6 * Math.max(1, Math.abs(at || 0));
    if (big(leftTiny, left) && big(rightTiny, right)) {
        if (Math.sign(leftTiny) === Math.sign(rightTiny)) return Math.sign(rightTiny) * Infinity;
        throw new Error("The limit doesn't exist: the two sides go opposite ways");
    }
    if (left === null || right === null) throw new Error("The function isn't defined near that point");
    if (Math.abs(left - right) > 1e-5 * Math.max(1, Math.abs(left), Math.abs(right))) {
        throw new Error("The limit doesn't exist: the two sides disagree");
    }
    // both sides together: the odd error terms cancel, Richardson removes h²
    const symmetric = (d) => (safe(to + d) + safe(to - d)) / 2;
    const estimate = (4 * symmetric(h / 2) - symmetric(h)) / 3;
    return settle(estimate, 9, estimate);
};
