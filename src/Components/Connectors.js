import React from "react";
import { boxOf, connectBoxes, curveBetween, elbowBetween, layoutConnections } from "../lib/layout";
import { inputsOf, nodeLabel } from "../lib/tree";

const LABEL_MAX = 16;

// geometry for normal and bold lines (the "Lines" setting)
const STYLES = {
    normal: { arrow: 12, arrowHalfWidth: 7, socket: 5, charWidth: 7.4, pill: 11 },
    bold: { arrow: 18, arrowHalfWidth: 11, socket: 7, charWidth: 8.6, pill: 13 },
};

const stopPropagation = (e) => e.stopPropagation();

// Arrowhead whose tip touches `tip`, pointing against `outward` (the
// direction leaving the card).
const arrowPoints = (tip, outward, style) => {
    const base = { x: tip.x + outward[0] * style.arrow, y: tip.y + outward[1] * style.arrow };
    const perp = [-outward[1], outward[0]];
    const half = style.arrowHalfWidth;
    return [
        `${tip.x},${tip.y}`,
        `${base.x + perp[0] * half},${base.y + perp[1] * half}`,
        `${base.x - perp[0] * half},${base.y - perp[1] * half}`,
    ].join(" ");
};

// The drawn shape of a planned connection, ending in an arrow at its end:
// right-angled when `angled` (and the cards face each other), else a curve.
const shape = ({ start, startDir, end, endDir, lane }, style, angled) => {
    // stop the line at the arrow's base so its cap doesn't poke through the tip
    const back = style.arrow - 2;
    const lineEnd = { x: end.x + endDir[0] * back, y: end.y + endDir[1] * back };
    const { d, mid } =
        (angled && elbowBetween(start, startDir, lineEnd, endDir, lane)) ||
        curveBetween(start, startDir, lineEnd, endDir);
    return { d, mid, start, arrow: arrowPoints(end, endDir, style) };
};

const labelText = (variable, display) => {
    const full = display !== undefined ? `${variable} = ${display}` : variable;
    return full.length > LABEL_MAX ? `${full.slice(0, LABEL_MAX - 1)}…` : full;
};

// Lines run from each card into every equation that uses its value, and from
// equations (and cards dragged onto plots) into their plots. The arrow and
// the moving dots show which way values flow, and the label names the
// variable they feed. Hovering a label shows a × that cuts that connection.
// Lines meeting the same side of a card are spread out next to each other.
export const Connectors = React.memo(({ doc, sizes, results, highlightedIds, linkDrag, lineStyle, lineShape, actions }) => {
    const angled = lineShape !== "curved";
    const box = (id) => boxOf(doc, sizes, id);
    const style = STYLES[lineStyle] || STYLES.normal;
    const lit = (id) => Boolean(highlightedIds && highlightedIds.has(id));

    // every connection: { key, from, to, ...how to draw it }
    const lines = [];
    Object.values(doc.nodes).forEach((consumer) => {
        const consumerResult = results[consumer.id] || {};
        const consumerLabel = nodeLabel(doc, consumer.id);
        inputsOf(doc.nodes, consumer).forEach((input) => {
            const sourceResult = results[input.id] || {};
            const stray = input.owned
                ? sourceResult.unused || sourceResult.duplicate
                : (consumerResult.strayLinks || []).includes(input.id);
            lines.push({
                key: `${consumer.id}>${input.id}`,
                from: input.id,
                to: consumer.id,
                kind: input.owned ? "child" : "shared",
                label: labelText(input.variable, sourceResult.display),
                stray,
                highlighted: lit(consumer.id) && lit(input.id),
                cut: () => actions.cutConnection(consumer.id, input.id),
                cutTitle: input.owned
                    ? `Disconnect ${input.variable} from ${consumerLabel} (it becomes a tree of its own)`
                    : `Stop using this value as ${input.variable} in ${consumerLabel}`,
            });
        });
    });
    Object.values(doc.plots || {}).forEach((plot) => {
        if (!doc.nodes[plot.targetId]) return;
        lines.push({
            key: `${plot.id}<${plot.targetId}`,
            from: plot.targetId,
            to: plot.id,
            kind: "plot",
            highlighted: lit(plot.targetId),
        });
        (plot.extra || [])
            .filter((id) => doc.nodes[id])
            .forEach((id) => {
                const name = nodeLabel(doc, id);
                lines.push({
                    key: `${plot.id}<${id}`,
                    from: id,
                    to: plot.id,
                    kind: "plot",
                    label: labelText(name),
                    highlighted: lit(id),
                    cut: () => actions.removePlotLine(plot.id, id),
                    cutTitle: `Stop drawing ${name} on this plot`,
                });
            });
    });

    const planned = layoutConnections(lines, box);
    lines.forEach((line) => Object.assign(line, shape(planned[line.key], style, angled)));

    let preview = null;
    if (linkDrag && doc.nodes[linkDrag.fromId]) {
        const pointer = { x: linkDrag.point.x, y: linkDrag.point.y, w: 0, h: 0 };
        const onTarget = Boolean(linkDrag.targetId && (doc.nodes[linkDrag.targetId] || doc.plots[linkDrag.targetId]));
        const target = onTarget ? box(linkDrag.targetId) : pointer;
        preview = { ...shape(connectBoxes(box(linkDrag.fromId), target), style), valid: linkDrag.valid, onTarget };
    }

    const classOf = (l, base) =>
        [
            base,
            l.stray && `${base}-stray`,
            l.kind === "shared" && `${base}-shared`,
            l.highlighted && `${base}-highlighted`,
        ]
            .filter(Boolean)
            .join(" ");

    return (
        <svg className="connectors" aria-hidden="true">
            {lines.map((l) =>
                l.kind === "plot" ? (
                    <g key={l.key} className={`connector connector-plot ${l.highlighted ? "connector-highlighted" : ""}`}>
                        <path className="connector-path" d={l.d} pathLength="1" />
                        <polygon className="connector-arrow" points={l.arrow} />
                    </g>
                ) : (
                    <g key={l.key} className={classOf(l, "connector")}>
                        <path className="connector-halo" d={l.d} />
                        <path className="connector-path" d={l.d} pathLength="1" />
                        {!l.stray && <path className="connector-flow" d={l.d} />}
                        <circle className="connector-socket" cx={l.start.x} cy={l.start.y} r={style.socket} />
                        <polygon className="connector-arrow" points={l.arrow} />
                    </g>
                )
            )}
            {lines
                .filter((l) => l.label)
                .map((l) => {
                    const width = 14 + l.label.length * style.charWidth;
                    return (
                        <g
                            key={`label-${l.key}`}
                            className={classOf(l, "connector-label")}
                            transform={`translate(${l.mid.x}, ${l.mid.y})`}
                            onMouseDown={stopPropagation}
                        >
                            {/* invisible hover area covering the label and its × */}
                            <rect className="connector-label-hit" x={-width / 2 - 4} y={-16} width={width + 34} height={32} />
                            <rect
                                className="connector-label-pill"
                                x={-width / 2}
                                y={-style.pill}
                                width={width}
                                height={style.pill * 2}
                                rx={style.pill}
                            />
                            <text textAnchor="middle" y={4.5}>
                                {l.label}
                            </text>
                            <g
                                className="connector-cut"
                                transform={`translate(${width / 2 + style.pill + 2}, 0)`}
                                onClick={l.cut}
                            >
                                <title>{l.cutTitle}</title>
                                <circle r="9" />
                                <path d="M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5" />
                            </g>
                        </g>
                    );
                })}
            {preview && (
                <g className={`connector-preview ${preview.onTarget ? (preview.valid ? "valid" : "invalid") : ""}`}>
                    <path d={preview.d} />
                    {preview.onTarget ? (
                        <polygon points={preview.arrow} />
                    ) : (
                        <circle cx={linkDrag.point.x} cy={linkDrag.point.y} r="7" />
                    )}
                </g>
            )}
        </svg>
    );
});
