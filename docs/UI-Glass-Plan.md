# Warm Liquid-Glass UI Plan

Status: In progress

## Goals
- Warmer, modern “liquid glass” (glassmorphism) look
- Consistent tokens for color, blur, shadow, radii, motion
- Reusable MUI variants for glass surfaces and soft buttons
- Accessibility fallbacks and good readability

## Phases
1. Define warm glassmorphic tokens — Completed
2. Implement MUI glass variants — Completed (Card/Paper/Button)
3. Apply glass to key surfaces — In progress
4. Introduce gradient background — Completed
5. Refine type, spacing, radii — Pending
6. Add warm dark mode — Pending
7. Document usage and rollout — Pending

## Details
- Tokens: glass background alpha, border, inset highlight, blur sizes, surface radii, motion durations
- Variants: `Card/Paper variant="glass"`, `Button variant="soft"|"tonal"`
- Key surfaces: AppBar (translucent), Question/Feedback cards, Timeline cards, Dialogs, Menus
- Canvas: warm gradient background with subtle depth; components become transparent to show canvas
- Accessibility: fallbacks when backdrop-filter unsupported or user prefers reduced transparency

## Changelog
- [x] Add theme tokens and component variants
- [x] Convert Header to translucent gradient with blur
- [x] Apply glass variant to Question/Feedback/Timeline cards
- [x] Add warm gradient background canvas
- [x] Validate build (npm run build)
- [ ] Visual sanity check across key screens
