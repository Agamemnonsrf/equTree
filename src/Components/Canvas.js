import React from 'react';
import '../App.css'
import { EquCard } from './EquCard';
import { Context } from '../context/context';


export const Canvas = () => {
    const context = React.useContext(Context);
    const [localSets, setLocalSets] = React.useState([[...context.sections]]);
    React.useEffect(() => { context.setSections(localSets.flat()) }, [localSets]);

    return (
        <div className='canvas' >
            {context.sections.map((section, index) => { return (<div key={section.id}><EquCard variable={section.value} id={section.id} setLocalSets={setLocalSets} index={index} localSets={localSets} /></div>) })}

        </div >
    );
}