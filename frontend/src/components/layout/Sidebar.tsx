import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Link, Activity, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/subscriptions', icon: Link, label: 'Subscriptions' },
  { href: '/events', icon: Activity, label: 'Event Log' },
  { href: '/dlq', icon: Skull, label: 'Dead Letter Queue', badge: true },
];

export function Sidebar() {
  const [dlqCount, setDlqCount] = useState(0);

  useEffect(() => {
    // Poll stats to update DLQ badge
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
    <nav className="w-64 min-w-[256px] border-r border-border bg-card flex flex-col p-6 z-10 shrink-0">
      <div className="mb-10 px-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          WebhookDS
        </h1>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-1.5">
          Delivery System
        </p>
      </div>

      <ul className="flex flex-col gap-1">
        {navItems.map((item) => (
          <li key={item.href}>
            <NavLink
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "opacity-70 group-hover:opacity-100")} />
                  <span>{item.label}</span>
                  {item.badge && dlqCount > 0 && (
                    <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center">
                      {dlqCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}