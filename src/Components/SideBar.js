import React from "react";

export const SideBar = () => {
    return (
        <div
            style={{
                height: "100vh",
                width: "10vw",
                backgroundColor: "white",
                float: "left",
            }}
        >
            <ul style={{ listStyleType: "none", padding: 0 }}>
                <li style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>
                    Zoom
                </li>
                <li style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>
                    Add New Tree
                </li>
                <li style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>
                    Current Trees
                </li>
            </ul>
        </div>
    );
};
