'use client';

import { useEffect, useState } from 'react';
import { Menu, Bell, Search, Settings, User, ChevronDown, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../lib/api';

interface HeaderProps {
  onMobileMenuClick?: () => void;
}

export default function Header({ onMobileMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [connectedApps, setConnectedApps] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    loadHeaderData();
  }, []);

  const loadHeaderData = async () => {
    try {
      const [apps, notifications] = await Promise.all([
        api.apps.getAll(),
        api.notifications.getAll()
      ]);
      setConnectedApps(apps.filter(app => app.connected).length);
      setUnreadNotifications(notifications.filter(n => n.unread).length);
    } catch (error) {
      console.error('Failed to load header data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="bg-white dark:bg-dark-900 border-b border-neutral-200 dark:border-dark-700 transition-colors">
      <div className="flex justify-between items-center px-4 sm:px-6 h-16">
        <div className="flex items-center space-x-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onMobileMenuClick}
            className="lg:hidden p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-dark-800 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex items-center relative">
            <Search className="absolute left-3 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
            <input
              type="text"
              placeholder="Search..."
              className="w-80 pl-10 pr-4 py-2 text-sm bg-neutral-50 dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* App Connection Status */}
          <div className="hidden sm:flex items-center px-3 py-1.5 bg-neutral-50 dark:bg-dark-800 rounded-lg border border-neutral-200 dark:border-dark-700 transition-colors">
            <div className="flex items-center space-x-2">
              {loading ? (
                <div className="w-2 h-2 bg-neutral-300 dark:bg-neutral-600 rounded-full animate-pulse"></div>
              ) : connectedApps > 0 ? (
                <>
                  <div className="relative">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
                  </div>
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {connectedApps} {connectedApps === 1 ? 'app' : 'apps'}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full"></div>
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    No apps
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Theme Toggle - ALWAYS VISIBLE */}
          {mounted && (
            <button
              onClick={toggleTheme}
              className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-dark-800 rounded-lg transition-colors border border-transparent hover:border-neutral-200 dark:hover:border-dark-700"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Notifications */}
          <button 
            className="relative p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-dark-800 rounded-lg transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-600 rounded-full"></span>
            )}
          </button>

          {/* Settings */}
          <button 
            className="hidden md:block p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-dark-800 rounded-lg transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* User Menu */}
          <div className="flex items-center pl-2 border-l border-neutral-200 dark:border-dark-700">
            <button className="flex items-center space-x-2 px-2 py-1.5 hover:bg-neutral-50 dark:hover:bg-dark-800 rounded-lg transition-colors group">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-sm font-medium text-neutral-900 dark:text-white">User</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">Free Plan</div>
              </div>
              <ChevronDown className="hidden lg:block w-4 h-4 text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Location: apps/frontend/components/layout/Header.tsx
// Theme toggle is prominently placed and always visible
