# DocAI — Claude Design Prompt

Paste the prompt below into Claude Artifacts, v0.dev, Lovable, or any AI design tool to generate visual mockups.

---

Design a financial document extraction web app called **DocAI**. It is a single-page app used by bank operations teams to upload financial PDFs and extract structured data. Style it using the **Apple liquid glass design language** — frosted glass panels, translucent surfaces, `backdrop-filter: blur`, soft ambient gradients, SF Pro system font, pill-shaped buttons with glass fills, and smooth spring transitions.

---

**Page layout (single page, scrolls vertically):**

Top: App name "DocAI" in large, light-weight SF Pro. Below it: a short tagline — "Extract structured data from financial documents."

---

**Section 1 — Drop Zone**

A large glass card (frosted white, blurred background) centered on the page. Inside:
- A dashed inner border with rounded corners
- Upload cloud icon (SF Symbols style, thin stroke)
- Primary text: "Drop files here or click to browse"
- Secondary text (muted): "PDF, JPG, PNG · Max 50 MB each"
- When files are staged (not yet uploaded): show a pill list of staged filenames below the drop target, each with an ✕ remove button
- An "Upload X files" CTA button (glass pill, blue tint) appears below the staged list
- The entire card has a subtle glow/shadow that deepens on drag-hover

States to show: (1) empty/idle, (2) drag hover — card brightens, dashed border pulses blue, (3) files staged — filename pills visible, upload button active

---

**Section 2 — Jobs Table**

Below the drop zone: a glass table card. Header row: light frosted. Alternating rows: very subtle stripe.

Columns (in order):
1. **Checkbox** — square checkbox for row selection
2. **File** — filename in monospace, truncated with ellipsis
3. **Status** — pill badge: gray "Queued", blue pulsing "Running" (with animated dot), green "Done", red "Failed"
4. **Metadata** — small text, muted: "Jones Clothing Store · Balance Sheet · Dec 2019" — empty dash while processing
5. **Accuracy** — thumbs up / thumbs down icon pair, one activates on click (green thumbs up or red thumbs down). Greyed out if not Done.
6. **View** — ghost button "View →" that opens a modal. Disabled (greyed) unless Done.
7. **Download** — primary glass pill button "↓ JSON" with a small chevron (▾) that opens a micro-dropdown: "Download JSON" / "Download CSV"
8. **Actions ⋮** — icon button that opens a dropdown: Download JSON, Download CSV, Reprocess, Remove from list

When 1+ rows are selected via checkbox:
- A **bulk action bar** slides down from the top of the table (frosted dark glass strip)
- Bulk bar shows: "3 selected" + buttons: "↓ Download ZIP", "↓ Merged CSV", "↺ Reprocess", "✕ Clear"

Show one table with 4 rows in different states: 1 queued, 1 running, 1 completed (with metadata filled), 1 failed (status badge red, metadata empty).

---

**Section 3 — View Modal**

Triggered by clicking "View →" on a completed row. Renders as a centered overlay on top of the page. Background dims with a frosted overlay.

Modal is a large glass card (wider than the drop zone, ~800px). Structure:

**Header (inside modal):**
- Filename in medium weight
- Company name in large text below (e.g. "Jones Clothing Store")
- Smaller metadata line: "Balance Sheet · December 31, 2019 · USD"
- ✕ close button top-right

**Body (scrollable):**
A collapsible tree of financial sections. Each section has a ▶/▼ toggle arrow. Subsections indent. Line items are leaf nodes: left-aligned label, right-aligned dollar value in monospace. Null values show "—". Alternating subtle row highlight on hover (glass strip). Example structure:

```
▼ Assets
    ▼ Current Assets
        Cash and equivalents       $12,400
        Accounts receivable         $8,200
    ▶ Non-Current Assets
▼ Liabilities
    ▼ Current Liabilities
        Accounts payable            $5,100
▶ Equity
```

**Footer (sticky at bottom of modal):**
Three buttons right-aligned: "↺ Reprocess" (ghost button), "↓ Download ▾" (dropdown for JSON/CSV), "Close" (primary glass pill)

---

**Design Tokens:**
- Background: radial gradient `#e8edf5` to `#f0f0f8`
- Glass surface: `rgba(255,255,255,0.6)`, `backdrop-filter: blur(24px) saturate(180%)`, border `rgba(255,255,255,0.85) 1px solid`
- Font: `-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`
- Accent blue: `#0071e3` (Apple blue)
- Success green: `#34c759`
- Error red: `#ff3b30`
- Text primary: `#1d1d1f`
- Text muted: `#6e6e73`
- Radius: 16px for cards, 100px for pills
- Transition: `0.25s cubic-bezier(0.4, 0, 0.2, 1)`

Show all three sections together on one page as a full design mockup.
