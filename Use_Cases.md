# Financial Document Tracker - Use Cases

This system manages the full lifecycle of financial documents (Bills, Receipts, Statements) from raw file ingestion to parsed relationship chains.

## 1. Single File Interactive Ingestion
**Goal:** Quickly test Gemini extraction and manually edit fields before committing a document to the database.
* **Actor:** User
* **Flow:**
  1. User navigates to the `/upload` tab.
  2. User drops a PDF or JPG into the drag-and-drop zone.
  3. The frontend sends the file to the `/api/upload` boundary route.
  4. Backend runs `gemini-2.5-flash` natively parsing the file buffer.
  5. The extracted JSON payload is returned entirely to the client without saving anything to the DB.
  6. The `ExtractionReview` modal launches, allowing the user to view the raw JSON, see the parsed structured fields alongside the physical document image, fix any mistakes, and finally hit "Commit".
  7. The `POST /api/commit` route verifies data and inserts it into the SQLite DB.

## 2. Mass Staging Queue & Auto-Processing
**Goal:** Process massive backlogs of raw documents silently without holding the user hostage on a loading screen.
* **Actor:** User / Automated Backend
* **Flow:**
  1. User drops dozens of files into the `/unprocessed` tab (or manually copies files into `public/uploads` OS directory).
  2. The system scans the staging folder and lists all unprocessed files.
  3. User can tick specific checkboxes or click "Process All Automatically".
  4. The frontend loops over the selected files and hits `POST /api/process-all` for each one sequentially.
  5. The backend runs Gemini, bypasses human review, and instantly Commits the output to the DB, deleting the file from staging upon success.
  6. The UI updates a live-progress indicator incrementally (e.g., "1 out of 10").

## 3. Linker Pipeline (Receipts to Bills)
**Goal:** Automatically detect that a newly uploaded "Receipt" is the payment confirmation for an older "Bill" stored in the system.
* **Actor:** Auto-Linker Route
* **Flow:**
  1. Whenever a file is committed via `POST /api/commit` or `POST /api/process-all`, the backend automatically fires a secondary call to `POST /api/linker`.
  2. The Linker scans all `RECEIPT` documents.
  3. It uses a fuzzy 5-day proximity window on the receipt dates, comparing them against the `dueDate` and `date` of `BILL` documents.
  4. If a match is found based on Total Amount and Proximity constraint, it creates a `DocumentLink`.
  5. Crucially, it traverses backward: The Linked target `BILL` receives a `paymentStatus: "PAID"` update.

## 4. Query & Search Iteration
**Goal:** Find every historical purchase line-item matching a specific query across all aggregated receipts.
* **Actor:** User
* **Flow:**
  1. User types "Starbucks" into the global top navigation search bar.
  2. The system routes to `/search?q=Starbucks`.
  3. The server runs eager Prisma ORM fetching on `ExtractedItem` descriptions matching the query case-insensitively.
  4. It returns the exact line-items, and dynamically links back to the original source Document where that line item was found so the user can see the whole context.

## 5. Deletion & Data Wipe
**Goal:** Permanently remove an erroneous file and cascade delete all associated AI data, along with restoring modified relationships.
* **Actor:** User
* **Flow:**
  1. User clicks the Trash button on a document in `/documents`.
  2. A safe React pop-up confirms the action.
  3. The `DELETE /api/documents/[id]` route runs a pre-deletion hook: If the document being deleted is a Receipt that paid for a Bill, the route strictly breaks the link and restores that parent Bill to `paymentStatus: "UNPAID"`.
  4. The record is then deleted. Cascade deletion in Prisma successfully wipes all child `ExtractedItem` lines.
  5. Finally, the physical file is unlinked (`fs.unlinkSync`) off the hard drive `public/processed/` folder.
