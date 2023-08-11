import React from "react";
import Xarrow from "react-xarrows";
import { useTransformContext } from "react-zoom-pan-pinch";

export const CustomArrow = (props) => {
    return (
        <div style={{ zIndex: "0" }}>
            <Xarrow
                SVGcanvasStyle={{ transform: `scale(${1 / props.scale})` }}
                start={props.start}
                end={props.end}
                animateDrawing
                headShape={"circle"}
                strokeWidth={4 * props.scale}
                arrowHeadProps={{
                    fill: "transparent",
                    strokeWidth: "0.1",
                    stroke: "whitesmoke",
                }}
                color="whitesmoke"
            />
        </div>
    );
};
