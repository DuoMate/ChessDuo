export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-24 bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-10 w-10 bg-slate-800/50 rounded-xl animate-pulse" />
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 bg-slate-800/50 rounded-2xl animate-pulse">
              <div className="h-5 w-40 bg-slate-700/50 rounded mb-2" />
              <div className="h-4 w-64 bg-slate-700/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
