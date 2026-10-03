import BroadcastStudio from "@/components/broadcast-studio";
export const metadata = {
  title: "ACP — Broadcast studio",
  robots: { index: false, follow: false },
};
export default async function StudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BroadcastStudio id={id} />;
}
