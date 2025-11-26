'use client';

import { useState } from 'react';
import { LayoutDashboard, Inbox, Zap, Link2, TrendingUp } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '#', icon: LayoutDashboard, current: true },
  { name: 'Unified Inbox', href: '#', icon: Inbox, current: false },
  { name: 'Workflows', href: '#', icon: Zap, current: false },
  { name: 'Connections', href: '#', icon: Link2, current: false },
  { name: 'Analytics', href: '#', icon: TrendingUp, current: false },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [currentNav, setCurrentNav] = useState('Dashboard');

  const handleNavClick = (name: string) => {
    setCurrentNav(name);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-white border-r border-neutral-200
          transform transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-neutral-200">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-accent-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">U</span>
              </div>
              <span className="text-lg font-semibold text-neutral-900">UnifyOS</span>
            </div>
            {/* Mobile Close Button */}
            <button
              onClick={onMobileClose}
              className="lg:hidden text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentNav === item.name;
              
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavClick(item.name)}
                  className={`
                    w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg
                    text-sm font-medium transition-all duration-150
                    ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 shadow-sm'
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : 'text-neutral-400'}`} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-200">
            <div className="px-3 py-2 bg-neutral-50 rounded-lg">
              <div className="text-xs font-medium text-neutral-900 mb-1">
                Need help?
              </div>
              <div className="text-xs text-neutral-600">
                Check our <a href="#" className="text-primary-600 hover:text-primary-700 font-medium">documentation</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
