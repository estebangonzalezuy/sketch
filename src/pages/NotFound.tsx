import { PixelHeadline } from '../components/PixelHeadline';
import { useMeta } from '../lib/meta';
import { Link } from '../lib/router';

export function NotFound() {
  useMeta('Not found', 'This page is not in the index.');
  return (
    <div className="page">
      <PixelHeadline text="Not in the index" className="title-lg" />
      <p className="tagline">
        Nothing lives at this address. <Link to="/">Back to index</Link>
      </p>
    </div>
  );
}
