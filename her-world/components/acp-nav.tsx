import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./studio-theme.css";
type NavProps = { active?: "create" | "tokens" | "developer"; action?: ReactNode };
export function AcpNav({ active, action }: NavProps) {return <><a className="acp-skip-link" href="#main-content">Skip to content</a><header className="lp-header"><Link className="lp-logo" href="/" aria-label="ACP home"><img className="acp-logo-image" src="/images/acp-v2/logo.png" alt="" /><span className="acp-logo-type">ACP</span></Link><nav aria-label="Main navigation"><Link href="/create" aria-current={active === "create" ? "page" : undefined}>Create</Link><Link href="/tokens" aria-current={active === "tokens" ? "page" : undefined}>Discover</Link><Link href="/developer" aria-current={active === "developer" ? "page" : undefined}>My studio</Link></nav>{action || <Button asChild><Link href="/create">Create character <ArrowRight size={16} /></Link></Button>}</header><span id="main-content" tabIndex={-1} /></>;}
export function AcpFooter(){return <footer className="lp-footer"><Link className="acp-footer-brand" href="/"><img src="/images/acp-v2/logo.png" alt="" width={25} height={25} />ACP</Link><div><Link href="/developer">My studio</Link><Link href="/tokens">Discover</Link></div><span>Artificial Character Protocol</span></footer>;}
