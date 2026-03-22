import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RefreshCcw, Trash2, Skull } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Skull className="w-8 h-8 text-destructive" /> Dead Letter Queue
          </h2>
          <p className="text-muted-foreground mt-1">Deliveries that failed permanently after max retries.</p>
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden border-destructive/20">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              {[1,2].map(i => <div key={i} className="h-16 bg-white/5 rounded-md animate-pulse" />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-lg font-medium text-foreground">DLQ is empty</h3>
              <p className="text-muted-foreground">All your webhooks are delivering successfully.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-destructive/10">
                <TableRow className="border-destructive/20 hover:bg-transparent">
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Failure Reason</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((d) => (
                  <TableRow key={d.id} className="border-white/5 hover:bg-white/5">
                    <TableCell className="font-mono text-xs text-muted-foreground">{d.id.substring(0,8)}</TableCell>
                    <TableCell>{d.event_type}</TableCell>
                    <TableCell>
                      <span className="inline-block bg-destructive/20 text-destructive text-xs px-2 py-1 rounded truncate max-w-[300px]" title={d.failure_reason}>
                        {d.failure_reason}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-8 border-white/10 hover:bg-white/10" onClick={() => handleRetry(d.id)}>
                          <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Retry
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive hover:text-white" onClick={(e) => handlePurge(d.id, e)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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