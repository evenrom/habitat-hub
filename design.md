# Design System: The Tactile Atelier

## 1. Color Palette (Editorial Dark)
* **Surface (Base):** `#17130f`
* **Warm Obsidian (Cards):** `#292420`
* **Botanical Green (Actions/Glows):** `#567357`
* **Sage Metallic (Accents):** `#adab9e`
* **Off-White (Text):** `#ebe1da` (Avoid pure `#FFFFFF`).

## 2. Typography
* **Serif (Noto Serif):** Used for headlines and project titles to convey "Art".
* **Sans (Manrope):** Used for data, prices, and functional UI to convey "Utility".

## 3. Glassmorphism Specs
* **Floating Tooltips/Modals:**
    * `background`: `rgba(23, 19, 15, 0.6)`
    * `backdrop-filter`: `blur(24px)`
    * `border`: `1px solid rgba(173, 171, 158, 0.15)`
* **Render Nodes:**
    * 12px circle in Botanical Green.
    * Glow: `box-shadow: 0 0 15px 2px rgba(86, 115, 87, 0.4)`.

## 4. Components
* **Cards:** Strict 4:3 ratio. Images must use `object-fit: cover`.
* **Tier Badges:** Minimalist pills for *Premium*, *Balanced*, and *Pragmatic*.
* **Investment Dashboard:** Clean typography with progress bars for each tier.
* **Responsive Layout:**
    * **Desktop/Tablet:** Asymmetric split screen. The Spatial Canvas (SVG Map) occupies the left 2/3 of the viewport. The Furniture Carousel/Details occupy the right 1/3.
    * **Mobile:** Stacked layout. Map on top, Furniture below.
* **Modals:** All modals (Item Details, Renders) MUST have a highly visible, persistent 'X' close button in the top corner to ensure easy dismissal.