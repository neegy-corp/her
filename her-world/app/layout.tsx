import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACP — Artificial Character Protocol",
  description:
    "Build your next main character. Create an AI personality, direct their video show, design their coin artwork and prepare a pump.fun launch on ACP.",
  icons: {
    icon: "/images/acp-v2/logo.png",
    shortcut: "/images/acp-v2/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <template id="acp-design-contract" dangerouslySetInnerHTML={{ __html: `<!--
THESIS: Human creative control gives an AI character its identity and next act.
OWN-WORLD: Charcoal shadcn studio, white actions, periwinkle selection, refined generated mark and pearl sculptural imagery; four photographic settings.
STORY: Meet the concept, start a local draft, direct a show, review a coin launch and prepare broadcasting.
FIRST VIEWPORT: Large two-line promise and actions left, a dimensional ribbon hero right. Editable workspace follows, then a quieter discovery image. Companion visuals mark Discover and My studio; editing stays clear.
FORM: User-pinned shadcn creator studio with requested imagery amplification; code-first; existing concept seed 617990bd. One clip-path reveal on preview switching.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->` }} />
        {children}
      </body>
    </html>
  );
}
