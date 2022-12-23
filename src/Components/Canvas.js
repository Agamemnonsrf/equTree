import React from 'react';
import '../App.css'
import { EquCard } from './EquCard';
import { Context } from '../context/context';


export const Canvas = () => {
    const context = React.useContext(Context);
    return (
        <div className='canvas' >
            {context.sections.map((section, index) => { return (<div key={section.id}><EquCard variable={section.value} id={section.id} /></div>) })}

        </div >
    );
}