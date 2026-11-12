import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ignore benign Vite HMR WebSocket errors in AI Studio preview environment
window.addEventListener('unhandledrejection', (event) => {
  const reasonStr = String(event?.reason || '');
  if (reasonStr.includes('WebSocket') || reasonStr.includes('ws://') || reasonStr.includes('vite')) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  const message = String(event?.message || '');
  if (message.includes('WebSocket') || message.includes('vite')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(<App />);
