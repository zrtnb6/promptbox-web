import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/app.css';

const host = document.getElementById('root');
if (!host) throw new Error('#root 容器不存在');

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
