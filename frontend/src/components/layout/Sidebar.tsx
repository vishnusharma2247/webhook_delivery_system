import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const navItems = [
  { href: '/', icon: 'dashboard', label: 'Dashboard', end: true },
  { href: '/subscriptions', icon: 'webhook', label: 'Subscriptions', end: false },
  { href: '/events', icon: 'history', label: 'Event Log', end: false },
  { href: '/dlq', icon: 'warning_amber', label: 'Dead Letter Queue', badge: true, end: false },
];

export function Sidebar() {
  const [dlqCount, setDlqCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await api.getStats();
        setDlqCount(stats.dlq_count || 0);
      } catch (err) {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside
      className="h-screen w-64 fixed left-0 top-0 flex flex-col p-4 z-50"
      style={{ backgroundColor: '#f8fafc', fontFamily: "'Inter', sans-serif" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div
          className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#00488d' }}
        >
          <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>send</span>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">WebhookDS</h1>
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#515f74' }}>
            Delivery System
          </p>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors duration-150 active:scale-95',
                isActive
                  ? 'bg-white text-blue-700 font-semibold shadow-sm'
                  : 'text-slate-500 hover:bg-slate-200/50'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '20px', color: isActive ? '#1d4ed8' : '#64748b' }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.badge && dlqCount > 0 && (
                  <span
                    className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center text-white"
                    style={{ backgroundColor: '#ba1a1a' }}
                  >
                    {dlqCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom user section */}
      <div className="mt-auto pt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
        <div className="flex items-center gap-3 px-2 py-2">
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs"
            style={{ backgroundColor: '#00488d' }}
          >
            WH
          </div>
          <div className="overflow-hidden">
            <p className="font-semibold text-xs text-slate-900 truncate">webhook_admin</p>
            <p className="text-[10px] truncate" style={{ color: '#515f74' }}>Core Delivery Cluster</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
