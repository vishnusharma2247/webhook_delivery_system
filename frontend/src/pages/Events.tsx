import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';
import { StatusBadge } from './Dashboard';


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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Event Log</h2>
        <p className="text-muted-foreground mt-1">Detailed history of all webhook deliveries.</p>
      </div>

      <Tabs defaultValue="all" onValueChange={setStatus} className="w-full">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger value="all">All Deliveries</TabsTrigger>
          <TabsTrigger value="delivered" className="data-[state=active]:text-green-500">Delivered</TabsTrigger>
          <TabsTrigger value="failed" className="data-[state=active]:text-red-500">Failed</TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:text-blue-500">Pending</TabsTrigger>
          <TabsTrigger value="dlq" className="data-[state=active]:text-yellow-500">DLQ</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-white/5 rounded-md animate-pulse" />)}
            </div>
          ) : deliveries.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">No events found for this filter.</div>
          ) : (
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Retry Attempts</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <ContentRow key={d.id} d={d} expanded={expanded[d.id]} onToggle={() => toggleExpand(d.id)} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ContentRow({ d, expanded, onToggle }: { d: any, expanded: boolean, onToggle: () => void }) {
  return (
    <>
      <TableRow className="border-white/5 hover:bg-white/5 cursor-pointer transition-colors" onClick={onToggle}>
        <TableCell className="font-mono text-xs text-muted-foreground">{d.id.substring(0,8)}</TableCell>
        <TableCell>
          <Badge variant="secondary" className="bg-primary/10 hover:bg-primary/20">{d.event_type}</Badge>
        </TableCell>
        <TableCell>
          <StatusBadge status={d.status} />
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">{d.attempts}/{d.max_retries}</TableCell>
        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="border-white/5 bg-black/20 hover:bg-black/20">
          <TableCell colSpan={5} className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Request Payload</h4>
                <pre className="bg-[#0d1117] p-4 rounded-lg text-xs font-mono text-green-400 overflow-x-auto max-h-[200px]">
                  {JSON.stringify(JSON.parse(d.payload), null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Response Info</h4>
                {d.response_code ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Status Code:</span>
                      <Badge variant={d.response_code >= 200 && d.response_code < 300 ? 'default' : 'destructive'} className={d.response_code >= 200 && d.response_code < 300 ? 'bg-green-500' : ''}>
                        {d.response_code}
                      </Badge>
                    </div>
                    {d.next_retry_at && (
                      <div className="text-xs text-muted-foreground">
                        Next Retry: {new Date(d.next_retry_at).toLocaleString()}
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-muted-foreground">Response Body:</span>
                      <pre className="bg-[#0d1117] mt-1 p-2 rounded-lg text-xs font-mono text-gray-300 max-h-[120px] overflow-auto">
                        {d.response_body || 'Empty response'}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">No response received (timed out or pending).</div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}