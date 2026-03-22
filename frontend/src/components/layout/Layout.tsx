import { Toaster } from 'sonner';
import { Sidebar } from './Sidebar';
import { Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-primary/30">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
      <Toaster theme="system" position="bottom-right" />
    </div>
  );
}