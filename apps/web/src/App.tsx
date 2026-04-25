import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import OverviewPage from './pages/Overview';
import SubscriptionsPage from './pages/Subscriptions';
import ReceiptsPage from './pages/Receipts';
import AlertsPage from './pages/Alerts';
import SettingsPage from './pages/Settings';
import NotFoundPage from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/receipts" element={<ReceiptsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
