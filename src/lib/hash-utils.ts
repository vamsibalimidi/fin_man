import crypto from "crypto";

/**
 * Calculates a SHA-256 hash of a buffer.
 * Used for detecting identical file content across different uploads.
 */
export function calculateHash(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}
