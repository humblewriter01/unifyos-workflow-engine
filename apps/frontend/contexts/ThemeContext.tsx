'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('unifyos-theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('unifyos-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  if (!mounted) {
    return <div className={theme === 'dark' ? 'dark' : ''}>{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  // Safe for server-side rendering during build
  if (typeof window === 'undefined') {
    return { 
      theme: 'light' as Theme, 
      toggleTheme: () => {} 
    };
  }
  
  const context = useContext(ThemeContext);
  
  // NEVER throw - always return a valid theme object
  if (context === undefined) {
    console.warn('useTheme called outside ThemeProvider - returning default theme');
    return { 
      theme: 'light' as Theme, 
      toggleTheme: () => {
        console.warn('ThemeProvider not available');
      } 
    };
  }
  
  return context;
};
