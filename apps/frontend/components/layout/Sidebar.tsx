'use client';

import { useRouter } from 'next/router';
import { LayoutDashboard, Inbox, Zap, Link2, TrendingUp } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Unified Inbox', href: '/inbox', icon: Inbox },
  { name: 'Workflows', href: '/workflows', icon: Zap },
  { name: 'Connections', href: '/apps', icon: Link2 },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const router = useRouter();

  const handleNavClick = (href: string) => {
    router.push(href);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return router.pathname === '/';
    }
    return router.pathname.startsWith(href);
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
          w-64 bg-white dark:bg-dark-900 border-r border-neutral-200 dark:border-dark-700
          transform transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-neutral-200 dark:border-dark-700">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-accent-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">U</span>
              </div>
              <span className="text-lg font-semibold text-neutral-900 dark:text-white">UnifyOS</span>
            </div>
            {/* Mobile Close Button */}
            <button
              onClick={onMobileClose}
              className="lg:hidden text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
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
              const active = isActive(item.href);
              
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavClick(item.href)}
                  className={`
                    w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg
                    text-sm font-medium transition-all duration-150
                    ${
                      active
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 shadow-sm'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-dark-800 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-400 dark:text-neutral-500'}`} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-200 dark:border-dark-700">
            <div className="px-3 py-2 bg-neutral-50 dark:bg-dark-800 rounded-lg">
              <div className="text-xs font-medium text-neutral-900 dark:text-white mb-1">
                Need help?
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                Check our <a href="#" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">documentation</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Location: apps/frontend/components/layout/Sidebar.tsx
