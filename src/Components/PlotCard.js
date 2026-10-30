import React from "react";
import { usePointerDrag } from "../hooks/usePointerDrag";
import { DEFAULT_PLOT_SIZE, MIN_PLOT_SIZE } from "../lib/layout";
import { buildPlot, formatNumber, formatTick, niceTicks, valuesAt, zoomView } from "../lib/plot";
import { Dropdown } from "./Dropdown";
import { Icon } from "./Icons";
import { ResizeHandle } from "./ResizeHandle";

// room around the chart for tick labels and the axis titles
const PAD = { left: 66, right: 16, top: 12, bottom: 42 };
const WHEEL_ZOOM = 0.0015;
const ZOOM_STEP = 1.4;
const stopPropagation = (e) => e.stopPropagation();
const colorVar = (index) => `var(--series-${(index % 5) + 1})`;

// A number field that only saves on Enter or blur, so typing "-" or "1e"
// along the way doesn't fight the plot. Empty commits null.
const NumberField = ({ value, onCommit, label }) => {
    const shown = value === null || value === undefined ? "" : String(value);
    const [text, setText] = React.useState(shown);
    React.useEffect(() => setText(shown), [shown]);
    const commit = () => {
        const trimmed = text.trim();
        const number = trimmed === "" ? null : Number(trimmed);
        if (number !== null && !Number.isFinite(number)) setText(shown);
        else if (number !== (value ?? null)) onCommit(number);
    };
    return (
        <input
            className="plot-number"
            aria-label={label}
            value={text}
            inputMode="decimal"
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
    );
};

// One of the other inputs, held at a fixed value while x varies. It starts at
// the card's own value; moving it changes the plot only, and the reset button
// goes back to the card's value.
const Slider = ({ slider, onChange }) => {
    const [lo, hi] = slider.range;
    const shown = slider.value === null ? 0 : Number(slider.value.toPrecision(4));
    return (
        <div className={`slider-row ${slider.changed ? "changed" : ""}`}>
            <span className="slider-label" title={slider.label}>
                {slider.label}
                {slider.changed && (
                    <span className="slider-base">card: {formatNumber(slider.base)}</span>
                )}
            </span>
            <input
                type="range"
                min={lo}
                max={hi}
                step={(hi - lo) / 200}
                value={slider.value ?? 0}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-label={`${slider.label}, held at`}
            />
            <NumberField
                label={`${slider.label} value`}
                value={shown}
                onCommit={(value) => onChange(value === null ? undefined : value)}
            />
            <button
                className="icon-btn icon-btn-small slider-reset"
                onClick={() => onChange(undefined)}
                disabled={!slider.changed}
                title={`Back to the card's value (${formatNumber(slider.base)})`}
                aria-label={`Reset ${slider.label}`}
            >
                ↺
            </button>
        </div>
    );
};

// Splits a line into path segments, breaking at gaps and at jumps far
// bigger than the visible range (vertical asymptotes).
const linePath = (xs, ys, toX, toY, span) => {
    let d = "";
    let drawing = false;
    for (let i = 0; i < xs.length; i++) {
        const y = ys[i];
        const jump = i > 0 && ys[i - 1] !== null && y !== null && Math.abs(y - ys[i - 1]) > span * 3;
        if (y === null || jump) {
            drawing = false;
            if (y === null) continue;
        }
        d += `${drawing ? "L" : "M"}${toX(xs[i]).toFixed(1)} ${toY(y).toFixed(1)} `;
        drawing = true;
    }
    return d;
};

/**
 * A plot card: a graph of an equation against one of its inputs, with the
 * other inputs as sliders (see lib/plot.js). Cards dropped onto it are drawn
 * too. Drag the chart to pan, scroll to zoom around the pointer (Shift: only
 * x, Alt: only y), double-click to fit.
 */
const PlotCardView = ({ plot, targetLabel, signature, highlighted, linkState, actions }) => {
    const anchorRef = React.useRef(null);
    const cardRef = React.useRef(null);
    const chartRef = React.useRef(null);
    const tabRef = React.useRef(null);
    const [chart, setChart] = React.useState({ w: 400, h: 200 });
    const [hover, setHover] = React.useState(null); // { x, px, py } in chart pixels
    const [dragging, setDragging] = React.useState(false);
    // the view while panning or zooming, before it's saved to the plot
    const [liveView, setLiveView] = React.useState(null);

    React.useLayoutEffect(() => {
        const card = cardRef.current;
        const box = chartRef.current;
        const observer = new ResizeObserver(() => {
            actions.reportSize(plot.id, card.offsetWidth, card.offsetHeight, tabRef.current.offsetWidth);
            setChart({ w: box.clientWidth, h: box.clientHeight });
        });
        observer.observe(card);
        observer.observe(box);
        observer.observe(tabRef.current);
        return () => observer.disconnect();
    }, [plot.id, actions]);

    React.useEffect(() => {
        const el = anchorRef.current;
        el.addEventListener("touchstart", stopPropagation);
        return () => el.removeEventListener("touchstart", stopPropagation);
    }, []);

    // When an equation the plot shows changes, a view picked for the old
    // curve rarely suits the new one, so the plot fits itself again.
    const previousSignature = React.useRef(signature);
    React.useEffect(() => {
        if (previousSignature.current !== signature) {
            previousSignature.current = signature;
            if (plot.view) actions.setPlotView(plot.id, null);
        }
    }, [signature, plot.view, plot.id, actions]);

    const startDrag = usePointerDrag({
        onStart: (e) => {
            if (e.target.closest("button, input, select, .no-drag")) return false;
            setDragging(true);
            actions.setMoving("drag", true);
            actions.beginGesture();
            return { x: plot.x, y: plot.y, scale: actions.getScale() };
        },
        onMove: (dx, dy, e, start) =>
            actions.moveItem(plot.id, start.x + dx / start.scale, start.y + dy / start.scale),
        onEnd: () => {
            setDragging(false);
            actions.setMoving("drag", false);
            actions.endGesture();
        },
    });

    const view = liveView || plot.view;
    const visibleX = view ? [view.x0, view.x1] : null;
    // about one sample per pixel, so fast waves don't break up into noise
    const samples = Math.min(600, Math.max(200, Math.round(chart.w - PAD.left - PAD.right)));

    // `signature` changes whenever an equation the plot depends on does, so
    // nothing is resampled while cards are merely moved.
    const settingsKey = JSON.stringify([plot.xId, plot.series, plot.extra, plot.overrides]);
    const model = React.useMemo(
        () => buildPlot(actions.getDoc(), plot, targetLabel, visibleX, samples),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [signature, plot.targetId, settingsKey, targetLabel, visibleX && visibleX[0], visibleX && visibleX[1], samples, actions]
    );
    const domain = view || model.autoView;

    const width = Math.max(10, chart.w);
    const height = Math.max(10, chart.h);
    const innerW = Math.max(1, width - PAD.left - PAD.right);
    const innerH = Math.max(1, height - PAD.top - PAD.bottom);

    // read by the wheel listener, which is attached once
    const latest = React.useRef();
    latest.current = { domain, width, height, innerW, innerH, liveView };

    const commitView = React.useCallback(
        (next) => {
            actions.setPlotView(plot.id, next);
            setLiveView(null);
        },
        [actions, plot.id]
    );

    // Wheel zooms the plot rather than the canvas, so it's caught before the
    // canvas sees it (a native listener, since it has to preventDefault).
    React.useEffect(() => {
        const el = chartRef.current;
        let commitTimer = null;
        let pending = null;
        const onWheel = (e) => {
            const { domain, width, height, innerW, innerH } = latest.current;
            if (!domain) return;
            e.preventDefault();
            e.stopPropagation();
            const rect = el.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * width;
            const py = ((e.clientY - rect.top) / rect.height) * height;
            const base = pending || domain;
            const cx = base.x0 + ((px - PAD.left) / innerW) * (base.x1 - base.x0);
            const cy = base.y1 - ((py - PAD.top) / innerH) * (base.y1 - base.y0);
            const axes = e.shiftKey ? "x" : e.altKey ? "y" : "xy";
            pending = zoomView(base, Math.exp(e.deltaY * WHEEL_ZOOM), cx, cy, axes);
            setLiveView(pending);
            clearTimeout(commitTimer);
            commitTimer = setTimeout(() => {
                commitView(pending);
                pending = null;
            }, 300);
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => {
            el.removeEventListener("wheel", onWheel);
            clearTimeout(commitTimer);
        };
    }, [commitView]);

    // dragging the chart pans it
    const startPan = usePointerDrag({
        onStart: () => {
            if (!domain) return false;
            setHover(null);
            return { domain, scale: actions.getScale() };
        },
        onMove: (dx, dy, e, start) => {
            const { domain: d, scale } = start;
            const shiftX = (-(dx / scale) / innerW) * (d.x1 - d.x0);
            const shiftY = ((dy / scale) / innerH) * (d.y1 - d.y0);
            setLiveView({ x0: d.x0 + shiftX, x1: d.x1 + shiftX, y0: d.y0 + shiftY, y1: d.y1 + shiftY });
        },
        onEnd: () => {
            if (latest.current.liveView) commitView(latest.current.liveView);
        },
    });

    const zoomBy = (factor) => {
        if (!domain) return;
        commitView(zoomView(domain, factor, (domain.x0 + domain.x1) / 2, (domain.y0 + domain.y1) / 2));
    };

    // ---- settings ----
    const update = (changes) => actions.updatePlot(plot.id, changes);
    const setX = (xId) => update({ xId, view: null });
    const selected = new Set(plot.series && plot.series.length ? plot.series : [plot.targetId]);
    const toggleLine = (id) => {
        const next = selected.has(id) ? [...selected].filter((s) => s !== id) : [...selected, id];
        if (next.length > 0) update({ series: next });
    };
    // shown lines that can't be drawn against this x-axis
    const unseen = (model.options || []).filter((o) => selected.has(o.id) && !o.uses);
    // Moving a slider keeps the axes where they are, so you see the curve move
    // (re-fitting would rescale it back to the same shape); Fit re-fits.
    const setSlider = (id, value) => {
        if (!plot.view && domain) actions.setPlotView(plot.id, domain);
        const overrides = { ...(plot.overrides || {}) };
        if (value === undefined) delete overrides[id];
        else overrides[id] = value;
        actions.setPlotOverrides(plot.id, overrides);
    };
    const changedSliders = (model.sliders || []).filter((s) => s.changed).length;

    // what the axes show, in words
    const lines = model.lines || [];
    const xTitle = model.xLabel;
    const yTitle = lines.length === 1 ? lines[0].label : "value";
    const sliderNames = (model.sliders || []).map((s) => s.label);
    const heldNames =
        sliderNames.length === 0
            ? ""
            : sliderNames.length <= 3
            ? sliderNames.join(sliderNames.length === 2 ? " and " : ", ")
            : "the other inputs";

    // ---- drawing ----
    let svgContent = null;
    let tooltip = null;
    const drawable = domain && !model.message;
    if (drawable) {
        const { x0, x1, y0, y1 } = domain;
        const span = y1 - y0;
        const toX = (x) => PAD.left + ((x - x0) / (x1 - x0)) * innerW;
        const toY = (y) => PAD.top + (1 - (y - y0) / span) * innerH;
        const xTicks = niceTicks(x0, x1, Math.max(2, Math.floor(innerW / 80)));
        const yTicks = niceTicks(y0, y1, Math.max(3, Math.floor(innerH / 32)));
        const clipId = `clip-${plot.id}`;
        const hovered = hover ? valuesAt(actions.getDoc(), plot, model, hover.x) : null;

        svgContent = (
            <>
                <defs>
                    <clipPath id={clipId}>
                        <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} />
                    </clipPath>
                </defs>
                {xTicks.map((t) => (
                    <g key={`x${t}`}>
                        <line className={t === 0 ? "plot-axis" : "plot-grid"} x1={toX(t)} x2={toX(t)} y1={PAD.top} y2={PAD.top + innerH} />
                        <text className="plot-tick" x={toX(t)} y={PAD.top + innerH + 16} textAnchor="middle">
                            {formatTick(t)}
                        </text>
                    </g>
                ))}
                {yTicks.map((t) => (
                    <g key={`y${t}`}>
                        <line className={t === 0 ? "plot-axis" : "plot-grid"} x1={PAD.left} x2={PAD.left + innerW} y1={toY(t)} y2={toY(t)} />
                        <text className="plot-tick" x={PAD.left - 6} y={toY(t) + 4} textAnchor="end">
                            {formatTick(t)}
                        </text>
                    </g>
                ))}
                <rect className="plot-frame" x={PAD.left} y={PAD.top} width={innerW} height={innerH} />
                <text className="plot-axis-title" x={PAD.left + innerW / 2} y={height - 4} textAnchor="middle">
                    {xTitle} →
                </text>
                <text
                    className="plot-axis-title"
                    transform={`translate(12, ${PAD.top + innerH / 2}) rotate(-90)`}
                    textAnchor="middle"
                >
                    {yTitle} →
                </text>
                <g clipPath={`url(#${clipId})`}>
                    {model.lines.map((line) => (
                        <path
                            key={line.id}
                            className="plot-line"
                            style={{ stroke: colorVar(line.color) }}
                            d={linePath(line.xs, line.ys, toX, toY, span)}
                        />
                    ))}
                    {/* today's values (with any sliders applied) */}
                    {!hovered &&
                        model.current.x !== null &&
                        model.lines.map((line, k) =>
                            model.current.ys[k] === null ? null : (
                                <circle
                                    key={`${line.id}-now`}
                                    className="plot-dot"
                                    style={{ fill: colorVar(line.color) }}
                                    cx={toX(model.current.x)}
                                    cy={toY(model.current.ys[k])}
                                    r="4.5"
                                />
                            )
                        )}
                    {hovered && (
                        <>
                            <line className="plot-hover-line" x1={toX(hover.x)} x2={toX(hover.x)} y1={PAD.top} y2={PAD.top + innerH} />
                            {hovered.map((line) =>
                                line.y === null ? null : (
                                    <circle
                                        key={`${line.id}-hover`}
                                        className="plot-dot"
                                        style={{ fill: colorVar(line.color) }}
                                        cx={toX(hover.x)}
                                        cy={toY(line.y)}
                                        r="4.5"
                                    />
                                )
                            )}
                        </>
                    )}
                </g>
            </>
        );

        if (hovered) {
            const flip = hover.px > width - 190;
            tooltip = (
                <div
                    className="plot-tooltip"
                    style={{
                        left: flip ? undefined : hover.px + 14,
                        right: flip ? width - hover.px + 14 : undefined,
                        top: Math.max(4, Math.min(hover.py - 10, height - 120)),
                    }}
                >
                    <div className="plot-tooltip-x">{`${model.xLabel} = ${formatNumber(hover.x)}`}</div>
                    {hovered.map((line) => (
                        <div key={line.id} className="plot-tooltip-row">
                            <span className="plot-tooltip-swatch" style={{ borderTopColor: colorVar(line.color) }} />
                            <span>{line.label}</span>
                            <b>{formatNumber(line.y)}</b>
                        </div>
                    ))}
                </div>
            );
        }
    }

    const onChartHover = (e) => {
        if (!drawable || liveView) return;
        const rect = chartRef.current.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * width;
        const py = ((e.clientY - rect.top) / rect.height) * height;
        const t = (px - PAD.left) / innerW;
        const inside = t >= 0 && t <= 1 && py >= PAD.top && py <= PAD.top + innerH;
        setHover(inside ? { x: domain.x0 + t * (domain.x1 - domain.x0), px, py } : null);
    };

    const first = model.lines && model.lines[0];
    const readout = first ? (
        <span
            className="plot-readout"
            title={`The dot: ${model.xLabel} at its card's value${changedSliders > 0 ? ", with the held values" : ""}`}
        >
            <span className="muted">● </span>
            {`${model.xLabel} = ${formatNumber(model.current.x)} → ${first.label} = ${formatNumber(model.current.ys[0])}`}
            {changedSliders > 0 && <span className="muted"> (held values)</span>}
        </span>
    ) : (
        <span />
    );

    return (
        <div
            className={`card-anchor ${dragging ? "raised" : ""}`}
            ref={anchorRef}
            style={{ transform: `translate(${plot.x}px, ${plot.y}px)` }}
            onMouseDown={stopPropagation}
        >
            <div
                className={[
                    "plot-card",
                    highlighted && "equ-card-highlighted",
                    dragging && "equ-card-dragging",
                    linkState && `equ-card-link-${linkState}`,
                ]
                    .filter(Boolean)
                    .join(" ")}
                ref={cardRef}
                data-plot-id={plot.id}
                style={{
                    width: plot.w || DEFAULT_PLOT_SIZE.w,
                    minHeight: plot.h || DEFAULT_PLOT_SIZE.h,
                }}
            >
                <div
                    className="equCard-varBox drag-handle"
                    ref={tabRef}
                    onPointerDown={startDrag}
                    title="Drag to move · drop a card's ● here to draw it too"
                >
                    <Icon name="grip" className="tab-icon" />
                    <Icon name="chart" className="tab-icon tab-icon-chart" />
                    <span className="tab-label">Plot of {targetLabel}</span>
                </div>

                <div className="plot-controls no-drag">
                    {model.candidates && model.candidates.length > 0 && (
                        <div className="plot-x">
                            <span className="muted">x-axis</span>
                            <Dropdown
                                value={model.xId}
                                options={model.candidates}
                                onChange={setX}
                                label="x-axis"
                                title="Any plain-number input of the equation or of a card dropped here"
                            />
                        </div>
                    )}
                    {xTitle && lines.length > 0 && (
                        <span className="plot-caption">
                            <b>{yTitle}</b> as <b>{xTitle}</b> changes
                            {heldNames && `, with ${heldNames} held at the values below`}
                        </span>
                    )}
                </div>

                <div
                    className={`plot-chart no-drag ${liveView ? "panning" : ""}`}
                    ref={chartRef}
                    onDoubleClick={() => commitView(null)}
                >
                    {drawable ? (
                        <svg
                            width={width}
                            height={height}
                            onPointerDown={startPan}
                            onPointerMove={onChartHover}
                            onPointerLeave={() => setHover(null)}
                        >
                            {svgContent}
                        </svg>
                    ) : (
                        <div className="plot-message">{model.message}</div>
                    )}
                    {tooltip}
                </div>

                {model.options && model.options.length > 1 && (
                    <div className="plot-legend no-drag">
                        <span className="muted">Lines</span>
                        {model.options.map((option) => {
                            const on = selected.has(option.id);
                            return (
                                <span
                                    key={option.id}
                                    className={`legend-chip ${on ? "on" : ""} ${option.uses ? "" : "unused-line"}`}
                                >
                                    <button
                                        className="legend-toggle"
                                        onClick={() => toggleLine(option.id)}
                                        aria-pressed={on}
                                        title={
                                            !option.uses
                                                ? `Doesn't use ${model.xLabel}, so it has no line against it`
                                                : option.kind === "extra"
                                                ? "Dropped onto this plot"
                                                : option.kind === "target"
                                                ? "The plotted equation"
                                                : `Uses ${model.xLabel} on its way to ${targetLabel}`
                                        }
                                    >
                                        <span className="legend-swatch" style={{ borderColor: colorVar(option.color) }} />
                                        {option.label}
                                    </button>
                                    {option.kind === "extra" && (
                                        <button
                                            className="legend-remove"
                                            onClick={() => actions.removePlotLine(plot.id, option.id)}
                                            title={`Stop drawing ${option.label} here`}
                                            aria-label={`Stop drawing ${option.label} here`}
                                        >
                                            ×
                                        </button>
                                    )}
                                </span>
                            );
                        })}
                    </div>
                )}
                {/* lines picked to show that this x-axis can't draw, with a way to see them */}
                {unseen.map((option) => (
                    <div key={option.id} className="plot-note no-drag">
                        {option.label} doesn't use {model.xLabel}.
                        {option.inputs.length > 0 && (
                            <>
                                {" "}
                                Plot against{" "}
                                {option.inputs.slice(0, 3).map((input, i) => (
                                    <React.Fragment key={input.id}>
                                        {i > 0 && ", "}
                                        <button className="link-btn" onClick={() => setX(input.id)}>
                                            {input.label}
                                        </button>
                                    </React.Fragment>
                                ))}{" "}
                                to see it.
                            </>
                        )}
                    </div>
                ))}

                {model.sliders && model.sliders.length > 0 && (
                    <div className="plot-sliders no-drag">
                        <div className="plot-sliders-head">
                            <span className="muted">Held at (drag to try other values)</span>
                            {changedSliders > 0 && (
                                <button className="link-btn" onClick={() => actions.setPlotOverrides(plot.id, {})}>
                                    reset all
                                </button>
                            )}
                        </div>
                        {model.sliders.map((slider) => (
                            <Slider key={slider.id} slider={slider} onChange={(value) => setSlider(slider.id, value)} />
                        ))}
                    </div>
                )}

                <div className="plot-footer">
                    {readout}
                    <div className="plot-buttons">
                        <button className="icon-btn icon-btn-small" onClick={() => zoomBy(1 / ZOOM_STEP)} title="Zoom in">
                            +
                        </button>
                        <button className="icon-btn icon-btn-small" onClick={() => zoomBy(ZOOM_STEP)} title="Zoom out">
                            −
                        </button>
                        <button
                            className="icon-btn icon-btn-small plot-fit"
                            onClick={() => commitView(null)}
                            disabled={!plot.view && !liveView}
                            title="Fit to the lines"
                        >
                            Fit
                        </button>
                        <button
                            className="icon-btn icon-btn-danger"
                            onClick={() => actions.confirmRemovePlot(plot.id)}
                            title="Remove plot"
                        >
                            <Icon name="trash" />
                        </button>
                    </div>
                </div>

                <ResizeHandle
                    targetRef={cardRef}
                    min={MIN_PLOT_SIZE}
                    getScale={actions.getScale}
                    onResize={(w, h) => actions.resizeItem(plot.id, w, h)}
                    onReset={() => actions.resizeItem(plot.id, null, null)}
                    onStart={actions.beginGesture}
                    onEnd={actions.endGesture}
                />
            </div>
        </div>
    );
};

export const PlotCard = React.memo(PlotCardView);
