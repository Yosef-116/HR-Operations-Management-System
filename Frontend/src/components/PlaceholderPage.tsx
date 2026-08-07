import { useParams } from 'react-router-dom';

export function PlaceholderPage() {
  const { module } = useParams();
  return <section className="empty-state"><h2>{module?.replaceAll('-', ' ')}</h2><p>This module is still served by the legacy dashboard while its React feature is migrated.</p></section>;
}
