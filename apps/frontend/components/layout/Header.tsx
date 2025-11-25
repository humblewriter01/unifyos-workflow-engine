export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex justify-between items-center px-6 py-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">
            UnifyOS
          </h1>
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
            Beta
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* App Connection Status */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>3 apps connected</span>
          </div>
          
          {/* User Menu */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
              U
            </div>
          </div>
        </div>
      </div>
    </header>
  );
      }
