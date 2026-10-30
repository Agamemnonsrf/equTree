import React from "react";

// The trash, plus, check and edit glyphs are the original Font Awesome paths;
// the rest are simple stroke icons drawn to match.
const PATHS = {
    trash: (
        <path d="M160 400C160 408.8 152.8 416 144 416C135.2 416 128 408.8 128 400V192C128 183.2 135.2 176 144 176C152.8 176 160 183.2 160 192V400zM240 400C240 408.8 232.8 416 224 416C215.2 416 208 408.8 208 400V192C208 183.2 215.2 176 224 176C232.8 176 240 183.2 240 192V400zM320 400C320 408.8 312.8 416 304 416C295.2 416 288 408.8 288 400V192C288 183.2 295.2 176 304 176C312.8 176 320 183.2 320 192V400zM317.5 24.94L354.2 80H424C437.3 80 448 90.75 448 104C448 117.3 437.3 128 424 128H416V432C416 476.2 380.2 512 336 512H112C67.82 512 32 476.2 32 432V128H24C10.75 128 0 117.3 0 104C0 90.75 10.75 80 24 80H93.82L130.5 24.94C140.9 9.357 158.4 0 177.1 0H270.9C289.6 0 307.1 9.358 317.5 24.94H317.5zM151.5 80H296.5L277.5 51.56C276 49.34 273.5 48 270.9 48H177.1C174.5 48 171.1 49.34 170.5 51.56L151.5 80zM80 432C80 449.7 94.33 464 112 464H336C353.7 464 368 449.7 368 432V128H80V432z" />
    ),
    plus: (
        <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z" />
    ),
    check: (
        <path d="M470.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L192 338.7 425.4 105.4c12.5-12.5 32.8-12.5 45.3 0z" />
    ),
    edit: (
        <path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.8 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z" />
    ),
};

const VIEWBOX = { trash: "0 0 448 512", plus: "0 0 448 512", check: "0 0 512 512", edit: "0 0 512 512" };

const STROKE_PATHS = {
    chart: (
        <>
            <path d="M3 3v18h18" />
            <path d="M7 15l4-5 3 3 5-7" />
        </>
    ),
    unlink: (
        <>
            <path d="M18.8 12.3l1.7-1.7a5 5 0 0 0-7.1-7.1l-1.7 1.7" />
            <path d="M5.2 11.7l-1.7 1.7a5 5 0 0 0 7.1 7.1l1.7-1.7" />
            <path d="M8 2v3M2 8h3M16 22v-3M22 16h-3" />
        </>
    ),
    lock: (
        <>
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </>
    ),
    close: <path d="M18 6L6 18M6 6l12 12" />,
    undo: (
        <>
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </>
    ),
    redo: (
        <>
            <path d="M15 14l5-5-5-5" />
            <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
        </>
    ),
    pencil: <path d="M15 4l5 5L9 20H4v-5L15 4z" />,
};

const GRIP = (
    <>
        {[6, 12, 18].map((cy) =>
            [9, 15].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.7" />)
        )}
    </>
);

export const Icon = ({ name, className }) => {
    if (PATHS[name]) {
        return (
            <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox={VIEWBOX[name]} aria-hidden="true">
                {PATHS[name]}
            </svg>
        );
    }
    if (name === "grip") {
        return (
            <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
                {GRIP}
            </svg>
        );
    }
    // fill="none" sits on the group so a CSS fill on the <svg> can't paint
    // these outline icons solid
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <g
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {STROKE_PATHS[name]}
            </g>
        </svg>
    );
};
