'use client';

import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '#', icon: '📊', current: true },
  { name: 'Unified Inbox', href: '#', icon: '📥', current: false },
  { name: 'Workflows', href: '#', icon: '⚡', current: false },
  { name: 'App Connections', href: '#', icon: '🔗', current: false },
  { name: 'Analytics', href: '#', icon: '📈', current: false },
];

export default function Sidebar() {
  const [currentNav, setCurrentNav] = useState('Dashboard');

  return (
    <div className="w-64 bg-white shadow-lg">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 shadow-sm">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🚀</span>
            <span className="text-xl font-bold text-gray-800">UnifyOS</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => (
            <button
              key={item.name}
              onClick={() => setCurrentNav(item.name)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                currentNav === item.name
                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            Building the future of work
          </div>
        </div>
      </div>
    </div>
  );
              }
