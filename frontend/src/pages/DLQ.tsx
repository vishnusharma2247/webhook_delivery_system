import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg shadow-xl text-xs" style={{ backgroundColor: '#191c1e', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="font-bold mb-1" style={{ color: '#ffdad6' }}>{label}</p>
      <span style={{ color: '#e0e3e5' }}>Failures: <strong>{payload[0].value}</strong></span>
    </div>
  );
};

function buildEventTypeData(entries: any[]) {
  const counts: Record<string, number> = {};
  entries.forEach(e => {
    if (e.event_type) counts[e.event_type] = (counts[e.event_type] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function buildTimelineData(entries: any[]) {
  const now = new Date();
  const slots: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    slots[key] = 0;
  }
  entries.forEach(e => {
    const d = new Date(e.created_at);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (key in slots) slots[key]++;
  });
  return Object.entries(slots).map(([day, count]) => ({ day, count }));
}

export function DLQ() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await api.getDLQ({ limit: 100 });
      setEntries(data.entries || []);
    } catch (err) {
      toast.error('Failed to load DLQ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRetry = async (id: string) => {
    try {
      await api.retryDLQ(id);
      toast.success('Re-queued for delivery');
      load();
    } catch (err) {
      toast.error('Retry failed');
    }
  };

  const handlePurge = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.purgeDLQ(id);
      toast.success('Purged successfully');
      load();
    } catch (err) {
      toast.error('Purge failed');
    }
  };

  const eventTypeData = buildEventTypeData(entries);
  const timelineData = buildTimelineData(entries);

  // Gradient colors for bar chart
  const barColors = ['#ba1a1a', '#c73030', '#d44646', '#e05c5c', '#ec7272', '#f48888', '#f99e9e', '#fdb4b4'];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3" style={{ color: '#191c1e' }}>
            <span className="material-symbols-outlined text-3xl" style={{ color: '#ba1a1a' }}>warning_amber</span>
            Dead Letter Queue
          </h1>
          <p className="text-sm mt-1" style={{ color: '#515f74' }}>
            Deliveries that failed permanently after exhausting all retry attempts.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95"
          style={{ backgroundColor: '#ffffff', color: '#191c1e', border: '1px solid rgba(194,198,212,0.3)' }}
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {!loading && entries.length > 0 && (
        <div
          className="flex items-center gap-3 px-6 py-3 rounded-lg"
          style={{ backgroundColor: '#ffdad6', borderLeft: '4px solid #ba1a1a' }}
        >
          <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '20px' }}>error</span>
          <span className="text-sm font-medium" style={{ color: '#93000a' }}>
            {entries.length} delivery{entries.length !== 1 ? 'ies' : ''} in the dead letter queue requiring attention.
          </span>
        </div>
      )}

      {/* Charts — only show when there are entries */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Event Type Breakdown */}
          <div
            className="rounded-xl p-6 shadow-sm"
            style={{ backgroundColor: '#ffffff', border: '1px solid rgba(186,26,26,0.12)' }}
          >
            <h2 className="text-sm font-bold mb-1" style={{ color: '#191c1e' }}>Failure by Event Type</h2>
            <p className="text-[10px] mb-4" style={{ color: '#515f74' }}>Which events are failing most</p>
            {eventTypeData.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-xs" style={{ color: '#515f74' }}>No data</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, eventTypeData.length * 36)}>
                <BarChart
                  data={eventTypeData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  barSize={16}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(194,198,212,0.3)" vertical horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 9, fill: '#515f74' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#515f74' }}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(186,26,26,0.06)' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {eventTypeData.map((_, i) => (
                      <Cell key={i} fill={barColors[i % barColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 7-Day Timeline */}
          <div
            className="rounded-xl p-6 shadow-sm"
            style={{ backgroundColor: '#ffffff', border: '1px solid rgba(186,26,26,0.12)' }}
          >
            <h2 className="text-sm font-bold mb-1" style={{ color: '#191c1e' }}>DLQ Arrivals — Last 7 Days</h2>
            <p className="text-[10px] mb-4" style={{ color: '#515f74' }}>Daily count of permanently failed deliveries</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={timelineData} margin={{ top: 0, right: 5, left: -20, bottom: 0 }} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(194,198,212,0.3)" vertical={false} />
                <XAxis
                  dataKey="day"
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
                <Tooltip
                  formatter={(value) => [value, 'DLQ entries']}
                  contentStyle={{ backgroundColor: '#191c1e', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#e0e3e5' }}
                />
                <Bar dataKey="count" fill="#ba1a1a" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* DLQ Table */}
      <div
        className="rounded-xl shadow-sm overflow-hidden"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid rgba(186,26,26,0.15)',
          boxShadow: '0 12px 40px rgba(25,28,30,0.06)',
        }}
      >
        <div
          className="px-6 py-4 flex justify-between items-center"
          style={{
            backgroundColor: 'rgba(255,218,214,0.4)',
            borderBottom: '1px solid rgba(186,26,26,0.1)',
          }}
        >
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: '#191c1e' }}>
            <span className="material-symbols-outlined text-lg" style={{ color: '#ba1a1a' }}>warning_amber</span>
            Failed Deliveries
          </h2>
          <span className="text-xs font-semibold" style={{ color: '#ba1a1a' }}>
            {entries.length} item{entries.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {[1,2].map(i => <div key={i} className="h-14 rounded" style={{ backgroundColor: '#e0e3e5' }} />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#dcfce7' }}
            >
              <span className="material-symbols-outlined text-3xl" style={{ color: '#166534' }}>check_circle</span>
            </div>
            <h3 className="text-base font-bold mb-1" style={{ color: '#191c1e' }}>DLQ is empty</h3>
            <p className="text-sm" style={{ color: '#515f74' }}>All webhooks are delivering successfully.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: 'rgba(255,218,214,0.2)' }}>
                  <TableHead className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>ID</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Event Type</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Failure Reason</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Failed At</TableHead>
                  <TableHead className="px-6 py-3 text-right text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((d) => (
                  <TableRow
                    key={d.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid rgba(194,198,212,0.1)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fff8f7')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <TableCell className="px-6 py-4 font-mono text-[11px]" style={{ color: '#424752' }}>
                      {d.id.substring(0, 8)}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#ffdad6', color: '#93000a' }}
                      >
                        {d.event_type}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span
                        className="inline-block text-xs px-2 py-1 rounded truncate max-w-[320px]"
                        style={{ backgroundColor: '#ffdad6', color: '#ba1a1a' }}
                        title={d.failure_reason}
                      >
                        {d.failure_reason}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs whitespace-nowrap" style={{ color: '#515f74' }}>
                      {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRetry(d.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all active:scale-95"
                          style={{ backgroundColor: '#d5e3fc', color: '#00488d' }}
                        >
                          <span className="material-symbols-outlined text-sm">refresh</span>
                          Retry
                        </button>
                        <button
                          onClick={(e) => handlePurge(d.id, e)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all active:scale-95"
                          style={{ backgroundColor: '#ffdad6', color: '#ba1a1a' }}
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          Purge
                        </button>
                      </div>
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
