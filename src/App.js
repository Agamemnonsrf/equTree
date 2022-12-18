import React from 'react';
import { Canvas } from './Components/Canvas';
import './App.css';
import { Context } from './context/context';

function App() {
  const [equations, setEquations] = React.useState([]);
  const [equation, setEquation] = React.useState('');
  const [result, setResult] = React.useState(0);
  return (
    <Context.Provider value={{ equations, setEquations, result, setResult, equation, setEquation }}>
      <header className='Header'><h2>{result}</h2></header>
      <Canvas />
    </Context.Provider>
  );
}

export default App;
