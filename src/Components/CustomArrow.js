import React from "react";
import Xarrow from "react-xarrows";

export const CustomArrow = (props) => {
    return (
        <div style={{ zIndex: "0" }}>
            <Xarrow
                start={props.start}
                end={props.end}
                animateDrawing
                headShape={"circle"}
                arrowHeadProps={{
                    fill: "transparent",
                    strokeWidth: "0.1",
                    stroke: "whitesmoke",
                }}
                color="whitesmoke"
                style
            />
        </div>
    );
};
