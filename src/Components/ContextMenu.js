import React from "react";

const MARGIN = 8;

// Drops separators at the ends and doubled-up ones left by hidden items.
const tidySeparators = (items) =>
    items.filter(
        (item, i) =>
            item !== "-" ||
            (i > 0 && i < items.length - 1 && items[i - 1] !== "-")
    );

/**
 * The right-click menu. `menu` is { x, y, items } where items are
 * { label, hint?, danger?, disabled?, onSelect } or "-" for a separator.
 * It only exists while open, and closes on any outside press, Escape,
 * scroll, resize or when the window loses focus.
 */
export const ContextMenu = ({ menu, onClose }) => {
    const ref = React.useRef(null);
    const [position, setPosition] = React.useState({ left: menu.x, top: menu.y });
    const items = tidySeparators(menu.items);

    // keep the menu on screen
    React.useLayoutEffect(() => {
        const el = ref.current;
        const { width, height } = el.getBoundingClientRect();
        setPosition({
            left: Math.max(MARGIN, Math.min(menu.x, window.innerWidth - width - MARGIN)),
            top: Math.max(MARGIN, Math.min(menu.y, window.innerHeight - height - MARGIN)),
        });
        const first = el.querySelector("button:not(:disabled)");
        if (first) first.focus({ preventScroll: true });
    }, [menu]);

    React.useEffect(() => {
        const outside = (e) => {
            if (!ref.current.contains(e.target)) onClose();
        };
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener("pointerdown", outside, true);
        window.addEventListener("wheel", onClose, { passive: true, capture: true });
        window.addEventListener("keydown", onKey, true);
        window.addEventListener("resize", onClose);
        window.addEventListener("blur", onClose);
        return () => {
            window.removeEventListener("pointerdown", outside, true);
            window.removeEventListener("wheel", onClose, { capture: true });
            window.removeEventListener("keydown", onKey, true);
            window.removeEventListener("resize", onClose);
            window.removeEventListener("blur", onClose);
        };
    }, [onClose]);

    // arrow keys move between items
    const onKeyDown = (e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        const buttons = [...ref.current.querySelectorAll("button:not(:disabled)")];
        const index = buttons.indexOf(document.activeElement);
        const step = e.key === "ArrowDown" ? 1 : -1;
        const next = buttons[(index + step + buttons.length) % buttons.length];
        if (next) next.focus({ preventScroll: true });
    };

    return (
        <div
            className="context-menu"
            ref={ref}
            role="menu"
            style={position}
            onKeyDown={onKeyDown}
            onContextMenu={(e) => e.preventDefault()}
        >
            {items.map((item, i) =>
                item === "-" ? (
                    <div key={`sep-${i}`} className="context-menu-separator" role="separator" />
                ) : (
                    <button
                        key={item.label}
                        role="menuitem"
                        className={`context-menu-item ${item.danger ? "danger" : ""}`}
                        disabled={item.disabled}
                        onClick={() => {
                            onClose();
                            item.onSelect();
                        }}
                    >
                        <span>{item.label}</span>
                        {item.hint && <span className="context-menu-hint">{item.hint}</span>}
                    </button>
                )
            )}
        </div>
    );
};
