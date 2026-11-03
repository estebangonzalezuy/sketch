import { useMeta } from '../lib/meta';
import { Link } from '../lib/router';

export function NotFound() {
  useMeta('Not found', 'This page is not in the index.');
  return (
    <div className="page">
      <h1 className="display page-title">Not in the index</h1>
      <p className="tagline">
        Nothing lives at this address. <Link to="/">Back to index</Link>
      </p>
    </div>
  );
}
