# design.md

## 1. Design System: The Tactile Atelier
* **Visual Identity:** Dark, editorial, architectural. Avoids standard SaaS aesthetics. 

## 2. Color Palette & Contrast
* **Surface (Base):** `#17130f`
* **Warm Obsidian (Cards):** `#292420`
* **Botanical Green (Actions/Glows):** `#567357`
* **Sage Metallic (Accents/Text):** `#adab9e` -> **CRITICAL UPDATE:** Use this for card text and secondary details to ensure high contrast against the Warm Obsidian background.
* **Off-White (Primary Text):** `#ebe1da` (Avoid pure `#FFFFFF`).

## 3. Component Specs & Glassmorphism
* **Cards:** Strict 4:3 ratio (`object-fit: cover`).
* **Nice-to-have Toggle (Edit Modal):** * A clean toggle switch. 
  * **Disabled State:** When editing an "Alternative" item, this toggle must be visible but disabled (opacity 0.5, `pointer-events: none`).
* **Glass Overlays (Tooltips & Modals):**
  * `background`: `rgba(23, 19, 15, 0.6)`
  * `backdrop-filter`: `blur(24px)`
  * `border`: `1px solid rgba(173, 171, 158, 0.15)`
* **Render Nodes:**
  * 12px circle in Botanical Green.
  * Glow: `box-shadow: 0 0 15px 2px rgba(86, 115, 87, 0.4)`.

## 4. Typography
* **Serif (Noto Serif):** Used for headlines and project titles.
* **Sans (Manrope):** Used for data, prices, and functional UI.