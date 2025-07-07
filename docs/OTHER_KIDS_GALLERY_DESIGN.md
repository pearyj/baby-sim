# Other Kids Gallery – Feature Design & Implementation Plan

_Last updated: {{DATE}}_

---

## 1  Purpose
Showcase community-generated “ending card” images to
1. inspire new visitors, encouraging them to **start a game** and stick with it until the child reaches 18, and
2. motivate finishing (or paying) by demonstrating the beautiful results waiting at the end.

## 2  User Experience Overview

| Surface | When the user sees it | Expected outcome |
|---------|-----------------------|------------------|
| **Welcome screen carousel** | Immediately on landing (below the fold and the start game button) | Visitor is intrigued by diverse, cute kids → clicks **Start**. |
| **Dedicated “Other Kids” page** | From header link or carousel “See more” | Displays **all** shared babies (no pagination initially) so visitors can freely browse → decides to play. |
| **Ending card ‘Other Kids’ grid** | After finishing a run, below their own ending cards report | If locked ➜ blurred with paywall CTA; if unlocked ➜ shows real examples → boosts conversion & retention. |

### Journey diagram (happy path)
1. Visitor lands → notices auto-rotating photos.
2. Clicks an image or `Start New Journey`.
3. Plays until 18 → sees their personalised ending.
4. Beneath, sees gallery grid and shares screenshot → more viral growth.

## 3  Functional Requirements

1. **Gallery data source** – Supabase table `ending_cards` where `share_ok = true`.
2. **Public image access** – Only rows with `share_ok=true` should have publicly fetchable images.
3. **Pagination** – _Not required initially_: dedicated page loads the full list (may switch to infinite scroll later).
4. **Carousel selection** – Shows a curated subset of **best** photos (flag `is_featured` or highest `likes`).
5. **i18n** – Heading/CTA copy in English & Chinese.
6. **Performance** – Images lazy-load, served from CDN with `max-age` 1 day.
7. **Accessibility** – Alt text defaults to child status at 18.
8. **Analytics** – Events: `gallery_view`, `carousel_impression`, `gallery_image_click`.

## 4  Technical Design

### 4.1 DB & Storage
```sql
-- migration 2024-XX-XX-other-kids-gallery.sql
alter table ending_cards add column if not exists share_ok boolean default false;
create index if not exists ending_cards_share_ok_idx on ending_cards(share_ok) where share_ok;

-- RLS (storage policy)
create policy "Public read for shared cards" on storage.objects
  for select using (bucket_id = 'ending-cards' and
                    exists (select 1 from public.ending_cards ec
                            where ec.image_path = name and ec.share_ok));
```

### 4.2 Service Layer
`src/services/galleryService.ts`
```ts
export interface GalleryItem { id: string; imageUrl: string; childStatusAt18: string }
export async function getGalleryItems(limit = 20, offset = 0): Promise<GalleryItem[]> {
  const { data, error } = await supabase
    .from('ending_cards')
    .select('id, child_status_at_18, image_path')
    .eq('share_ok', true)
    .order('created_at', { ascending: false })
    .limit(limit)
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data.map(row => ({
    id: row.id,
    childStatusAt18: row.child_status_at_18,
    imageUrl: supabase.storage.from('ending-cards').getPublicUrl(row.image_path).data.publicUrl,
  }));
}

// NEW helper for carousel
export async function getFeaturedGalleryItems(count = 12): Promise<GalleryItem[]> {
  const { data, error } = await supabase
    .from('ending_cards')
    .select('id, child_status_at_18, image_path')
    .eq('share_ok', true)
    .eq('is_featured', true)
    .order('featured_rank', { ascending: true })
    .limit(count);
  if (error) throw error;
  return data.map(row => ({
    id: row.id,
    childStatusAt18: row.child_status_at_18,
    imageUrl: supabase.storage.from('ending-cards').getPublicUrl(row.image_path).data.publicUrl,
  }));
}
```

### 4.3 UI Components
- **`<GalleryImage />`** – responsive `<img>` with lazy loading & rounded corners.
- **`<GalleryCarousel />`** – fade/slide carousel, pause on hover.
- **`<GalleryGrid />`** – masonry grid with infinite scroll.
- **`<OtherKidsSection />`** – wrapper used on ending card page; applies blur & paywall overlay when locked.

### 4.4 Pages & Injection Points
- `WelcomeScreen.tsx` – insert `<WelcomeGallery />` above closing container.
- `GalleryPage.tsx` – new route `/gallery`, header link.
- `App.tsx` ending flow – render `<OtherKidsSection />` below `<ShareableEndingCard />`.

## 5  Slice-by-Slice Implementation Plan

> Each slice builds on the previous; app compiles & tests pass after every step.

### Phase 0 – Groundwork (no UI)
1. **DB migration & RLS policy** (unit test with Supabase stub).
2. **`galleryService`** with jest tests.

### Phase 1 – Reusable UI primitives
3. `<GalleryImage />` component + snapshot test.
4. `<GalleryCarousel />` with fake-timer test.
5. Loading & error skeletons.

### Phase 2 – Welcome screen
6. `<WelcomeGallery />` integrates carousel, uses `getGalleryItems(10)`.
7. i18n strings added; RTL test ensures heading is translated.

### Phase 3 – Dedicated page
8. `GalleryPage.tsx` grid with infinite scroll; Cypress scroll test.
9. Helmet tags for SEO/OpenGraph.

### Phase 4 – Ending card upsell
10. `<OtherKidsSection />` grid (6 thumbnails); blurred + CTA when paywall.
11. Insert into ending flow; manual QA.

### Phase 5 – Perf & polish
12. Ensure CDN headers; log via fetch.
13. Analytics events wired.

### Phase 6 – E2E coverage
14. Cypress journeys for carousel, gallery page, paywall interaction.

## 6  Design Considerations
* **Motivation mechanics** – Carousel purposely shows *older* children (ages 15-18). Visitor realises they must play long-term to reach similar images.
* **Variety** – Random shuffle per page load.
* **Safety** – No personally identifiable text; alt text limited to outcome summary snippet.
* **Fallback** – If API fails, gallery quietly disappears (never blocks main UX).

## 7  Copy / Translations
| Key | English | 简体中文 |
|-----|---------|----------|
| gallery.otherKids | Other Kids | 其他孩子 |
| gallery.seeMore | See more » | 查看更多 » |
| gallery.unlock | Unlock your own ending image! | 解锁你的结局图片！ |

## 8  Analytics & Success Metrics
* **CTR from carousel to start game** > 8 %.
* **Gallery page to game start** > 5 %.
* **Paywall conversion uplift** measured A/B vs control.

---

_Contact:_ `#baby-sim-frontend` Slack channel 