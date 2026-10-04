import GenerationCreditsPage from "@/components/generation-credits-page";
import { notFound } from "next/navigation";
export const metadata = { title: "Generation credits | ACP", robots: { index: false, follow: false } };
export default async function Page({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) notFound();
  return <GenerationCreditsPage id={id}/>;
}
