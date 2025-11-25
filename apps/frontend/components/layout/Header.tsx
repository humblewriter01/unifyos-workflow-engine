interface HeaderProps {
  onMobileMenuClick?: () => void;
}

export default function Header({ onMobileMenuClick }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex justify-between items-center px-4 sm:px-6 py-4">
        <div className="flex items-center space-x-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onMobileMenuClick}
            className="lg:hidden text-gray-600 hover:text-gray-900 focus:outline-none"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {/* Logo - Hidden on mobile when sidebar is present */}
          <div className="flex items-center space-x-2 lg:space-x-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              UnifyOS
            </h1>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
              Beta
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* App Connection Status */}
          <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="hidden md:inline">3 apps connected</span>
            <span className="md:hidden">3 apps</span>
          </div>

          {/* Notifications Bell - Mobile Optimized */}
          <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {/* Notification Badge */}
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User Menu */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
              U
            </div>
            {/* User Name - Hidden on small screens */}
            <span className="hidden md:inline text-sm font-medium text-gray-700">
              User
            </span>
          </div>
        </div>
      </div>
    </header>
  );
          }
