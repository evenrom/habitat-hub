# PRD.md

## 1. Project Overview
**Habitat** is a premium, zero-cost Progressive Web App (PWA) designed for high-end interior design curation and budget tracking. Serving as a "Digital Atelier," it shifts the paradigm from standard list-making to an immersive, editorial-style financial planning experience.

## 2. User Flows & Paradigms
* **Asymmetric Workflow:** Desktop for spatial planning and AI data extraction. Mobile for "Investment Overview" and execution on the retail floor.
* **Layout:** Desktop layout follows a strict 2/3 (Floorplan) and 1/3 (Item Carousels) split to optimize horizontal screen space.

## 3. Key Features & Logic
* **Investment Overview (Budget Engine):**
  * Binary classification for Main items: **Core** vs. **Nice-to-have**.
  * Alternative items are strictly excluded from all budget calculations.
  * The dashboard must display a per-room breakdown: [Core Cost] | [Nice-to-have Cost] | [Total Room Cost], alongside a Global Project Summary.
* **Display Filtering:** * A global UI toggle to filter the view and display *only* "Core" items (hiding Nice-to-have and Alternatives).
* **Swap Logic:**
  * When an Alternative item is promoted to a Main item (Swap), its `is_nice_to_have` status MUST be reset to `false`.
* **Spatial Canvas (SVG):**
  * Interactive blueprint.
  * Distinct hitboxes for 'Kitchen' and 'Foyer'.
  * **Render Nodes:** Glowing points on the map that trigger high-res visualizations from Google Drive.
* **AI Extraction:** Paste URL/Image to automatically parse dimensions, store, and price.

## 4. UI/UX Requirements
* **Heavy Glassmorphism:** Tooltips and modals must have a strong blur and ghost borders.
* **Iconography:** Strict removal of all Emojis (e.g., ✏️). Replace with clean, minimalist vector SVG icons.
* **Strict Ratio:** All item images are enforced at a 4:3 horizontal aspect ratio.