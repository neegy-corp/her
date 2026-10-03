import TokenDirectory from "@/components/token-directory";
export const metadata = {
  title: "Token directory | ACP",
  description:
    "Browse confirmed tokens created with Artificial Character Protocol and open their pump.fun coin pages.",
};
export default function Page() {
  return <TokenDirectory />;
}
