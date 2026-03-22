import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

export function Subscriptions() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ url: '', secret: '', event_types: '' });
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      const payload = {
        url: formData.url,
        secret: formData.secret,
        event_types: formData.event_types.split(',').map(s => s.trim()).filter(Boolean)
      };
      await api.createSubscription(payload);
      toast.success('Subscription created');
      setShowForm(false);
      setFormData({ url: '', secret: '', event_types: '' });
      loadSubs();
    } catch (err) {
      toast.error('Creation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this subscription?')) return;
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
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#191c1e' }}>Subscriptions</h1>
          <p className="text-sm mt-1" style={{ color: '#515f74' }}>Manage webhook endpoints and delivery targets.</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wide text-white transition-all active:scale-95 shadow-sm hover:opacity-90"
          style={{ backgroundColor: '#00488d' }}
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New Subscription
        </button>
      </div>

      {/* Inline Add Form */}
      {showForm && (
        <div
          className="rounded-xl p-6 shadow-sm"
          style={{ backgroundColor: '#ffffff', border: '1px solid rgba(194,198,212,0.3)' }}
        >
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: '#191c1e' }}>
            <span className="material-symbols-outlined text-lg" style={{ color: '#00488d' }}>webhook</span>
            Add Webhook Endpoint
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: '#515f74' }}>
                  Endpoint URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.example.com/webhook"
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border-none outline-none focus:ring-1"
                  style={{ backgroundColor: '#f2f4f6', color: '#191c1e' }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: '#515f74' }}>
                  Secret (optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave empty to auto-generate"
                  value={formData.secret}
                  onChange={e => setFormData({ ...formData, secret: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border-none outline-none focus:ring-1"
                  style={{ backgroundColor: '#f2f4f6', color: '#191c1e' }}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: '#515f74' }}>
                Event Types (comma separated)
              </label>
              <input
                type="text"
                placeholder="order.created, payment.failed, user.updated"
                value={formData.event_types}
                onChange={e => setFormData({ ...formData, event_types: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border-none outline-none focus:ring-1"
                style={{ backgroundColor: '#f2f4f6', color: '#191c1e' }}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded text-xs font-bold uppercase tracking-wide text-white transition-all active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: '#00488d' }}
              >
                {submitting ? 'Saving...' : 'Save Subscription'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded text-xs font-bold uppercase tracking-wide transition-all active:scale-95"
                style={{ backgroundColor: '#eceef0', color: '#515f74' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subscriptions Table */}
      <div
        className="rounded-xl shadow-sm overflow-hidden"
        style={{ backgroundColor: '#ffffff', border: '1px solid rgba(194,198,212,0.15)' }}
      >
        <div
          className="px-6 py-4 flex justify-between items-center"
          style={{ borderBottom: '1px solid rgba(194,198,212,0.2)' }}
        >
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: '#191c1e' }}>
            <span className="material-symbols-outlined text-lg" style={{ color: '#00488d' }}>list_alt</span>
            Active Endpoints
          </h2>
          <span className="text-xs" style={{ color: '#515f74' }}>{subs.length} subscription{subs.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-12 rounded" style={{ backgroundColor: '#e0e3e5' }} />)}
          </div>
        ) : subs.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl block mx-auto mb-3" style={{ color: '#c2c6d4' }}>webhook</span>
            <p className="text-sm font-medium mb-1" style={{ color: '#191c1e' }}>No subscriptions yet</p>
            <p className="text-xs" style={{ color: '#515f74' }}>Add your first webhook endpoint to start receiving deliveries.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: 'rgba(242,244,246,0.5)' }}>
                  <TableHead className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Endpoint URL</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Event Types</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>Status</TableHead>
                  <TableHead className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#515f74' }}>ID</TableHead>
                  <TableHead className="px-6 py-3"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((sub) => (
                  <TableRow
                    key={sub.id}
                    className="transition-colors group"
                    style={{ borderBottom: '1px solid rgba(194,198,212,0.12)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f2f4f6')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm" style={{ color: '#00488d' }}>link</span>
                        <span className="font-mono text-xs truncate max-w-[280px]" style={{ color: '#00488d' }} title={sub.url}>
                          {sub.url}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {sub.event_types?.length > 0 ? (
                          sub.event_types.slice(0, 3).map((e: string) => (
                            <span
                              key={e}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: '#d5e3fc', color: '#00488d' }}
                            >
                              {e}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] font-medium" style={{ color: '#515f74' }}>All events</span>
                        )}
                        {sub.event_types?.length > 3 && (
                          <span className="text-[10px] font-medium" style={{ color: '#515f74' }}>+{sub.event_types.length - 3} more</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor: sub.status === 'active' ? '#00488d' : '#ba1a1a',
                            boxShadow: sub.status === 'active' ? '0 0 8px rgba(0,72,141,0.5)' : '0 0 8px rgba(186,26,26,0.5)',
                          }}
                        />
                        <span
                          className="text-xs font-semibold capitalize"
                          style={{ color: sub.status === 'active' ? '#00488d' : '#ba1a1a' }}
                        >
                          {sub.status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="font-mono text-[10px]" style={{ color: '#515f74' }}>{sub.id.substring(0, 8)}</span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded transition-all hover:bg-red-50"
                        title="Delete subscription"
                      >
                        <span className="material-symbols-outlined text-sm" style={{ color: '#ba1a1a' }}>delete</span>
                      </button>
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
