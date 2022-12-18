import React from 'react';
import '../App.css'
import { EquCard } from './EquCard';
import Draggable from 'react-draggable';
import useWindowDimensions from '../hooks/useWindowDimensions';


export const Canvas = () => {
    const { height, width } = useWindowDimensions();
    return (
        <div className='canvas' >
            <EquCard />
        </div >
    );
}