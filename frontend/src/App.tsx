import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Subscriptions } from './pages/Subscriptions';
import { Events } from './pages/Events';
import { DLQ } from './pages/DLQ';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="events" element={<Events />} />
          <Route path="dlq" element={<DLQ />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;