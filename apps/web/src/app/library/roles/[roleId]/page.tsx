import { RoleDetailClient } from './RoleDetailClient';

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const { roleId } = await params;
  return <RoleDetailClient roleId={roleId} />;
}
