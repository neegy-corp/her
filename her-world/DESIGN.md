---
name: "ACP Creator Studio"
description: "A charcoal creator studio with pearl imagery and quiet, precise controls."
colors:
  action-white: "#f4f4f5"
  action-hover: "#d4d4d8"
  action-ink: "#18181b"
  charcoal-canvas: "#111113"
  charcoal-card: "#1b1b1f"
  charcoal-popover: "#202024"
  charcoal-secondary: "#27272b"
  select-focus: "#303036"
  select-focus-ink: "#fafafa"
  selected-mode: "#424249"
  neutral-muted: "#a1a1aa"
  supporting-ink: "#bdbdc2"
  panel-line: "#323237"
  field-line: "#3f3f46"
  periwinkle: "#b9b4f5"
  selection-ground: "#5b5486"
  selection-ink: "#ffffff"
  scrollbar-thumb: "#52525b"
  checkbox-line: "#71717a"
  switch-off: "#48484f"
  step-ink: "#222029"
  error-ink: "#e99b9b"
  dialog-backdrop: "rgba(0,0,0,.8)"
typography:
  display:
    fontFamily: '"ACP Grotesk", sans-serif'
    fontSize: "clamp(56px, 6vw, 78px)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.038em"
  section-headline:
    fontFamily: '"ACP Grotesk", sans-serif'
    fontSize: "clamp(34px, 3.6vw, 46px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  directory-headline:
    fontFamily: '"ACP Grotesk", sans-serif'
    fontSize: "42px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  studio-headline:
    fontFamily: '"ACP Grotesk", sans-serif'
    fontSize: "38px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: '"ACP Grotesk", sans-serif'
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"ACP Grotesk", sans-serif'
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  workspace-title:
    fontFamily: '"ACP Grotesk", sans-serif'
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  identity-title:
    fontFamily: '"ACP Grotesk", sans-serif'
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: '"ACP Grotesk", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  lead:
    fontFamily: '"ACP Grotesk", sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: '"ACP Grotesk", sans-serif'
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  supporting:
    fontFamily: '"ACP Grotesk", sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  checkbox: "4px"
  status: "6px"
  control: "8px"
  identity: "10px"
  card: "12px"
  workspace: "14px"
spacing:
  icon-gap: "8px"
  action-gap: "12px"
  compact-inset: "16px"
  scene-inset: "18px"
  builder-mobile-gutter: "20px"
  brand-mobile-gutter: "22px"
  panel-inset: "24px"
  form-block: "28px"
  form-inline: "30px"
  page-gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.action-white}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.action-white}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-muted}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  text-field:
    backgroundColor: "{colors.charcoal-canvas}"
    textColor: "{colors.action-white}"
    rounded: "{rounded.control}"
    padding: "11px 13px"
  select-trigger:
    backgroundColor: "{colors.charcoal-canvas}"
    textColor: "{colors.action-white}"
    rounded: "{rounded.control}"
    height: "42px"
    padding: "8px 12px"
  device-status:
    backgroundColor: "{colors.charcoal-secondary}"
    textColor: "{colors.neutral-muted}"
    rounded: "{rounded.status}"
    padding: "4px 9px"
  scene-mode:
    backgroundColor: "{colors.charcoal-secondary}"
    textColor: "{colors.neutral-muted}"
    rounded: "{rounded.control}"
    padding: "7px 10px"
  scene-mode-selected:
    backgroundColor: "{colors.selected-mode}"
    textColor: "{colors.action-white}"
  navigation:
    textColor: "{colors.neutral-muted}"
    padding: "10px 0"
  creator-step:
    textColor: "{colors.neutral-muted}"
    padding: "12px 0"
  studio-card:
    backgroundColor: "{colors.charcoal-card}"
    textColor: "{colors.action-white}"
    rounded: "{rounded.card}"
    padding: "28px"
  workspace:
    backgroundColor: "{colors.charcoal-card}"
    textColor: "{colors.action-white}"
    rounded: "{rounded.workspace}"
---

# Design System: ACP Creator Studio

## Overview

**Creative North Star: "The AI Creator Studio"**

ACP pairs a calm charcoal workspace with a selective family of pearl and silver studio images. White actions, quiet periwinkle selection and aligned shadcn controls keep human creative control clear. This system covers the ACP homepage, launchpad, creator dashboard, token directory and browser broadcast studio family. The legacy collective entry redirects to Discover; navigation, wallet copy, error states and operations use ACP.

The imagery gives the brand physical presence while scripts, identity fields, settings and next actions remain semantic, editable UI. Sculptures are abstract brand material or blank-preview placeholders. Character images belong to the creator's references or generated work, and the four setting photographs depict unoccupied places.

**Key Characteristics:**

- Charcoal layers and fine strokes define working surfaces.
- White actions and restrained periwinkle selection establish hierarchy.
- Pearl sculpture is placed selectively; controls remain quiet.
- Locally hosted geometric typography uses distinct display and tool scales.
- Four visible creator steps, one Continue action and explicit local save state.

### Authority and evidence

This refresh derives from app/page.tsx, app/layout.tsx, app/globals.css, shared navigation, the editable workspace, launchpad, directory and dashboard components, and the final overrides in components/studio-theme.css. The emitted five-block direction contract carries seed 617990bd. PRODUCT.md and .impeccable/surfaces/launchpad.md confirm the simpler shadcn studio and its imagery amplification. There is no approved comp or QUALITY BAR board.

The brand-v2 evidence comprises 14 supplied captures in .impeccable/review/brand-v2/: hero-desktop, home-desktop, discover-desktop, studio-desktop, character-desktop and setting-desktop at requested 1280×900; home-user-688 and builder-user-688 at requested 688×720; home-mobile, discover-mobile, studio-mobile, character-mobile, show-mobile and launch-mobile at requested 390×844. A subsequent user screenshot exposed the hero raster's rectangular edges at a wider viewport. The focused boundary correction is captured in .impeccable/review/hero-blend/: wide-1754, desktop-1280, user-688 and mobile-390. These full-page captures show the actual feathered hero at their named widths. Full-page heights and scrollbar-adjusted widths differ from viewport requests. Earlier review outcomes describe their earlier evidence, rather than overriding this later user report.

The latest decorative-artwork and branding follow-up has ten full-page captures in .impeccable/review/art-blend/: homepage, Discover, My studio and blank builder at 1280px and 390px, plus homepage and Discover at 688px. The second bounded capture batch confirms the compact Discover alignment and broader ground fades. The legacy collective entry was verified to redirect to Discover. Visible public-page and host branding checks found no retired brand mentions. The production build and all 49 existing tests pass. The earlier detector reported 52 advisory findings (9 color, 41 font, 2 radius) and zero hard findings; it was not rerun for these scoped corrections. Supporting ink, selection, scrollbar, control-state and identity-corner values below reflect intentional shipped styling. Paid generation, cloud ownership, wallet transactions and public playback were not verified in this local review; unavailable services retain explicit error or disabled states.

## Colors

Near-black charcoal and cool white carry the hierarchy. Periwinkle marks interaction and brief emphasis; brighter supporting ink keeps copy legible over the dark photographic grounds. Exact primitives live in the frontmatter.

### Primary

- **Action White:** main content ink and primary action fill, bound to the shadcn foreground and primary variables.
- **Action Hover / Action Ink:** gentle hover darkening and dark labels on white actions.
- **Periwinkle:** selected step circles and underlines, selected setting borders, focus, caret, enabled continuous-playback switch and brief hero emphasis.

### Neutral

- **Charcoal Canvas / Card / Popover / Secondary:** progressively lighter page, editor, portal-menu and pressed-control surfaces.
- **Select Focus / Select Focus Ink:** highlighted shadcn options and their ink.
- **Selected Mode:** the slightly lighter pressed scene-mode control.
- **Neutral Muted:** ordinary supporting copy, inactive navigation and metadata.
- **Supporting Ink:** hero, discovery and art-heading copy, plus the blank-preview caption.
- **Panel Line / Field Line / Checkbox Line:** panel separation, stronger fields/outline actions and compact checkbox strokes.
- **Selection Ground / Selection Ink / Scrollbar Thumb:** intentional browser-selection and scrollbar treatment scoped to ACP.
- **Switch Off / Step Ink:** neutral inactive switch and dark ink within the filled selected step.
- **Error Ink:** explicit failure text.
- **Dialog Backdrop:** the existing dark review overlay.

**The Quiet Accent Rule.** Use periwinkle to identify selection, focus and brief emphasis. Keep primary actions white and ordinary explanation neutral.

## Typography

**Display Font:** ACP Grotesk (with sans-serif fallback)

**Body Font:** ACP Grotesk (with sans-serif fallback)

**Character:** The self-hosted Space Grotesk variable font is exposed as ACP Grotesk, with weights 300–700 and its bundled OFL license. Firm display lettering shares a family with compact controls. Sentence case is the default; existing transaction identifiers retain monospace.

### Hierarchy

- **Display:** the large two-line homepage promise. At 780px and below it uses clamp(46px, 8.5vw, 64px), line-height 1.06 and tracking -0.035em.
- **Section Headline:** homepage workspace introduction and discovery feature; each becomes 34px in the stacked layout.
- **Directory / Studio Headline:** Discover uses its directory scale, then 34px below 780px. My studio uses its smaller studio scale, then 30px below 780px and 27px below 440px.
- **Headline:** builder title, reduced to 25px below 780px.
- **Title:** form and scene headings. The editable workspace heading and desktop character-preview heading retain the workspace-title scale; the preview heading becomes 20px when stacked.
- **Identity Title:** saved-character card titles; the local-draft section title is 26px.
- **Body / Lead:** operational copy and roomier hero explanation. Hero lead becomes 15px when stacked, with a 375px desktop measure and 355px stacked maximum.
- **Label / Supporting:** persistent field labels and quieter notes. Controls use 13px / 1.4; compact status and metadata use 10–11px.

**The One Family Rule.** Use ACP Grotesk for headings, prose and controls. Establish hierarchy with size, weight and spacing, while preserving monospace for existing transaction data.

**The Scoped Heading Rule.** Apply the large homepage section scale only to its copy column. Keep the editable workspace heading at 24px; nested tool headings must not inherit display styling.

## Layout

The current homepage introduces the promise and pearl ribbon, follows with a real editable workspace, then a quieter discovery feature. The hero caps at 1440px with a 640px desktop minimum height; its semantic inner content caps at 1240px with 112px top, 40px side and 95px bottom padding. Copy occupies the left with the sculpture contained on the right. The workspace uses a .8fr / 1.2fr grid and an 11% gap inside a 1240px container, with 100px top and 110px bottom spacing. Its panel keeps a 24px horizontal inset. The discovery feature caps at 1160px, has a 370px minimum height and preserves left-side copy beside the image.

The hero image box follows the raster's own aspect ratio, right aligned and vertically centered, with a 1137px maximum width (1084px below 1000px). Two intersecting alpha ramps feather only its outer background into the page: horizontal opacity is full from 16–94%, vertical from 4–84%. This keeps the metal silhouette and contact shadow clear. In the stacked cover crop, the horizontal plateau is 10–98%; the bottom fade reaches transparency 30px before the image ends, compensating for its existing negative bottom offset. Apply the fade to the actual image box, rather than a wider letterboxed container, so a raster boundary cannot remain visible inside the mask.

The same compositing principle applies to all decorative discovery and studio artwork. Landscape discovery art is right aligned in a native aspect-ratio box, capped at 658px on the homepage and 498px in the directory header. Its horizontal plateau spans 20–96% and its vertical plateau 10–84%. On mobile, the homepage cap becomes 444px (373px below 440px), the directory art cap becomes 391px, and adjacent discovery copy uses the page background. Square studio and blank-preview artwork keep a 10–96% horizontal and 4–82% vertical plateau, fading into charcoal. The smallest studio companion remains square at 88px. Functional profile images, actual generated output and setting choices stay clearly framed.

Builder and directory content use 1240px containers and 40px desktop gutters. The builder pairs a flexible editor with a 310px rail; single-column forms have 28px vertical and 30px horizontal padding. Settings retain two equal columns, including mobile, with landscape thumbnails. Dashboard cards use two columns; directory cards use three.

At 1000px, the builder rail narrows to 255px, builder gutters become 26px and launch ticker/artwork stacks. Brand gutters become 30px; the hero minimum becomes 610px. At 780px, header links move into a full-width second row, the builder and homepage workspace stack, builder gutters become 20px and brand gutters 22px. The hero places its image beneath copy in a 390px-high cover frame, favoring 85% horizontal position, with 330px reserved below the copy. Discovery places its feathered image above copy on the same charcoal ground. Discover reserves a 220px image region below its text. My studio keeps a small 120px companion beside its heading.

At 440px, hero artwork is 335px high with 285px reserved below the copy; discovery artwork keeps its native ratio within a 373px maximum width. My studio uses an 88px square companion. Forms use 24px by 18px insets. The stacked builder preview pairs a 110px image with details. Numbered builder tabs remain visible in four equal columns: inherited 700px rules stack numbers above labels, while scoped 440px rules refine padding and type. Scene options use two columns at 700px. Dashboard cards stack at 700px; directory grids reduce at 800px and 520px; broadcast layout stacks at 800px.

Action groups wrap, SVG icons do not shrink and fields have flexible minimum widths. Do not substitute the earlier side-by-side editable-hero topology for the current homepage.

## Elevation & Depth

Working surfaces use tonal depth and fine strokes, with decorative shadows removed from scoped buttons and fields. Physical highlights and soft contact shadows belong to the generated image material. Portal-mounted shadcn Select retains its library menu shadow; review dialogs retain the dark backdrop and inherited backdrop blur. These overlay behaviors do not establish a shadow style for ordinary cards.

**The Tonal Depth Rule.** Use tone and fine borders for stationary work surfaces. Reserve the existing library elevation for option menus and the physical shading for raster imagery.

Preview switching uses one 0.2-second clip-path reveal from a 5% bottom inset to fully visible, with cubic-bezier(.16,1,.3,1). Existing color feedback and shadcn state transitions remain subtle; primary hover does not translate the action. Progress spinners use their existing 1.2-second rotation. Scoped reduced-motion rules remove transitions and animations.

## Shapes

Control corners frame fields and actions; card corners frame settings, scene containers and previews; workspace corners frame the editor, homepage scratchpad, discovery feature and review dialogs. Device status uses smaller corners. Saved-character identity images and monograms use the distinct identity radius. Solid fine strokes separate ordinary surfaces; dashed strokes identify uploads and Add scene. Step numbers are circles, character/PFP previews are square and setting previews are landscape.

The generated white single-storey lowercase a has a doorway-shaped counter and a transparent square canvas. Preserve it with contain fitting: 32px in shared navigation and 25px in the footer. It also supplies the favicon. The rejected angular mark is retired. The blank character preview uses the studio sculpture, not a faded logo.

## Components

### Buttons

Quiet shadcn actions emphasize the current task. Standard actions have a 40px minimum height, small actions 36px and icon actions a 40px square target. Primary uses white fill, dark ink and an 8px icon gap. The hero raises its actions to a 44px minimum with 12px by 19px padding; below 440px those use 12px type and 11px by 14px padding. One footer Continue advances the builder.

Outline actions use a transparent ground and field stroke. Ghost utilities use muted ink; tonal hover makes both quieter variants legible. Primary hover darkens without movement. ACP keyboard focus uses a 2px periwinkle outline offset 3px, with library rings where retained. Scoped buttons dim to 45% when disabled, alongside their prerequisite explanation.

### Inputs / Fields

Persistent labels sit above dark fields with the field stroke, control corners and a 42px minimum height. Builder textareas keep fixed field sizing, vertical resize and a 105px minimum; the homepage script uses 120px. Placeholders supply examples and errors include explicit text.

Voice, length and chat-pause controls use the installed shadcn Select/Radix portal. Voice triggers are 42px high; clip triggers are 40px. The ACP popover carries the same family, popover surface, panel stroke and control corners outside the wrapper; option rows have a 36px minimum. Existing focus and invalid-state rings accompany the ACP outline where applicable.

### Navigation

Shared navigation uses the generated mark, ACP wordmark, three sentence-case links and one action. Desktop header height is 76px. Active links brighten and gain a periwinkle underline; compact layouts keep all three links in a second row. Builder navigation exposes **Character, Voice & setting, Show, Launch** with bright active text, a periwinkle bottom stroke and filled numbered circle. Legacy scene/artwork URLs remain compatible with the visible four-step path.

### Chips and Status

Scene mode is a compact pressed-state button group with secondary-tone rest and a lighter selected ground. Device save is a quiet badge: **Saving locally…** during the write delay and **Saved locally** after browser storage. Separate Sync saves to the wallet-backed service and reports **Saved to your wallet.** Retain visible distinctions between local drafts, wallet drafts and confirmed launches.

### Cards / Containers

The workspace combines a card-tone editor and darker preview rail inside clipped workspace corners. Scene containers use canvas tone, panel stroke, card corners and an 18px inset. Saved-character cards use card tone, panel stroke and a 28px inset; their 64px identity image/monogram uses the identity corner radius and compact title scale. A setting button clips a 16:9 photo above a label row; selection adds a periwinkle border, matching label and SVG checkmark.

### Editable Workspace and Disclosures

The homepage workspace sits below the image-led introduction. Identity, Show and Launch are pressed-state preview buttons, initially showing Show. **Open in studio** writes a real device draft and carries entered identity/script text into the creator route; storage failure displays an error. Its title remains at the tool scale. This preview is distinct from builder navigation.

Optional voice information, custom setting text, references, rendering details, stream options and talking-face controls use native details/summary disclosures. References open when saved photos are present. Keep the disclosure cue and keyboard focus.

### Brand Imagery and Workflow State

The eight shipping rasters are recorded in both provenance manifests. **.impeccable/assets/acp-v2/manifest.json** owns the new 768×768 transparent logo, 1672×941 hero and discovery images, and 1024×1024 studio companion. **.impeccable/assets/acp/manifest.json** owns the four 1672×941 setting photographs; its older angular logo is superseded. All eight were generated with built-in image_gen, with exact prompts and history in the manifests, PNG prompt metadata or WebP JSON sidecars, and no missing shipping provenance.

Hero is reserved for the homepage introduction. Discovery supports the homepage feature and Discover header. Studio supplies the small My studio header and the empty builder preview. Wide compositions preserve their left negative space with right-side focal objects; mobile hero uses the explicit cover crop described above. The blank preview uses the actual studio image with semantic **Your character appears here** copy, hidden in the compact preview. A real character reference replaces that placeholder. Sculpture never proves character generation or a live service. All text, actions, borders, corners and responsive composition remain code-owned.

**After hours, City loft, Corner café and Night shift** use centered cover thumbnails and select their actual scene prompt into the draft background. They are unoccupied photographic guides, not finished character output. Coin artwork is a square PFP only; explicit reuse of a character image is available, while the retained banner storage field adds no banner control. Continuous preparation has a fixed ten-minute target and no buffer selector or terminology in the UI.

Preserve image-rights, provider, storage and wallet-ownership gates, credit disclosure and review of generated scripts/clips. Prepared transactions, wallet submission and confirmed launches stay distinct. Coin creation and supervised browser broadcasting remain separately named; accepted transport does not establish verified public playback.

## Do's and Don'ts

### Do:

- **Do** use charcoal surfaces, white actions and quiet periwinkle selection across the scoped ACP family.
- **Do** preserve the large brand-heading scale and the smaller 24px editable-workspace title as separate roles.
- **Do** place the pearl imagery selectively and keep all text and actions semantic and code-owned.
- **Do** keep four creator steps visible and retain one Continue action with quieter footer utilities.
- **Do** distinguish device saving, wallet Sync, provider readiness, prepared transactions and confirmed launches.
- **Do** preserve the generated mark, companion imagery and unoccupied settings with their recorded crops and provenance.
- **Do** retain native disclosures, visible keyboard focus, reduced motion and explicit paid/wallet/broadcast controls.

### Don't:

- **Don't** restore the rejected signal-green palette or angular mark, or add decorative human portraits to ACP.
- **Don't** let section display styles enlarge nested editor headings.
- **Don't** present abstract sculpture or setting guides as generated character output.
- **Don't** add decorative kickers, eyebrows, glyph action icons or inherited hard offset shadows.
- **Don't** add coin-banner controls or expose the fixed ten-minute preparation target as a buffer selector.
- **Don't** treat local saves, queued renders or accepted transport as wallet saves, finished output or verified public playback.
- **Don't** reintroduce the retired collective branding or footer link.

Not canonized: inherited legacy/light-theme rules, hidden kicker/storyboard markup, unused concept-person cards and surviving legacy glyph arrows do not define future ACP surfaces. Historical simplified-pass captures and verdict wording are superseded by the brand-v2 evidence and current source.
