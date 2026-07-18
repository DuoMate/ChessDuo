export default function FriendsLoading() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-24 bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-10 w-10 bg-slate-800/50 rounded-xl animate-pulse" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-2xl animate-pulse">
              <div className="w-10 h-10 rounded-full bg-slate-700/50" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-slate-700/50 rounded mb-2" />
                <div className="h-3 w-20 bg-slate-700/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
