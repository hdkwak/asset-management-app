import React from 'react';
import { AppProvider } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';

export default function App() {
  return (
    <AppProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <MainContent />
      </div>
    </AppProvider>
  );
}
