import { Menu, Bell, Search, Settings, User, ChevronDown } from 'lucide-react';

interface HeaderProps {
  onMobileMenuClick?: () => void;
}

export default function Header({ onMobileMenuClick }: HeaderProps) {
  return (
    <header className="bg-white border-b border-neutral-200">
      <div className="flex justify-between items-center px-4 sm:px-6 h-16">
        <div className="flex items-center space-x-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onMobileMenuClick}
            className="lg:hidden p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex items-center relative">
            <Search className="absolute left-3 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-80 pl-10 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* App Connection Status */}
          <div className="hidden sm:flex items-center px-3 py-1.5 bg-neutral-50 rounded-lg border border-neutral-200">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
              </div>
              <span className="text-sm font-medium text-neutral-700">
                3 apps
              </span>
            </div>
          </div>

          {/* Notifications */}
          <button className="relative p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-600 rounded-full"></span>
          </button>

          {/* Settings */}
          <button className="hidden md:block p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded-lg transition-colors">
            <Settings className="w-5 h-5" />
          </button>

          {/* User Menu */}
          <div className="flex items-center pl-2 border-l border-neutral-200">
            <button className="flex items-center space-x-2 px-2 py-1.5 hover:bg-neutral-50 rounded-lg transition-colors group">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-sm font-medium text-neutral-900">Admin</div>
                <div className="text-xs text-neutral-500">admin@company.com</div>
              </div>
              <ChevronDown className="hidden lg:block w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
          }
