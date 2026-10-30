import React from "react";

// A small setting remembered in this browser. Only values listed in
// `allowed` are accepted back from storage.
export const usePreference = (key, fallback, allowed) => {
    const [value, setValue] = React.useState(() => {
        try {
            const saved = window.localStorage.getItem(key);
            if (allowed.includes(saved)) return saved;
        } catch (err) {}
        return fallback;
    });

    React.useEffect(() => {
        try {
            window.localStorage.setItem(key, value);
        } catch (err) {}
    }, [key, value]);

    return [value, setValue];
};
