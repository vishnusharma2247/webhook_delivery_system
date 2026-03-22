import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function Subscriptions() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ url: '', secret: '', event_types: '' });

  const loadSubs = async () => {
    try {
      const data = await api.getSubscriptions();
      setSubs(data.subscriptions || []);
    } catch (err) {
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubs();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        url: formData.url,
        secret: formData.secret,
        event_types: formData.event_types.split(',').map(s => s.trim()).filter(Boolean)
      };
      await api.createSubscription(payload);
      toast.success('Subscription created');
      setOpen(false);
      loadSubs();
      setFormData({ url: '', secret: '', event_types: '' });
    } catch (err) {
      toast.error('Creation failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.deleteSubscription(id);
      toast.success('Deleted successfully');
      loadSubs();
    } catch (err) {
      toast.error('Deletion failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Subscriptions</h2>
          <p className="text-muted-foreground mt-1">Manage where webhooks are delivered.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="bg-primary text-primary-foreground" />}>
            <Plus className="w-4 h-4 mr-2" /> Add Endpoint
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Webhook Subscription</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="url">Endpoint URL</Label>
                <Input id="url" type="url" required placeholder="https://api.example.com/webhook" 
                  value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret">Secret (Optional)</Label>
                <Input id="secret" type="password" placeholder="Leave empty to auto-generate" 
                  value={formData.secret} onChange={e => setFormData({ ...formData, secret: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="events">Event Types (comma separated)</Label>
                <Input id="events" placeholder="order.created, payment.failed" 
                  value={formData.event_types} onChange={e => setFormData({ ...formData, event_types: e.target.value })} />
              </div>
              <Button type="submit" className="w-full">Save Subscription</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-white/5 rounded-xl border border-white/5" />)}
        </div>
      ) : subs.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-white/10 rounded-xl">
          <p className="text-muted-foreground">No subscriptions configured yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subs.map(sub => (
            <Card key={sub.id} className="shadow-sm flex flex-col relative group">
              <CardHeader className="pb-3 text-sm">
                <div className="flex justify-between items-start">
                  <CardTitle className="truncate pr-4 text-primary max-w-full font-mono text-xs" title={sub.url}>
                    {sub.url}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {sub.event_types?.length > 0 ? (
                      sub.event_types.map((e: string) => (
                        <Badge key={e} variant="secondary" className="bg-purple-500/10 text-purple-500 border-purple-500/20">{e}</Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-white/10">All events</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Badge variant="outline" className={sub.status === 'active' ? "text-green-500 border-green-500/20 bg-green-500/10" : "text-yellow-500 border-yellow-500/20 bg-yellow-500/10"}>
                      {sub.status}
                    </Badge>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-white/5 flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-white hover:bg-destructive" onClick={() => handleDelete(sub.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}