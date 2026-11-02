import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { UserDataProvider } from './lib/userdata.jsx';
import './styles.css';

document.documentElement.dataset.theme = localStorage.getItem('thesis:theme') || 'light';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <UserDataProvider>
      <App />
    </UserDataProvider>
  </BrowserRouter>,
);
