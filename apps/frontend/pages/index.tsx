export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Welcome to <span className="text-blue-600">UnifyOS</span> 🚀
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your centralized automation hub is coming soon...
          </p>
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4">Core Features</h2>
            <ul className="text-left space-y-2 text-gray-700">
              <li>✅ Unified Dashboard</li>
              <li>✅ Automated Workflows</li>
              <li>✅ AI Co-Pilot</li>
              <li>✅ Multi-App Integration</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
