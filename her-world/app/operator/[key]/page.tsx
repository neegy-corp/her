import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setting } from '@/lib/server';
import { validOperatorKey } from '@/lib/operator-auth';
import OperatorPanel from '@/components/operator-panel';
import './operator.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'HER Operations', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function OperatorPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (setting('HER_OPERATOR_ENABLED') !== 'true' || !validOperatorKey(key, setting('HER_OPERATOR_PATH_KEY'))) notFound();
  return <OperatorPanel />;
}
