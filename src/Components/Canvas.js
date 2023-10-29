import React from "react";
import "../App.css";
import { EquCard } from "./EquCard";
import { useTree } from "../hooks/useTree";
import { SideBar } from "./SideBar";
import { useXarrow, Xwrapper } from "react-xarrows";
import { CustomArrow } from "./CustomArrow";
import Draggable from "react-draggable";
import {
    TransformWrapper,
    TransformComponent,
    getTransformStyles,
    useTransformContext,
} from "react-zoom-pan-pinch";

export const Canvas = () => {
    const { defaultTree, getChildren } = useTree();
    const [isDragging, setIsDragging] = React.useState(false);

    return (
        <>
            <div className="canvas">
                <TransformWrapper
                    limitToBounds={false}
                    panning={{
                        disabled: isDragging,
                        excluded: [
                            "mq-math-mode",
                            "name-var-popup-input",
                            "mq-root-block",
                        ],
                    }}
                    maxScale={2}
                    minScale={0.3}
                    doubleClick={{ disabled: true }}
                >
                    <TransformComponent
                        wrapperStyle={{
                            height: "100vh",
                            width: "100vw",
                        }}
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
        </>
    );
};
