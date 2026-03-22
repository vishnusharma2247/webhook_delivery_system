import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { StatusBadge } from './Dashboard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const STATUS_FILTERS = [
  { value: 'all',       label: 'All Deliveries' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed',    label: 'Failed' },
  { value: 'pending',   label: 'Pending' },
  { value: 'dlq',       label: 'DLQ' },
];

const STATUS_COLORS: Record<string, string> = {
  delivered: '#00488d',
  failed:    '#ba1a1a',
  pending:   '#f59e0b',
  dlq:       '#ff6b35',
};

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg shadow-xl text-xs" style={{ backgroundColor: '#191c1e', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="font-bold mb-1" style={{ color: '#a8c8ff' }}>{label}</p>
      <span style={{ color: '#e0e3e5' }}>Count: <strong>{payload[0].value}</strong></span>
    </div>
  );
};

export function Events() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getDeliveries({ status: status === 'all' ? '' : status, limit: 50 });
      setDeliveries(data.deliveries || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Build status distribution from current deliveries for the bar chart
  const statusCounts = ['delivered', 'pending', 'failed', 'dlq'].map(s => ({
    name: s.charAt(0).toUpperCase() + s.slice(1),
    key: s,
    count: deliveries.filter(d => d.status === s).length,
  }));

  const totalShown = deliveries.length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#191c1e' }}>Event Log</h1>
          <p className="text-sm mt-1" style={{ color: '#515f74' }}>Real-time audit trail of every webhook delivery decision.</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95"
          style={{ backgroundColor: '#ffffff', color: '#191c1e', border: '1px solid rgba(194,198,212,0.3)' }}
        >
          <span className="material-symbols-outlined text-sm">download</span>
          Export CSV
        </button>
      </div>

      {/* Summary + Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status summary cards */}
        <div
          className="rounded-xl p-5 shadow-sm"
          style={{ backgroundColor: '#ffffff', border: '1px solid rgba(194,198,212,0.15)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#515f74' }}>
            Current View — {totalShown} deliveries
          </p>
          <div className="grid grid-cols-4 gap-3">
            {statusCounts.map(s => (
              <div
                key={s.key}
                className="rounded-lg p-3 flex flex-col items-center gap-1 cursor-pointer transition-all hover:scale-105"
                style={{
                  backgroundColor: status === s.key ? STATUS_COLORS[s.key] + '18' : '#f7f9fb',
                  border: `1px solid ${status === s.key ? STATUS_COLORS[s.key] + '40' : 'rgba(194,198,212,0.2)'}`,
                }}
                onClick={() => setStatus(s.key)}
              >
                <span className="text-xl font-extrabold tabular-nums" style={{ color: STATUS_COLORS[s.key] }}>
                  {s.count}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: '#515f74' }}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>
          {/* Stacked progress bar */}
          {totalShown > 0 && (
            <div className="mt-4">
              <div className="flex h-2 rounded-full overflow-hidden gap-px">
                {statusCounts.filter(s => s.count > 0).map(s => (
                  <div
                    key={s.key}
                    style={{
                      width: `${(s.count / totalShown) * 100}%`,
                      backgroundColor: STATUS_COLORS[s.key],
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                {statusCounts.filter(s => s.count > 0).map(s => (
                  <div key={s.key} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.key] }} />
                    <span className="text-[9px]" style={{ color: '#515f74' }}>
                      {((s.count / totalShown) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bar Chart */}
        <div
          className="rounded-xl p-5 shadow-sm"
          style={{ backgroundColor: '#ffffff', border: '1px solid rgba(194,198,212,0.15)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#515f74' }}>
            Status Distribution
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={statusCounts} margin={{ top: 0, right: 0, left: -25, bottom: 0 }} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(194,198,212,0.3)" horizontal vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: '#515f74' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#515f74' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(194,198,212,0.15)' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {statusCounts.map((s) => (
                  <Cell key={s.key} fill={STATUS_COLORS[s.key]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="rounded-xl p-4 flex flex-wrap items-center gap-4"
        style={{ backgroundColor: '#f2f4f6' }}
      >
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5 px-1" style={{ color: '#515f74' }}>
            Status Filter
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value)}
                className="px-3 py-1.5 rounded text-xs font-medium transition-all active:scale-95"
                style={{
                  backgroundColor: status === f.value ? '#00488d' : '#ffffff',
                  color: status === f.value ? '#ffffff' : '#515f74',
                  boxShadow: status === f.value ? '0 1px 3px rgba(0,72,141,0.3)' : undefined,
                  border: '1px solid rgba(194,198,212,0.3)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto self-end">
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wide text-white transition-all active:scale-95"
            style={{ backgroundColor: '#00488d' }}
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div
        className="rounded-xl shadow-sm overflow-hidden"
        style={{
          backgroundColor: '#ffffff',
          boxShadow: '0 12px 40px rgba(25,28,30,0.06)',
        }}
      >
        {loading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded" style={{ backgroundColor: '#e0e3e5' }} />)}
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl block mx-auto mb-3" style={{ color: '#c2c6d4' }}>inbox</span>
            <p className="text-sm" style={{ color: '#515f74' }}>No events found for this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: 'rgba(230,232,234,0.5)' }}>
                  <TableHead className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Delivery ID</TableHead>
                  <TableHead className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Event Type</TableHead>
                  <TableHead className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Status</TableHead>
                  <TableHead className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Attempts</TableHead>
                  <TableHead className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-right" style={{ color: '#515f74' }}>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <EventRow
                    key={d.id}
                    d={d}
                    expanded={expanded[d.id]}
                    onToggle={() => toggleExpand(d.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({ d, expanded, onToggle }: { d: any; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <TableRow
        className="cursor-pointer transition-colors"
        style={{ borderBottom: '1px solid rgba(194,198,212,0.1)' }}
        onClick={onToggle}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f2f4f6')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
      >
        <TableCell className="px-6 py-3 font-mono text-[11px] tabular-nums" style={{ color: '#424752' }}>
          {d.id.substring(0, 8)}
        </TableCell>
        <TableCell className="px-6 py-3">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#d5e3fc', color: '#00488d' }}
          >
            {d.event_type}
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

      {expanded && (
        <TableRow style={{ backgroundColor: '#f7f9fb' }}>
          <TableCell colSpan={5} className="px-6 py-5">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4
                  className="text-[10px] font-extrabold uppercase tracking-widest mb-2"
                  style={{ color: '#515f74' }}
                >
                  Request Payload
                </h4>
                <pre
                  className="p-4 rounded-lg text-[11px] font-mono overflow-x-auto max-h-[200px]"
                  style={{ backgroundColor: '#191c1e', color: '#a8c8ff' }}
                >
                  {(() => {
                    try { return JSON.stringify(JSON.parse(d.payload), null, 2); }
                    catch { return d.payload; }
                  })()}
                </pre>
              </div>
              <div>
                <h4
                  className="text-[10px] font-extrabold uppercase tracking-widest mb-2"
                  style={{ color: '#515f74' }}
                >
                  Response Info
                </h4>
                {d.response_code ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#515f74' }}>Status Code:</span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: d.response_code >= 200 && d.response_code < 300 ? '#dcfce7' : '#ffdad6',
                          color: d.response_code >= 200 && d.response_code < 300 ? '#166534' : '#ba1a1a',
                        }}
                      >
                        {d.response_code}
                      </span>
                    </div>
                    {d.next_retry_at && (
                      <div className="text-xs" style={{ color: '#515f74' }}>
                        Next Retry: {new Date(d.next_retry_at).toLocaleString()}
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#515f74' }}>Response Body:</span>
                      <pre
                        className="mt-1 p-2 rounded-lg text-[11px] font-mono max-h-[120px] overflow-auto"
                        style={{ backgroundColor: '#191c1e', color: '#e0e3e5' }}
                      >
                        {d.response_body || 'Empty response'}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs italic" style={{ color: '#515f74' }}>
                    No response received (timed out or pending).
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
