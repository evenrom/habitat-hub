# Habitat Hub - Comprehensive PRD & Architecture Document

## 1. Product Requirements Document (PRD)

### 1.1. Introduction
**Habitat Hub** is a high-end, mobile-first Progressive Web App (PWA) designed to help couples manage their interior design projects and furniture budgets. It replaces chaotic spreadsheets with a visual, intuitive interface that leverages AI for seamless data entry and provides real-time budget tracking.

### 1.2. Target Audience
*   **Users:** A couple managing a home renovation or furnishing project.
*   **Context:** Mobile usage while shopping or planning on-the-go.
*   **Key Needs:** Visual organization, budget clarity (ILS), easy data entry, and handling alternative options for furniture.

### 1.3. Core Experience & Navigation
The app features a **Bottom Navigation Bar** with three main tabs:

1.  **Rooms View (Home):**
    *   A list of rooms (e.g., Kitchen, Living Room, Bedroom).
    *   Clicking a room opens the **Room Detail View**, listing all furniture items for that space.
2.  **Floor Plan View:**
    *   Displays a high-resolution PNG of the apartment layout.
    *   **Interaction:** Supports **Pinch-to-Zoom** and Panning (using a lightweight library like `panzoom` or similar).
3.  **Budget Summary View:**
    *   A dedicated dashboard for financial overview.
    *   **Metrics:**
        *   **Total Budget:** Sum of all *Main* items (Currency: ILS ₪).
        *   **Room Breakdown:** Cost per room.
        *   **Distribution:** Percentage of total budget consumed by each room.

### 1.4. Functional Requirements

#### 1.4.1. Add Item Flow ("The Smart Add")
*   **Trigger:** A Floating Action Button (FAB) `+` in the Room Detail View.
*   **Step 1: Basic Info:** User enters the Item Title (e.g., "Velvet Sofa").
*   **Step 2: Image Upload & Crop:**
    *   User uploads an image (from camera or gallery).
    *   **Cropping:** Integrated `Cropper.js` (or similar) allows the user to crop the image to focus on the item before upload.
*   **Step 3: Product Link:** User pastes the product URL.
*   **Step 4: AI Extraction:**
    *   The cropped image is sent to the **Gemini API** via Google Apps Script.
    *   **Extracted Fields:** Name, Price, Dimensions (Length, Width, Height - parsed separately), Image Analysis (short description/tags).
*   **Step 5: Validation Card:**
    *   A modal displays the extracted data.
    *   **Rule:** All fields are mandatory. "Unknown" is acceptable for dimensions if not found, but fields cannot be empty.
    *   User can edit any field.
    *   **Action:** "Approve & Save" writes the data to Google Sheets.

#### 1.4.2. Alternatives System
*   **Concept:** Each furniture need (e.g., "Dining Table") has one **Main** item and multiple **Alternatives/Options**.
*   **UI:**
    *   Main Item is displayed prominently.
    *   Alternatives are hidden inside an **Accordion** below the Main Item.
*   **"Set as Main" Logic:**
    *   Every Alternative has a "Set as Main" button.
    *   Clicking this swaps the status: The Alternative becomes Main, and the old Main becomes an Alternative.
    *   **Impact:** This triggers a recalculation of the Room and Total Budget.

#### 1.4.3. Budget Logic
*   **Calculation:** `Total Budget = Sum(Price of all "Main" Items)`.
*   **Exclusion:** Alternatives *do not* contribute to the budget totals.
*   **Currency:** Israeli New Shekel (ILS ₪).

#### 1.4.4. Design & UI/UX
*   **Aesthetic:** High-end, luxurious.
*   **Color Palette:**
    *   **Primary:** Royal Blue (`#4169E1`) or Royal Green (`#136207`).
    *   **Accents:** Gold/Brass for buttons and highlights.
*   **Theme:** Full support for **Dark Mode** and **Light Mode** (system default or toggle).
*   **Feedback:** **Skeleton Loaders** must be used for all async operations (fetching room lists, loading images, waiting for AI).

---

## 2. Technical Architecture

### 2.1. High-Level Overview
*   **Frontend:** Mobile-First PWA (HTML5, CSS3, Vanilla JavaScript).
*   **Backend:** Google Apps Script (GAS) exposing `doGet` and `doPost` endpoints.
*   **Database:** Google Sheets (accessed via GAS).
*   **AI Service:** Gemini API (Free Tier) called from GAS.

### 2.2. Frontend Architecture
The application will use a lightweight, component-based structure using Vanilla JS ES6 modules.

*   **State Management:** A simple centralized `Store` object to hold `rooms`, `items`, `budget`, and `preferences`.
*   **Routing:** Hash-based routing (e.g., `#rooms`, `#floorplan`, `#budget`, `#room/kitchen`) to manage views without page reloads.
*   **Services:**
    *   `ApiService.js`: Handles communication with the GAS backend.
    *   `StorageService.js`: Manages `localStorage` for caching and offline support.
    *   `ThemeService.js`: Handles Dark/Light mode toggling.
*   **External Libraries (CDN):**
    *   `Cropper.js`: For image cropping.
    *   `Panzoom` (or similar): For Floor Plan interaction.
    *   `Chart.js` (optional) or CSS-based charts: For Budget visualization.

### 2.3. Backend & API Flow (Google Apps Script)

The GAS project will act as an API Gateway.

#### 2.3.1. API Endpoints
*   `GET`: Returns the `index.html` (serving the PWA).
*   `POST`: Handles all data operations based on a `action` parameter.
    *   `getInitialData`: Fetches all Rooms and Items.
    *   `addItem`: Receives JSON payload (Image Base64, metadata), calls Gemini, saves to Sheet.
    *   `updateItem`: Updates item details (including "Set as Main" swaps).
    *   `deleteItem`: Removes an item.

#### 2.3.2. AI Integration (Gemini)
*   **Trigger:** `addItem` action.
*   **Process:**
    1.  Frontend sends Base64 image to GAS.
    2.  GAS constructs a payload for Gemini API (`models/gemini-1.5-flash` or similar free tier).
    3.  **Prompt:** "Analyze this furniture image. Extract: Name, Price (number only), Dimensions (L, W, H). Return JSON."
    4.  GAS parses the JSON response and returns it to the Frontend for the "Validation Card".

### 2.4. Data Model (Google Sheets)

#### **Sheet 1: `Config`**
*   Stores app-wide settings and Room definitions.
*   **Columns:** `Key`, `Value`
    *   Example: `Room_List` -> `["Kitchen", "Living Room", ...]`

#### **Sheet 2: `Items`**
The main data store.

| Column | Type | Description |
| :--- | :--- | :--- |
| `ID` | String (UUID) | Unique ID for the item. |
| `Room` | String | The room this item belongs to. |
| `Type` | Enum | `Main` or `Alternative`. |
| `ParentID` | String (UUID) | If `Type` is `Alternative`, links to the `Main` item's ID. Empty for Main items. |
| `Name` | String | Display title of the item. |
| `ImageURL` | String | URL to the image (hosted on Drive or Base64 string if optimized). |
| `ProductURL`| String | Link to the store. |
| `Price` | Number | Cost in ILS. |
| `Dim_L` | String | Length. |
| `Dim_W` | String | Width. |
| `Dim_H` | String | Height. |
| `Status` | String | `Active`, `Purchased`, `Archived`. |
| `Timestamp` | DateTime | Date added. |

### 2.5. Security & Privacy
*   **Authentication:** A client-side overlay requiring the passcode `SA8RG`.
*   **Data Safety:** Standard Google Workspace security. The Web App should be deployed as "Execute as Me" (the developer) and "Who has access: Anyone" (or restricted to specific Google accounts if preferred), but since the prompt specifies a passcode, we assume a public web app with a simple frontend gate.
