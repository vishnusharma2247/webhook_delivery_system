import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, CheckCircle2, Link as LinkIcon, Clock, Skull } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, r] = await Promise.all([
          api.getStats(),
          api.getDeliveries({ limit: 8 })
        ]);
        setStats(s);
        setRecent(r.deliveries || []);
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
        <div className="h-20 w-1/3 bg-white/5 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-32 bg-white/5 rounded-xl" />)}
        </div>
        <div className="h-96 bg-white/5 rounded-xl" />
      </div>
    );
  }

  const statCards = [
    { title: 'Total Deliveries', value: stats?.total_deliveries, icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Success Rate', value: `${(stats?.success_rate || 0).toFixed(1)}%`, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
    { title: 'Active Subs', value: stats?.active_subscriptions, icon: LinkIcon, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { title: 'Pending Retries', value: (stats?.pending_count || 0) + (stats?.failed_count || 0), icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { title: 'Dead Letters', value: stats?.dlq_count, icon: Skull, color: 'text-destructive', bg: 'bg-destructive/10' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground mt-1">System overview and delivery health metrics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {statCards.map((s, i) => (
          <Card key={i} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">{s.title}</CardTitle>
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${s.color}`}>
                {s.value?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No recent deliveries found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Delivery ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempt</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {d.id.substring(0,8)}
                    </TableCell>
                    <TableCell>{d.event_type || '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {d.attempts}/{d.max_retries}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline", className: string }> = {
    pending: { label: 'Pending', variant: 'outline', className: 'text-blue-500 border-blue-500/30 bg-blue-500/10' },
    delivered: { label: 'Delivered', variant: 'outline', className: 'text-green-500 border-green-500/30 bg-green-500/10' },
    failed: { label: 'Failed', variant: 'outline', className: 'text-red-500 border-red-500/30 bg-red-500/10' },
    dlq: { label: 'DLQ', variant: 'outline', className: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10' },
  };

  const s = map[status] || { label: status, variant: 'outline', className: '' };
  
  return (
    <Badge variant={s.variant} className={s.className}>
      {s.label}
    </Badge>
  );
}