import React from 'react';
import { Canvas } from './Components/Canvas';
import './App.css';
import { Context } from './context/context';

function App() {
  const [equations, setEquations] = React.useState([]);

  const [result, setResult] = React.useState('gwe gwe gwe');
  return (
    <Context.Provider value={{ equations, setEquations, result, setResult }}>
      <header className='Header'><h2>{result}</h2></header>
      <Canvas />
    </Context.Provider>
  );
}

export default App;
