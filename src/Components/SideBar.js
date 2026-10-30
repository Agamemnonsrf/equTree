import React from "react";
import { Icon } from "./Icons";
import { InlineRename } from "./InlineRename";

// A row with a name that can be renamed (double-click or the pencil) and
// deleted (×), used for both canvases and trees.
const ListItem = ({
    name,
    detail,
    active,
    onSelect,
    onRename,
    onDelete,
    deleteTitle,
    canDelete = true,
    onMouseEnter,
    onMouseLeave,
}) => {
    const [renaming, setRenaming] = React.useState(false);

    return (
        <li
            className={`list-item ${active ? "active" : ""}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={() => !renaming && onSelect()}
        >
            <div className="list-item-text">
                {renaming ? (
                    <InlineRename
                        className="sidebar-rename"
                        initial={name}
                        onCommit={(value) => {
                            onRename(value);
                            setRenaming(false);
                        }}
                        onCancel={() => setRenaming(false)}
                    />
                ) : (
                    <span
                        className="list-item-name"
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            setRenaming(true);
                        }}
                    >
                        {name}
                    </span>
                )}
                {detail}
            </div>
            {!renaming && (
                <div className="list-item-buttons">
                    <button
                        className="list-item-button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setRenaming(true);
                        }}
                        title={`Rename ${name}`}
                        aria-label={`Rename ${name}`}
                    >
                        <Icon name="pencil" />
                    </button>
                    {canDelete && (
                        <button
                            className="list-item-button list-item-delete"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            title={deleteTitle}
                            aria-label={deleteTitle}
                        >
                            <Icon name="close" />
                        </button>
                    )}
                </div>
            )}
        </li>
    );
};

const THEMES = [
    ["light", "Light"],
    ["system", "System"],
    ["dark", "Dark"],
];

const LINE_STYLES = [
    ["normal", "Normal"],
    ["bold", "Bold"],
];

const LINE_SHAPES = [
    ["curved", "Curved"],
    ["angled", "Angled"],
];

// Memoized and fed by props (rather than the shared context) so it doesn't
// re-render on every frame while cards are dragged.
export const SideBar = React.memo(function SideBar({
    canvases,
    activeCanvasId,
    trees,
    results,
    scale,
    showMinimap,
    setShowMinimap,
    setHighlightedTreeId,
    themePreference,
    setThemePreference,
    lineStyle,
    setLineStyle,
    lineShape,
    setLineShape,
    calculus,
    setCalculus,
    actions,
}) {

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <img src={`${process.env.PUBLIC_URL}/equtree.png`} alt="" />
                <h1>EquTree</h1>
            </div>

            <section className="sidebar-section">
                <div className="section-head">
                    <h2>Canvases</h2>
                    <button className="btn btn-small" onClick={actions.addCanvas} title="Start a new, empty canvas">
                        + New
                    </button>
                </div>
                <ul className="item-list">
                    {canvases.map((canvas) => {
                        const count = canvas.trees;
                        return (
                            <ListItem
                                key={canvas.id}
                                name={canvas.name}
                                detail={
                                    <span className="list-item-detail">
                                        {count} {count === 1 ? "tree" : "trees"}
                                    </span>
                                }
                                active={canvas.id === activeCanvasId}
                                onSelect={() => actions.switchCanvas(canvas.id)}
                                onRename={(name) => actions.renameCanvas(canvas.id, name)}
                                canDelete={canvases.length > 1}
                                deleteTitle={`Delete ${canvas.name}`}
                                onDelete={() => actions.confirmRemoveCanvas(canvas.id)}
                            />
                        );
                    })}
                </ul>
            </section>

            <section className="sidebar-section">
                <h2>View</h2>
                <div className="zoom-controls">
                    <button className="btn" onClick={actions.zoomOut} title="Zoom out">
                        −
                    </button>
                    <button className="btn zoom-level" onClick={actions.resetZoom} title="Reset to 100%">
                        {Math.round(scale * 100)}%
                    </button>
                    <button className="btn" onClick={actions.zoomIn} title="Zoom in">
                        +
                    </button>
                </div>
                <div className="button-row">
                    <button className="btn" onClick={actions.fitAll}>
                        Fit all
                    </button>
                    <button className="btn" onClick={actions.tidy} title="Arrange every tree neatly">
                        Tidy layout
                    </button>
                </div>
                <label className="toggle">
                    <input
                        type="checkbox"
                        checked={showMinimap}
                        onChange={(e) => setShowMinimap(e.target.checked)}
                    />
                    Minimap
                </label>
                <div className="segmented" role="radiogroup" aria-label="Theme">
                    {THEMES.map(([value, label]) => (
                        <button
                            key={value}
                            role="radio"
                            aria-checked={themePreference === value}
                            className={themePreference === value ? "on" : ""}
                            onClick={() => setThemePreference(value)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="setting-row">
                    <span>Lines</span>
                    <div className="segmented segmented-small" role="radiogroup" aria-label="Line style">
                        {LINE_STYLES.map(([value, label]) => (
                            <button
                                key={value}
                                role="radio"
                                aria-checked={lineStyle === value}
                                className={lineStyle === value ? "on" : ""}
                                onClick={() => setLineStyle(value)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="setting-row">
                    <span>Shape</span>
                    <div className="segmented segmented-small" role="radiogroup" aria-label="Line shape">
                        {LINE_SHAPES.map(([value, label]) => (
                            <button
                                key={value}
                                role="radio"
                                aria-checked={lineShape === value}
                                className={lineShape === value ? "on" : ""}
                                onClick={() => setLineShape(value)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="sidebar-section">
                <div className="setting-row setting-row-first">
                    <span>Calculus mode</span>
                    <div className="segmented segmented-small" role="radiogroup" aria-label="Calculus mode">
                        {[
                            ["off", "Off"],
                            ["on", "On"],
                        ].map(([value, label]) => (
                            <button
                                key={value}
                                role="radio"
                                aria-checked={(value === "on") === calculus}
                                className={(value === "on") === calculus ? "on" : ""}
                                onClick={() => setCalculus(value)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                {calculus && (
                    <div className="calculus-help">
                        <p className="sidebar-muted">Type these in any equation:</p>
                        <dl>
                            <dt>d/dx</dt>
                            <dd>
                                derivative: <code>d/dx</code> then what to differentiate, or{" "}
                                <code>dΦ/dt</code> for a card. It's taken at the value of the
                                card named x (or t), through the whole tree.
                            </dd>
                            <dt>int</dt>
                            <dd>
                                integral: fill in both limits (they can be <code>infty</code>), then
                                end with <code>dx</code>
                            </dd>
                            <dt>sum, prod</dt>
                            <dd>
                                Σ, ∏: <code>n=1</code> below, the end above (sums can go to{" "}
                                <code>infty</code>)
                            </dd>
                            <dt>lim</dt>
                            <dd>
                                limit: type <code>lim</code>, then <code>_</code> and{" "}
                                <code>x-&gt;0</code> (or <code>x-&gt;infty</code>), press → and write
                                the expression
                            </dd>
                            <dt>d^2/dx^2</dt>
                            <dd>higher derivatives, up to the 4th</dd>
                        </dl>
                    </div>
                )}
            </section>

            <section className="sidebar-section">
                <button className="btn btn-primary btn-block" onClick={actions.addTree}>
                    + Add New Tree
                </button>
            </section>

            <section className="sidebar-section sidebar-trees">
                <h2>Current Trees</h2>
                {trees.length === 0 ? (
                    <p className="sidebar-muted">No trees on this canvas yet.</p>
                ) : (
                    <ul className="item-list">
                        {trees.map((tree) => {
                            const result = results[tree.rootId] || {};
                            return (
                                <ListItem
                                    key={tree.id}
                                    name={tree.name}
                                    detail={
                                        <span
                                            className={`list-item-detail ${
                                                result.display === undefined ? "muted" : ""
                                            }`}
                                        >
                                            = {result.display !== undefined ? result.display : "?"}
                                        </span>
                                    }
                                    onMouseEnter={() => setHighlightedTreeId(tree.id)}
                                    onMouseLeave={() => setHighlightedTreeId(null)}
                                    onSelect={() => actions.focusTree(tree.id)}
                                    onRename={(name) => actions.renameTree(tree.id, name)}
                                    deleteTitle={`Delete ${tree.name}`}
                                    onDelete={() => actions.confirmRemoveTree(tree.id)}
                                />
                            );
                        })}
                    </ul>
                )}
            </section>

            <details className="sidebar-section sidebar-help">
                <summary>How it works</summary>
                <ol>
                    <li>Type an equation into a tree's root card.</li>
                    <li>
                        Every variable needs its own card. Click a <b>+ name</b> chip, or the{" "}
                        <b>+</b> button.
                    </li>
                    <li>
                        Values flow along the arrows, from each variable into the equation that uses
                        it, as you type.
                    </li>
                    <li>
                        Drag a card by its tab. Drag the <b>●</b> on a tab onto another card to use
                        its value there too (one card can feed many equations), or onto a plot
                        to draw it there. The × on a line's label cuts that connection.
                    </li>
                    <li>
                        <b>✓</b> or <b>Enter</b> locks a solved branch, and locked cards can be dragged
                        from anywhere. The pencil unlocks them.
                    </li>
                    <li>
                        <b>Shift+drag</b> a card to move it with everything below it; from a
                        root that moves the whole tree.
                    </li>
                    <li>
                        The chart button graphs an equation against one of its plain-number
                        inputs, with the others as "what if" sliders. Drop any card's{" "}
                        <b>●</b> onto a graph to draw it there too.
                        Drag a plot to pan it, scroll to zoom, double-click to fit.
                    </li>
                    <li>
                        Right-click a card, plot or the canvas for more actions.{" "}
                        <b>Ctrl+Z</b> undoes, <b>Ctrl+Y</b> redoes.
                    </li>
                    <li>Double-click any name to rename it. Drag a card's corner to resize it.</li>
                </ol>
                <p className="sidebar-muted">
                    Supports fractions, roots, powers, |x|, trig, ln/log, π and e. Everything is saved
                    in this browser.
                </p>
            </details>
        </aside>
    );
});
