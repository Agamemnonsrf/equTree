import React from 'react';
import { Canvas } from './Components/Canvas';
import './App.css';
import { Context } from './context/context';
import uuid from 'react-uuid';

function App() {
  const [equations, setEquations] = React.useState([]);
  const [result, setResult] = React.useState('');
  const [sections, setSections] = React.useState([{ value: 'first', textValue: '', id: uuid() }]);

  return (
    <Context.Provider value={{ equations, setEquations, result, setResult, sections, setSections }}>
      <header className='Header'><h2>{result}</h2></header>
      <Canvas />
    </Context.Provider>
  );
}

export default App;
