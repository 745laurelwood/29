import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// The shared skin, then 29's overrides on top. Order matters: both style the
// same classes, and the later stylesheet wins.
import '@laurelwood/card-class/styles.css';
import './styles/nine.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
