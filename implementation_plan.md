# Implementation Plan: AI-Powered Financial Document Tracker

## Goal Description
Build a local-first, privacy-focused Web Application that acts as a smart digital filing cabinet for all financial documents. The system will ingest PDFs and images (Bills, Receipts, Statements), use a Vision LLM to automatically extract line items and metadata, and build a "Document Graph" that links related documents together (e.g., matching ANY type of Bill to its Payment Receipt, and linking that Receipt to a Bank Statement transaction).

## User Review Required
> [!IMPORTANT]
> **AI Provider Selection:** Since this requires a Multimodal / Vision LLM to read images and PDFs, we need an API key. Please specify if you prefer to use **Google Gemini (e.g., Gemini 1.5 Pro)** or **OpenAI (e.g., GPT-4o)** for the extraction engine. Both are excellent at this task.
>
> **Project Location:** I will create this as a new Next.js project in your `my_repos/FA_001/` directory. Let me know if you want it named something specific (e.g., `doc_tracker`).

## Proposed Architecture & Schema

The core power of this system lies in a flexible schema that does not hardcode rules for "medical" or "grocery", but treats all documents categorically.

### 1. Database Schema (SQLite + Prisma)

*   **`Document`**: The physical file.
    *   `id`, `fileName`, `filePath`, `documentCategory` (BILL, RECEIPT, STATEMENT), `uploadDate`.
*   **`ExtractedItem`**: Represents a single transaction or line item from ANY document.
    *   `id`, `documentId` (Foreign Key)
    *   `date`, `merchant_or_provider`
    *   `description` (Main text: "Organic Milk", "Consultation", "Home Depot Charge")
    *   `amount` (Float)
    *   `metadata` (JSONB): Highly flexible field. 
        *   *For a Utility Bill:* `{"account_number": "123", "billing_period": "Oct 2023"}`
        *   *For a Grocery Receipt:* `{"quantity": 2, "taxable": true, "category": "Produce"}`
*   **`DocumentLink`**: The graph edge connecting related files.
    *   `id`, `sourceDocumentId`, `targetDocumentId`
    *   `relationshipType` (e.g., `PAYS_FOR`, `APPEARS_ON_STATEMENT`)
    *   `confidenceScore` (0-100)
    *   `isManuallyVerified` (Boolean)

### 2. The Universal Three-Way Linker

This system explicitly removes assumptions about what *kind* of bill is being paid. The matching algorithm will rely on generic markers:

1.  **Bill uploaded:** Extracted metadata includes `amount_due: $120.50`, `merchant: PG&E`, `date: Oct 1st`.
2.  **Receipt uploaded:** Extracted metadata includes `amount_paid: $120.50`, `merchant: PG&E`, `date: Oct 5th`.
    *   *Linker detects match:* Amount matches, Merchant matches closely, Dates are sequential (Receipt is after Bill). Links Receipt ➡️ Bill.
3.  **Statement uploaded:** Extracted line item includes `amount: $120.50`, `description: PG&E WEB PAYMENT`, `date: Oct 6th`.
    *   *Linker detects match:* Amount matches, Description token "PG&E" matches, Statement date is slightly after Receipt date. Links Statement ➡️ Receipt.

### 3. Application Stack
- **Framework:** Next.js (React) App Router.
- **Styling:** Tailwind CSS + `shadcn/ui` for premium, dynamic, desktop-class aesthetics.
- **Database:** Prisma ORM connected to local SQLite (`dev.db`).
- **AI Integration:** Vercel AI SDK passing Base64 encoded images/PDFs to the chosen LLM with strict JSON Schema enforced via structured outputs.

## Verification Plan
1. **Extraction Validation:** Upload varying samples (a handwritten restaurant tip receipt, a digital utility bill PDF, a medical invoice) and verify that the LLM successfully populates the generic `metadata` JSON accordingly.
2. **Linker Validation:** Upload a mock consecutive chain (Bill -> Receipt -> Statement) and ensure the automated background job creates the `DocumentLink` records properly.
3. **UI Validation:** Ensure that searching for a line item (e.g., "Electricity") surfaces the Statement, the Receipt, and the Bill, and that the UI smoothly transitions between them.
