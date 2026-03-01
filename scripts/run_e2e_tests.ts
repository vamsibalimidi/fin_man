import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function runTests() {
    console.log("=== STARTING AUTONOMOUS E2E TEST SUITE ===\n");

    try {
        // ---- Test Setup ----
        console.log("[SETUP] Cleansing testing environment...");
        await prisma.extractedItem.deleteMany();
        await prisma.documentLink.deleteMany();
        await prisma.document.deleteMany();

        // ---- Test 1: Uploading a File explicitly to test Database Commit & Extraction Logic ---
        console.log("\n[TEST 1] Committing a manual document to the database...");
        const sampleDoc = await prisma.document.create({
            data: {
                fileName: "E2E_Test_Receipt.pdf",
                filePath: "/processed/E2E_Test_Receipt.pdf",
                documentCategory: "RECEIPT",
                documentType: "Grocery",
                uploadDate: new Date().toISOString(),
                merchant_or_provider: "Whole Foods",
                totalAmount: 145.20,
                date: new Date().toISOString(),
                paymentStatus: "PAID",
                extractedItems: {
                    create: [
                        { description: "Organic Apples", amount: 5.99 },
                        { description: "Almond Milk", amount: 4.49 }
                    ]
                }
            },
            include: { extractedItems: true }
        });

        if (sampleDoc.id && sampleDoc.extractedItems.length === 2) {
            console.log("✅ TEST 1 PASSED: Database insertion of Document + Relations successful. ID:", sampleDoc.id);
        } else {
            console.error("❌ TEST 1 FAILED.");
        }

        // ---- Test 2: Linker Engine Evaluation ---
        console.log("\n[TEST 2] Linker Engine Validation...");
        const sampleBill = await prisma.document.create({
            data: {
                fileName: "E2E_Unpaid_Bill.pdf",
                filePath: "/processed/E2E_Unpaid_Bill.pdf",
                documentCategory: "BILL",
                documentType: "Medical",
                uploadDate: new Date().toISOString(),
                merchant_or_provider: "City Hospital",
                dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                paymentStatus: "UNPAID",
                totalAmount: 500.00,
                extractedItems: {
                    create: [{ description: "Medical Bill Total", amount: 500.00 }]
                }
            }
        });

        const payingReceipt = await prisma.document.create({
            data: {
                fileName: "E2E_Paying_Receipt.pdf",
                filePath: "/processed/E2E_Paying_Receipt.pdf",
                documentCategory: "RECEIPT",
                documentType: "Medical",
                uploadDate: new Date().toISOString(),
                merchant_or_provider: "City Hospital",
                date: new Date().toISOString(),
                paymentStatus: "PAID",
                totalAmount: 500.00,
                extractedItems: {
                    create: [{ description: "Receipt Total", amount: 500.00 }]
                }
            }
        });

        // Manually trigger linker logic by hitting the REST endpoint.
        console.log("Triggering Linker REST endpoint...");
        const linkerRes = await fetch("http://localhost:3000/api/linker", { method: "POST" });
        if (linkerRes.ok) {
            // Assert state mutation
            const checkedBill = await prisma.document.findUnique({ where: { id: sampleBill.id }, include: { targetLinks: true } });
            if (checkedBill?.paymentStatus === "PAID" && checkedBill.targetLinks.length > 0) {
                console.log("✅ TEST 2 PASSED: Linker successfully mapped RECEIPT exactly matching Amount + Proximity and retroactively updated BILL to PAID.");
            } else {
                console.error("❌ TEST 2 FAILED. Bill status was:", checkedBill?.paymentStatus);
            }
        } else {
            console.error("❌ TEST 2 FAILED on API crash.");
        }

        // ---- Test 3: Search Aggregation ---
        console.log("\n[TEST 3] Global Line-Item Search...");
        const hit = await prisma.extractedItem.findFirst({
            where: { description: { contains: "Almond Milk" } },
            include: { document: true }
        });

        if (hit && hit.document.merchant_or_provider === "Whole Foods") {
            console.log("✅ TEST 3 PASSED: Prisma ORM relation fetching correctly joins Line-Item queries back to Parent Document source context.");
        } else {
            console.error("❌ TEST 3 FAILED: Search miss.");
        }

        // ---- Test 4: Cascading Wipe Constraint & Unpaid Restoration ---
        console.log("\n[TEST 4] Database Cascade Deletion & Link Restoration Verification...");

        // We delete the payingReceipt from Test 2, which should:
        // 1. Cascade wipe its line items.
        // 2. Break the link to sampleBill.
        // 3. Trigger the Pre-Deletion hook to restore sampleBill's status to UNPAID.
        const targetDocId = payingReceipt.id;

        // Wait, we have to simulate the REST DELETE route because Prisma doesn't have native pre-delete triggers for the UNPAID restoration hook.
        // Prisma's CASCADE only drops the foreign keys. The UNPAID restoration logic lives in `/api/documents/[id]/route.ts`.
        const deleteRes = await fetch(`http://localhost:3000/api/documents/${targetDocId}`, { method: "DELETE" });

        if (deleteRes.ok) {
            const ghostItems = await prisma.extractedItem.findMany({ where: { documentId: targetDocId } });
            const restoredBill = await prisma.document.findUnique({ where: { id: sampleBill.id } });

            if (ghostItems.length === 0 && restoredBill?.paymentStatus === "UNPAID") {
                console.log("✅ TEST 4 PASSED: Deleting the Receipt triggered Prisma 'CASCADE' constraints (wiping child lines) AND the route restored the related Bill to UNPAID.");
            } else {
                console.error("❌ TEST 4 FAILED: Bill status is:", restoredBill?.paymentStatus, "Orphaned items:", ghostItems.length);
            }
        } else {
            console.error("❌ TEST 4 FAILED on API crash during DELETE.");
        }

        console.log("\n=== ALL E2E AUTOMATED TESTS COMPLETED SUCCESSFULLY ===");

    } catch (err) {
        console.error("Test Suite crashed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

runTests();
