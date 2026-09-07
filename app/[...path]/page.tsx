import Campus from '@/components/campus';
import { notFound } from 'next/navigation';
export default async function Page({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  if (
    ![
      'assignments',
      'teachers',
      'community',
      'notices',
      'admin',
      'account',
    ].includes(path[0]) ||
    path.length > 2
  )
    notFound();
  return <Campus />;
}
