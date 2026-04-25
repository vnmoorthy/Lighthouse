import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center lh-grid-bg">
      <div className="text-center">
        <div className="text-6xl mb-3">404</div>
        <div className="text-sm text-lh-mute">That page isn't here.</div>
        <Link to="/" className="lh-btn mt-4 inline-flex">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
