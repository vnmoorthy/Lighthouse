import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import CommandPalette from './components/CommandPalette';
import OnboardingWizard from './components/OnboardingWizard';
import OverviewPage from './pages/Overview';
import SubscriptionsPage from './pages/Subscriptions';
import ReceiptsPage from './pages/Receipts';
import AlertsPage from './pages/Alerts';
import SettingsPage from './pages/Settings';
import MerchantPage from './pages/Merchant';
import MerchantsPage from './pages/Merchants';
import YearSummaryPage from './pages/YearSummary';
import ComparePage from './pages/Compare';
import PrivacyPage from './pages/Privacy';
import NotFoundPage from './pages/NotFound';

export default function App() {
  return (
    <>
      <CommandPalette />
      <OnboardingWizard />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/receipts" element={<ReceiptsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/merchants" element={<MerchantsPage />} />
          <Route path="/merchants/:id" element={<MerchantPage />} />
          <Route path="/year/:year" element={<YearSummaryPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
