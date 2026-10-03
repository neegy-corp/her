import { notFound } from "next/navigation";
import Launchpad from "@/components/launchpad";
import { creatorSteps, type CreatorStep } from "@/lib/creator-navigation";

export const metadata = { title: "Character workspace | ACP", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string; step: string }> }) {
  const { id, step } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !creatorSteps.includes(step as CreatorStep)) notFound();
  return <Launchpad key={`${id}:${step}`} characterId={id} initialStep={step as CreatorStep} />;
}
