import PageHeader from '../components/PageHeader';
import AlertsList from '../components/AlertsList';

export default function AlertsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Watch"
        title="Alerts"
        description="Trial endings, price changes, duplicate charges. Things you'd otherwise miss."
      />
      <div className="p-8 max-w-4xl">
        <AlertsList />
      </div>
    </div>
  );
}
