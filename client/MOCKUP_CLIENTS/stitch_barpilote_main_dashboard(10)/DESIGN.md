# Design System: Executive Precision & Fluid Hospitality

## 1. Overview & Creative North Star: "The Digital Sommelier"
This design system is built to elevate bar management from a chaotic back-office task to an executive "cockpit" experience. The Creative North Star is **The Digital Sommelier**: an interface that is authoritative, refined, and effortlessly fluid. 

Unlike generic management software that relies on cramped tables and rigid borders, this system utilizes **high-contrast editorial scaling** and **tonal layering**. We break the "template" look by using intentional white space as a structural element and treating data as a premium asset. The result is an interface that feels less like a database and more like a high-end physical ledger presented on a glass desk.

---

## 2. Colors: High-Octane Warmth & Tonal Depth
We use a "vibrant-minimalist" palette. The energy of the orange is balanced by a sophisticated hierarchy of off-whites and cool greys.

### The Palette
*   **Primary (#FF5E00):** Our "Aperol Orange." Use for primary actions, critical alerts, and brand moments.
*   **Surface Hierarchy:** 
    *   `background`: #F5F5F7 (The Apple standard soft-grey base)
    *   `surface_container_lowest`: #FFFFFF (Pure white for primary content cards)
    *   `surface_container`: #EEEEF0 (For subtle nesting and grouping)
*   **Accents:** `tertiary` (#0061A4) is used sparingly for data secondary to the primary "heat" of the bar’s operations (e.g., historical reports).

### The "No-Line" Rule
**Prohibit 1px solid borders for sectioning.** Structural separation is achieved through background shifts. A card (`surface_container_lowest`) sits on a background (`surface`) to define its boundary. If you feel the need to draw a line, increase the spacing by one increment on the scale instead.

### The "Glass & Gradient" Rule
To avoid a flat "SaaS" look, use Glassmorphism for floating navigation bars or mobile overlays.
*   **Token:** `surface` at 80% opacity with a `20px` backdrop-blur.
*   **Signature Texture:** Use a subtle linear gradient on primary buttons—from `primary_container` (#FF5E00) to `primary` (#A63B00) at a 145° angle—to give the orange a three-dimensional "citrus" depth.

---

## 3. Typography: Editorial Authority
We utilize **SF Pro** (San Francisco) to maintain the "Executive" Apple aesthetic. The hierarchy is designed to make data feel like a headline.

*   **Display-MD (2.75rem):** Used for "The Big Number" (e.g., Total Daily Revenue). It should feel monumental.
*   **Headline-SM (1.5rem):** For section headers like "Live Inventory" or "Shift Overlap."
*   **Title-SM (1rem):** For card titles. Semibold weight to ensure it anchors the content below it.
*   **Body-MD (0.875rem):** The workhorse for all data entries and descriptions.
*   **Label-SM (0.6875rem):** All-caps with 5% letter spacing for non-interactive metadata (e.g., "TIMESTAMP").

**The Contrast Rule:** Pair a `Display-MD` metric with a `Label-SM` descriptor immediately below it. The massive scale jump creates a sophisticated, data-forward "Dashboard" feel.

---

## 4. Elevation & Depth: Tonal Layering
In this system, depth is a result of light and material, not "pencil lines."

*   **The Layering Principle:** Stacking defines priority.
    *   *Level 0:* `surface` (#F5F5F7) - The base canvas.
    *   *Level 1:* `surface_container_lowest` (#FFFFFF) - The Card. Use for high-priority data modules.
    *   *Level 2:* `surface_container_high` (#E8E8EA) - Nested controls inside a card (e.g., a search bar within an inventory list).
*   **Ambient Shadows:** Use a custom "Executive Shadow" for cards: 
    *   `box-shadow: 0 10px 30px rgba(26, 28, 29, 0.04);`
    *   This is a tinted shadow (using `on_surface` at 4%) to mimic natural light in a bright room.
*   **The "Ghost Border" Fallback:** If accessibility requires a border, use `outline_variant` (#E4BFB1) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: Precision Built

### Cards & Lists (The Core of Bar Management)
*   **Corner Radius:** Consistently `xl` (24px) for main containers and `lg` (16px) for internal elements.
*   **The Divider Ban:** Never use horizontal lines to separate list items. Use 16px (`scale 4`) of vertical padding and a 1px shift in background color on `:hover` to create separation.

### Buttons (Tactile Control)
*   **Primary:** Vibrant Orange gradient, `full` roundedness (capsule), white text.
*   **Secondary:** `surface_container_highest` background with `on_surface` text. No border.
*   **Tertiary:** Ghost style. Text only in `primary` orange, semibold.

### Executive Inputs
*   **Search/Text Fields:** Use `surface_container_low` background. On focus, transition the background to `surface_container_lowest` (pure white) and add the Ambient Shadow. This makes the input "pop" toward the user when they interact with it.

### Specialized Component: The "Stock Meter"
A custom linear gauge using `primary` for high stock and `error` for low stock. The track should be `surface_container_highest` with a 4px height and `full` rounding to maintain the soft aesthetic.

---

## 6. Do’s and Don’ts

### Do:
*   **Use Asymmetry:** Place a large Display metric on the left and a small trend sparkline on the right to create visual "momentum."
*   **Embrace Margin:** If a screen feels "empty," don't fill it. The "Executive" look is defined by the luxury of space.
*   **Color as Data:** Only use Orange (#FF5E00) for things that are actionable or critical. If everything is orange, nothing is.

### Don’t:
*   **Don't use 1px black borders.** It breaks the "Apple Executive" illusion and makes the app look like an Excel sheet.
*   **Don't use sharp corners.** Everything must be `md` (12px) or higher. Sharp corners feel aggressive; rounded corners feel managed.
*   **Don't use pure black text.** Use `on_surface` (#1A1C1D). It is softer on the eyes and feels more "editorial."

### Accessibility Note:
While we use soft shadows and tonal shifts, ensure that text-to-background contrast always meets WCAG AA standards. Our `on_surface` on `surface` provides a high contrast ratio while maintaining a premium feel.