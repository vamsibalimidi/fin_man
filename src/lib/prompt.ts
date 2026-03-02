/**
 * Centralized Gemini Extraction Prompt
 * 
 * This file contains the strictly structured prompt definition used across all backend extraction routes
 * (/api/extract, /api/upload, /api/process-all). 
 * 
 * By defining the parsing instructions explicitly in the natural language text, we enforce that the 
 * LLM responds exactly with the fields our Prisma schema requires. We specifically ask for JSON 
 * structures and direct map keys like \`documentCategory\` to avoid downstream routing errors.
 */
export const GEMINI_PROMPT = `Analyze this document. 
1. Classify it as 'STATEMENT', 'RECEIPT', or 'BILL' in a 'documentCategory' field. Classify as "Medical", "Grocery", "Utility", "Restaurant", "Other" in a 'documentType' field.   
2. Ensure the resulting structure is valid JSON.

If it's a STATEMENT:
- return 'documentCategory': 'STATEMENT'
- return 'documentType': 'STATEMENT'
- return 'transactions' array, where each transaction has: 'description', 'amount' (as number), 'date'.

If it's a RECEIPT or BILL:
- return 'documentCategory': 'RECEIPT' or 'BILL'
- return 'documentType': 'Medical', 'Grocery', 'Utility', 'Restaurant', 'Other'
- return 'merchant_or_provider' name
- return 'merchant_address' if available
- return 'date' in YYYY-MM-DD format
- return 'time' in HH:MM:SS format
- return 'total_amount' (as number)
- return 'number_of_items' (as number)
- return 'tax' (as number, if applicable)
- return 'paymentStatus' as 'PAID' or 'UNPAID' if it's a BILL (default to UNPAID if unsure)
- For 'BILL', return 'dueDate' if found.
- For 'Medical' bills, return 'patientName' if found (e.g., patient name on the bill).
- return an array of 'line_items'. 
  - For each 'line_item', provide 'description', 'amount' (as number).
  - Also provide a 'metadata' JSON object inside the line_item containing any other specific fields like 'quantity', 'category', 'tax_indicator', 'procedure_code', etc.
  - As part of metadata, see if you can intelligently decipher the item's "descripton" field into more meaningful item_description and item_category and send back in response
- if the number_of_items does not match the size of 'line_items', repeat the rescan and extraction process. Only do this 3 times and end of 3 times return what you have.
Be precise with amounts (do not include currency symbols in the number fields).`;
