# PRD: Habitat
**Status:** Updated for Atelier Workflow
**Design Language:** The Tactile Atelier (Dark Theme, Glassmorphism)

## 1. Product Paradigm & Workflow
* **App Name:** Habitat.
* **Primary Use Case:** Premium interior design curation and investment tracking.
* **Core Flow:** Asymmetric workflow. Desktop handles "AI Extraction" (high-volume data entry) and spatial planning. Mobile handles "Investment Overview" (real-time budget tracking during shopping) and status updates.

## 2. Architecture & Tech Stack (Amy's Setup)
* **Database:** Google Sheets ('Items', 'Config', 'Renders').
* **Backend:** Google Apps Script (GAS) acting as a Headless REST API.
* **Frontend:** Vanilla HTML/JS/CSS hosted directly on GitHub Pages.
* **AI Engine:** Google Gemini API for metadata extraction.
* **Storage:** Google Drive for furniture images and spatial renders.

## 3. Key Features
* **Investment Overview (3-Tier Budgeting):**
    * Parallel tracking of three scenarios: **Premium**, **Balanced**, and **Pragmatic**.
    * Real-time calculation of "Spent" capital vs. "Estimated" for each tier.
* **Spatial Canvas (SVG):**
    * Interactive blueprint with 4:3 image cards.
    * Distinct hitboxes for 'Kitchen' and 'Foyer'.
    * **Render Nodes:** Glowing points on the map that trigger high-res visualizations from Google Drive.
    * **Reset State:** Clicking anywhere on the spatial canvas background (outside of defined room hitboxes and render nodes) must reset the application state to view 'All' rooms and restore the full product carousel.
* **AI Extraction:**
    * Paste URL/Image to automatically parse dimensions, store, and price.
* **Scenario Validation:**
    * Logic preventing a Main item and its Alternatives from occupying the same scenario tier (e.g., if Main is 'Balanced', Alts must be 'Premium' or 'Pragmatic').

## 4. User Interface Requirements
* **Heavy Glassmorphism:** Tooltips and modals must have 24px blur and ghost borders.
* **Strict Ratio:** All item images are enforced at a 4:3 horizontal aspect ratio.
* **No-Line Layout:** Visual separation via spacing and tonal shifts, not border lines.