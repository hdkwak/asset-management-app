import React from 'react';
import { AppProvider } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { ToastProvider } from './components/common/Toast';

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <MainContent />
        </div>
      </AppProvider>
    </ToastProvider>
  );
}
