import React from "react";
import "../App.css";
import { EquCard } from "./EquCard";
import { Context } from "../context/context";
import { useTree } from "../hooks/useTree";
import { useXarrow, Xwrapper } from "react-xarrows";
import { CustomArrow } from "./CustomArrow";
import Draggable from "react-draggable";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export const Canvas = () => {
    const { defaultTree, getChildren } = useTree();
    const [isDragging, setIsDragging] = React.useState(false);
    return (
        <div className="canvas">
            <TransformWrapper
                limitToBounds={false}
                panning={{ disabled: isDragging }}
                maxScale={2}
                doubleClick={{ disabled: true }}
            >
                <TransformComponent
                    wrapperStyle={{ minHeight: "100vh", minWidth: "100vw" }}
                >
                    <EquCard
                        key={defaultTree[0].id}
                        id={defaultTree[0].id}
                        variable={"root"}
                        parent={null}
                        children={[]}
                        setIsDragging={setIsDragging}
                    />
                </TransformComponent>
            </TransformWrapper>
        </div>
    );
};
