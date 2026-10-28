# Skillora marketplace redesign

## Brief and audit, 29 October 2026

Redesign the existing paid, multi-instructor marketplace. Reference: https://www.udemy.com/ for search-first navigation, compact promotional banner, category discovery, course cards and purchase hierarchy. Keep Skillora branding and original content. Retain route slugs, navigation labels, form contracts, authorization, query parameters and backend behavior.

Baseline: Next.js 16 / React 19, Tailwind 4, owned shadcn Radix components, Geist and Lucide. Existing teal accent and book logo remain. Current UI uses dark mesh heroes, translucent panels, excessive shadows, small 9-12px metadata and developer-oriented marketing copy. Catalog filters, pagination, course curriculum, authenticated cart and role navigation already work and must remain available. SEO metadata and canonical page routes stay intact. Baseline screenshot: artifacts/ui-before-20261029.png.

## Design decisions

- DESIGN_VARIANCE: 5. MOTION_INTENSITY: 3. VISUAL_DENSITY: 6.
- Content-first commerce, light and system-aware dark modes. Calm neutral surfaces and one teal brand accent. Amber reserved for semantic rating stars.
- Geist sans throughout. Display 40-48px desktop / 32px mobile; section title 26-30px; body 16px; metadata 13-14px. Avoid tiny uppercase labels.
- Layout max width 1400px, gutters 16/24/40px, 4/8px spacing scale. Header 72px, one line on desktop; search expands into available space. At tablet widths collapse lower-priority navigation into the drawer/account menu.
- Radius: buttons/inputs 6px, cards 8px, promotional banner 12px, search pill only. Avoid glass, glowing gradients and floating-card hover motion.
- Catalog uses a compact image banner, genuine category buttons, visible search/filters and a responsive course grid. Repeated course cards are functional inventory, not decorative feature cards.
- Detail page: clear course introduction, outcomes and curriculum, sticky purchase panel on desktop, accessible fixed purchase action on mobile. Keep existing action labels and all enrollment/provider gates.
- Workspaces use a solid sidebar, quieter page chrome and readable density. Apply design-taste only to marketing/catalog surfaces; ui-ux-pro-max and shadcn govern product workflows.
- Interactive controls retain keyboard/focus semantics, touch targets, loading/error/empty states. Motion is limited to hover/focus/press feedback and respects reduced motion.
- No invented learner counts, testimonials, employer logos, discounts, partner badges or business guarantees.

## Sources and assets

Udemy homepage inspected on 29 October 2026; no Udemy source, logos, testimonials or imagery copied. Official shadcn Sheet docs: https://ui.shadcn.com/docs/components/radix/sheet. Existing shadcn primitives are reused rather than replaced.

ui-ux-pro-max design-system searches for course discovery returned generic marketing presets that did not match the marketplace. They were not persisted or adopted. The system above follows the actual reference, existing Skillora brand and skill accessibility guidance.

Original hero created with the built-in imagegen tool, saved at skillora_web/public/images/learning-hero-v2.png. Prompt: a natural editorial photograph of a Vietnamese creative professional wearing teal, learning with a laptop and notebook at a light desk against a mint wall; landscape, daylight, no text, logos or UI. This is decorative brand photography, not a testimonial or instructor identity.

## Verification

Check lint, typecheck, build, existing proxy/mock/live gates. Visually inspect catalog, course detail, authentication, learner and instructor/admin workspaces at 375, 768, 1024 and 1440px; check dark mode, keyboard menus, category/filter search, no horizontal overflow, form/button contrast and reduced motion. Run Lighthouse and record measured results separately; do not claim real-user Core Web Vitals from a local lab run.
