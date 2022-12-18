import React from "react";
import '../App.css'
import Draggable from 'react-draggable';

export const EquCard = () => {
    return (
        <Draggable cancel={'.equ-card-textarea'}>
            <div className='equ-card'>
                <span contentEditable='true' className='equ-card-textarea'>2x + 3</span>
            </div>
        </Draggable>
    );
}