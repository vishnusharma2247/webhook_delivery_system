import { Toaster } from 'sonner';
import { Sidebar } from './Sidebar';
import { Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f9fb', fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      {/* Top App Bar */}
      <header className="fixed top-0 right-0 left-64 h-16 z-40 flex justify-between items-center px-8"
        style={{
          backgroundColor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(194,198,212,0.4)',
          boxShadow: '0 1px 3px rgba(25,28,30,0.06)',
        }}>
        <div className="flex items-center gap-8">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input
              className="pl-10 pr-4 py-1.5 rounded-lg text-xs w-64 border-none outline-none focus:ring-1 focus:ring-blue-600 transition-all"
              style={{ backgroundColor: '#f2f4f6', color: '#191c1e' }}
              placeholder="Search deliveries, subscriptions..."
            />
          </div>
          <nav className="flex items-center gap-6">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400 cursor-default select-none">Docs</span>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400 cursor-default select-none">API Status</span>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400 cursor-default select-none">Support</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <span className="material-symbols-outlined text-xl">refresh</span>
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <span className="material-symbols-outlined text-xl">help_outline</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="ml-64 pt-16 min-h-screen">
        <div className="p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>

      <Toaster theme="light" position="bottom-right" />
    </div>
  );
}
