/**
 * Normalizes a merchant name for fuzzy matching.
 * 
 * 1. Converts to lowercase.
 * 2. Removes common legal suffixes (Inc, LLC, etc.).
 * 3. Removes common TLDs (.com, .org, etc.).
 * 4. Removes non-alphanumeric characters.
 * 5. Collapses whitespace.
 */
export function normalizeMerchant(name: string): string {
    if (!name) return "";
    return name
        .toLowerCase()
        // Remove business suffixes (case insensitive, optional trailing period)
        .replace(/\b(inc|corp|llc|ltd|co|limited|incorporated|corporation|legal)\b\.?/gi, "")
        // Remove common TLDs
        .replace(/\.(com|org|net|io|ai|co|uk|us|biz|gov|edu|me|info)\b/gi, "")
        // Remove punctuation and special symbols
        .replace(/[^a-z0-9\s]/gi, "")
        // Collapse whitespace
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Returns true if two merchant names are logically the same after normalization.
 */
export function isMerchantDuplicate(name1: string, name2: string): boolean {
    const n1 = normalizeMerchant(name1);
    const n2 = normalizeMerchant(name2);

    if (!n1 || !n2) return false;

    // Strong normalized match
    if (n1 === n2) return true;

    // Substring match (e.g. "Amazon Services" vs "Amazon")
    // Only if the base name is significant enough
    if (n1.length > 3 && n2.length > 3) {
        if (n1.includes(n2) || n2.includes(n1)) return true;
    }

    return false;
}

/**
 * Normalizes a merchant name to kebab-case.
 */
export function kebabCase(name: string): string {
    return normalizeMerchant(name)
        .replace(/\s+/g, "-");
}

/**
 * Generates a normalized filename in the format: YYYY-MM-DD-<Merchant>-<type>
 */
export function generateNormalizedFilename(data: {
    date?: string | null,
    merchant?: string | null,
    category?: string | null,
    originalName: string
}): string {
    const { date, merchant, category, originalName } = data;

    // 1. Date (YYYY-MM-DD)
    let formattedDate = "0000-00-00";
    if (date) {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
            formattedDate = parsedDate.toISOString().split("T")[0];
        } else {
            formattedDate = new Date().toISOString().split("T")[0];
        }
    } else {
        formattedDate = new Date().toISOString().split("T")[0];
    }

    // 2. Merchant (kebab-case)
    const formattedMerchant = merchant ? kebabCase(merchant) : "unknown-merchant";

    // 3. Category (bill, rcpt, statement)
    const categoryMap: Record<string, string> = {
        "BILL": "bill",
        "RECEIPT": "rcpt",
        "STATEMENT": "statement"
    };
    const formattedCategory = (category && categoryMap[category.toUpperCase()]) || "other";

    // 4. Extension
    const ext = originalName.includes(".") ? originalName.split(".").pop() : "bin";

    return `${formattedDate}-${formattedMerchant}-${formattedCategory}.${ext}`;
}
