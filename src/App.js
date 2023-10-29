import React from "react";
import { Canvas } from "./Components/Canvas";
import "./App.css";
import { Context } from "./context/context";
import uuid from "react-uuid";
import { SideBar } from "./Components/SideBar";

function App() {
    const [equations, setEquations] = React.useState([]);
    const [result, setResult] = React.useState("");
    const [sections, setSections] = React.useState([
        { value: "root", textValue: "", id: uuid(), parent: null },
    ]);

    return (
        <Context.Provider
            value={{
                equations,
                setEquations,
                result,
                setResult,
                sections,
                setSections,
            }}
        >
            <SideBar />
            <Canvas />
        </Context.Provider>
    );
}

export default App;
