import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDistanceToNow, subHours, format } from 'date-fns';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

function buildHourlyData(deliveries: any[]) {
  const now = new Date();
  const slots = Array.from({ length: 24 }, (_, i) => {
    const t = subHours(now, 23 - i);
    return { hour: format(t, 'HH:00'), delivered: 0, failed: 0 };
  });
  deliveries.forEach(d => {
    const diff = now.getTime() - new Date(d.created_at).getTime();
    const hoursAgo = Math.floor(diff / 3_600_000);
    if (hoursAgo >= 0 && hoursAgo < 24) {
      const idx = 23 - hoursAgo;
      if (d.status === 'delivered') slots[idx].delivered++;
      else if (d.status === 'failed' || d.status === 'dlq') slots[idx].failed++;
    }
  });
  return slots;
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-4 py-3 rounded-xl shadow-xl text-xs" style={{ backgroundColor: '#191c1e', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="font-bold mb-2" style={{ color: '#a8c8ff' }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span style={{ color: '#e0e3e5' }}>{p.name}: <strong className="tabular-nums">{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

const DonutTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg shadow-xl text-xs" style={{ backgroundColor: '#191c1e', border: '1px solid rgba(255,255,255,0.08)' }}>
      <span style={{ color: '#e0e3e5' }}>{payload[0].name}: <strong>{payload[0].value.toLocaleString()}</strong></span>
    </div>
  );
};

export function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [chartDeliveries, setChartDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, r, all] = await Promise.all([
          api.getStats(),
          api.getDeliveries({ limit: 8 }),
          api.getDeliveries({ limit: 500 }),
        ]);
        setStats(s);
        setRecent(r.deliveries || []);
        setChartDeliveries(all.deliveries || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 w-1/3 rounded-lg" style={{ backgroundColor: '#e0e3e5' }} />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-28 rounded-lg" style={{ backgroundColor: '#e0e3e5' }} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72 rounded-xl" style={{ backgroundColor: '#e0e3e5' }} />
          <div className="h-72 rounded-xl" style={{ backgroundColor: '#e0e3e5' }} />
        </div>
        <div className="h-80 rounded-lg" style={{ backgroundColor: '#e0e3e5' }} />
      </div>
    );
  }

  const hourlyData = buildHourlyData(chartDeliveries);

  const deliveredCount = Math.max(
    0,
    (stats?.total_deliveries || 0) - (stats?.failed_count || 0) - (stats?.pending_count || 0) - (stats?.dlq_count || 0)
  );
  const statusData = [
    { name: 'Delivered', value: deliveredCount, color: '#00488d' },
    { name: 'Pending',   value: stats?.pending_count || 0, color: '#f59e0b' },
    { name: 'Failed',    value: stats?.failed_count || 0,  color: '#ba1a1a' },
    { name: 'DLQ',       value: stats?.dlq_count || 0,     color: '#ff6b35' },
  ].filter(d => d.value > 0);

  const statusTotal = statusData.reduce((s, d) => s + d.value, 0);

  const successRate = stats?.success_rate || 0;
  const isHealthy = successRate >= 95;

  const statCards = [
    { title: 'Total Deliveries', value: stats?.total_deliveries?.toLocaleString() ?? '0', icon: 'send', isError: false, trendLabel: '' },
    { title: 'Success Rate', value: `${successRate.toFixed(1)}%`, icon: 'check_circle', isError: false, trendLabel: isHealthy ? 'Healthy' : 'Degraded' },
    { title: 'Active Subscriptions', value: stats?.active_subscriptions?.toLocaleString() ?? '0', icon: 'webhook', isError: false, trendLabel: '' },
    { title: 'Pending Retries', value: ((stats?.pending_count || 0) + (stats?.failed_count || 0)).toLocaleString(), icon: 'schedule', isError: false, trendLabel: '' },
    { title: 'Dead Letters', value: stats?.dlq_count?.toLocaleString() ?? '0', icon: 'warning_amber', isError: true, trendLabel: '' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#191c1e' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: '#515f74' }}>Real-time overview of webhook delivery health and throughput.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: isHealthy ? '#22c55e' : '#f59e0b',
                boxShadow: isHealthy ? '0 0 6px rgba(34,197,94,0.6)' : '0 0 6px rgba(245,158,11,0.6)',
              }}
            />
            <span className="text-xs font-semibold" style={{ color: isHealthy ? '#166534' : '#92400e' }}>
              {isHealthy ? 'All systems healthy' : 'Degraded performance'}
            </span>
          </div>
          <span className="text-xs" style={{ color: '#c2c6d4' }}>|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: '#515f74' }}>Auto-refreshing</span>
            <span className="material-symbols-outlined text-sm" style={{ color: '#00488d' }}>sync</span>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {statCards.map((card, i) => (
          <div
            key={i}
            className="p-5 rounded-xl shadow-sm"
            style={{ backgroundColor: '#ffffff', border: '1px solid rgba(194,198,212,0.15)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#515f74' }}>
              {card.title}
            </p>
            <div className="flex items-end justify-between mt-2">
              <span
                className="text-3xl font-extrabold tracking-tight tabular-nums"
                style={{ color: card.isError ? '#ba1a1a' : '#191c1e' }}
              >
                {card.value}
              </span>
              <span
                className="material-symbols-outlined mb-1"
                style={{ fontSize: '22px', color: card.isError ? '#ba1a1a' : '#00488d', opacity: 0.7 }}
              >
                {card.icon}
              </span>
            </div>
            {card.trendLabel && (
              <p className="text-[10px] font-semibold mt-1.5 flex items-center gap-1"
                style={{ color: card.trendLabel === 'Healthy' ? '#166534' : '#92400e' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                  {card.trendLabel === 'Healthy' ? 'trending_up' : 'trending_down'}
                </span>
                {card.trendLabel}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area Chart */}
        <div
          className="lg:col-span-2 rounded-xl p-6 shadow-sm"
          style={{ backgroundColor: '#ffffff', border: '1px solid rgba(194,198,212,0.15)' }}
        >
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-sm font-bold" style={{ color: '#191c1e' }}>Delivery Activity</h2>
              <p className="text-[10px] mt-0.5" style={{ color: '#515f74' }}>Last 24 hours — hourly breakdown</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-[2px] rounded" style={{ backgroundColor: '#00488d' }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#515f74' }}>Delivered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-[2px] rounded" style={{ backgroundColor: '#ba1a1a' }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#515f74' }}>Failed</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="deliveredGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00488d" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#00488d" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ba1a1a" stopOpacity={0.14} />
                  <stop offset="95%" stopColor="#ba1a1a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(194,198,212,0.3)" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 9, fill: '#515f74' }}
                tickLine={false}
                axisLine={false}
                interval={3}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#515f74' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="delivered"
                name="Delivered"
                stroke="#00488d"
                strokeWidth={2}
                fill="url(#deliveredGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#00488d', strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="failed"
                name="Failed"
                stroke="#ba1a1a"
                strokeWidth={2}
                fill="url(#failedGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#ba1a1a', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut Chart */}
        <div
          className="rounded-xl p-6 shadow-sm flex flex-col"
          style={{ backgroundColor: '#ffffff', border: '1px solid rgba(194,198,212,0.15)' }}
        >
          <div className="mb-3">
            <h2 className="text-sm font-bold" style={{ color: '#191c1e' }}>Status Breakdown</h2>
            <p className="text-[10px] mt-0.5" style={{ color: '#515f74' }}>All-time delivery distribution</p>
          </div>

          {statusData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm" style={{ color: '#515f74' }}>No data yet</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-extrabold tabular-nums" style={{ color: '#191c1e' }}>
                    {successRate.toFixed(0)}%
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#515f74' }}>
                    Success
                  </span>
                </div>
              </div>

              <div className="space-y-2 mt-2">
                {statusData.map(d => {
                  const pct = statusTotal > 0 ? ((d.value / statusTotal) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-[11px] font-medium flex-1" style={{ color: '#515f74' }}>{d.name}</span>
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: '#191c1e' }}>
                        {d.value.toLocaleString()}
                      </span>
                      <span className="text-[10px] w-9 text-right" style={{ color: '#515f74' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent Deliveries Table */}
      <div
        className="rounded-xl shadow-sm overflow-hidden"
        style={{ backgroundColor: '#ffffff', border: '1px solid rgba(194,198,212,0.15)' }}
      >
        <div
          className="px-6 py-4 flex justify-between items-center"
          style={{ borderBottom: '1px solid rgba(194,198,212,0.2)' }}
        >
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: '#191c1e' }}>
            <span className="material-symbols-outlined text-lg" style={{ color: '#00488d' }}>history</span>
            Recent Deliveries
          </h2>
          <span className="text-xs" style={{ color: '#515f74' }}>Last 8 events</span>
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl block mx-auto mb-3" style={{ color: '#c2c6d4' }}>inbox</span>
            <p className="text-sm" style={{ color: '#515f74' }}>No recent deliveries found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: 'rgba(242,244,246,0.5)' }}>
                  <TableHead className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Delivery ID</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Event Type</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Status</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Attempts</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest text-right" style={{ color: '#515f74' }}>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((d) => (
                  <TableRow
                    key={d.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid rgba(194,198,212,0.12)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f2f4f6')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <TableCell className="px-6 py-3 font-mono text-[11px]" style={{ color: '#424752' }}>
                      {d.id.substring(0, 8)}
                    </TableCell>
                    <TableCell className="px-6 py-3">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#d5e3fc', color: '#00488d' }}
                      >
                        {d.event_type || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-3">
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="px-6 py-3 text-xs tabular-nums" style={{ color: '#515f74' }}>
                      {d.attempts}/{d.max_retries}
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right text-[11px] whitespace-nowrap" style={{ color: '#515f74' }}>
                      {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending:   { label: 'Pending',   bg: '#d5e3fc', color: '#00488d' },
    delivered: { label: 'Delivered', bg: '#dcfce7', color: '#166534' },
    failed:    { label: 'Failed',    bg: '#ffdad6', color: '#ba1a1a' },
    dlq:       { label: 'DLQ',       bg: '#ffdbcb', color: '#7b3200' },
  };
  const s = map[status] || { label: status, bg: '#e0e3e5', color: '#515f74' };
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}
