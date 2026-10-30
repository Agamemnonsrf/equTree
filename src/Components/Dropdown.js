import React from "react";

const stopPropagation = (e) => e.stopPropagation();

// A themed replacement for <select>: the browser's own list ignores the
// app's colours (most visibly in dark mode). `options` are [{ id, label }].
// Arrow keys move, Enter or Space picks, Escape or a click outside closes.
export const Dropdown = ({ value, options, onChange, label, title }) => {
    const [open, setOpen] = React.useState(false);
    const [active, setActive] = React.useState(0);
    const ref = React.useRef(null);
    const menuRef = React.useRef(null);
    const selectedIndex = Math.max(0, options.findIndex((o) => o.id === value));
    const current = options[selectedIndex];

    React.useEffect(() => {
        if (!open) return;
        const outside = (e) => {
            if (!ref.current.contains(e.target)) setOpen(false);
        };
        window.addEventListener("pointerdown", outside, true);
        // scrolling a long list shouldn't zoom the canvas underneath
        const menu = menuRef.current;
        menu.addEventListener("wheel", stopPropagation);
        menu.querySelector(".dropdown-option.selected")?.scrollIntoView({ block: "nearest" });
        return () => {
            window.removeEventListener("pointerdown", outside, true);
            menu.removeEventListener("wheel", stopPropagation);
        };
    }, [open]);

    const choose = (index) => {
        setOpen(false);
        const option = options[index];
        if (option && option.id !== value) onChange(option.id);
    };

    const onKeyDown = (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
                setActive(selectedIndex);
                setOpen(true);
                return;
            }
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((i) => (i + step + options.length) % options.length);
        } else if ((e.key === "Enter" || e.key === " ") && open) {
            e.preventDefault();
            choose(active);
        } else if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
        }
    };

    return (
        <div className="dropdown" ref={ref}>
            <button
                type="button"
                className={`dropdown-button ${open ? "open" : ""}`}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={label}
                title={title}
                onClick={() => {
                    setActive(selectedIndex);
                    setOpen((o) => !o);
                }}
                onKeyDown={onKeyDown}
            >
                <span className="dropdown-value">{current ? current.label : ""}</span>
                <svg className="dropdown-chevron" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            {open && (
                <ul className="dropdown-menu" role="listbox" aria-label={label} ref={menuRef}>
                    {options.map((option, index) => (
                        <li
                            key={option.id}
                            role="option"
                            aria-selected={option.id === value}
                            className={[
                                "dropdown-option",
                                index === active && "active",
                                option.id === value && "selected",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            onPointerEnter={() => setActive(index)}
                            onClick={() => choose(index)}
                        >
                            <span>{option.label}</span>
                            {option.id === value && (
                                <svg className="dropdown-check" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
