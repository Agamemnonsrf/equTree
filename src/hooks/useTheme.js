import React from "react";

const STORAGE_KEY = "equtree:theme";

const readPreference = () => {
    try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved === "light" || saved === "dark" || saved === "system") return saved;
    } catch (err) {}
    return "system";
};

const systemTheme = () =>
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

// Returns [preference, setPreference, resolvedTheme]; the resolved theme is
// written to <html data-theme> where the CSS picks it up.
export const useTheme = () => {
    const [preference, setPreference] = React.useState(readPreference);
    const [system, setSystem] = React.useState(systemTheme);

    React.useEffect(() => {
        if (!window.matchMedia) return;
        const query = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => setSystem(query.matches ? "dark" : "light");
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);

    const resolved = preference === "system" ? system : preference;

    React.useEffect(() => {
        document.documentElement.dataset.theme = resolved;
        try {
            window.localStorage.setItem(STORAGE_KEY, preference);
        } catch (err) {}
    }, [preference, resolved]);

    return [preference, setPreference, resolved];
};
