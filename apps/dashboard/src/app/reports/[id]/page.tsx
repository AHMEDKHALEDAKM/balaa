import PublicReportView from '../../../components/PublicReportView';
import { seed } from '../../../server/state';

// The server build renders any report on demand. The GitHub Pages build can only
// pre-build pages, so it includes the demo reports; its share links use /?report= instead.
export function generateStaticParams() {
  return process.env.NEXT_PUBLIC_STATIC_DEMO === '1'
    ? seed().reports.map((report) => ({ id: report.publicId }))
    : [];
}

export default async function PublicReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicReportView id={id} />;
}
