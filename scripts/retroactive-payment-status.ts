import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Starting Retroactive Payment Status Updater...");

    // Find all links where a RECEIPT pays a BILL
    const links = await prisma.documentLink.findMany({
        where: {
            relationshipType: "PAYS_FOR",
        },
        include: {
            sourceDocument: true, // The receipt
            targetDocument: true, // The bill
        }
    });

    console.log(`Found ${links.length} PAYS_FOR links.`);

    let updatedCount = 0;

    for (const link of links) {
        if (link.targetDocument.documentCategory === "BILL") {
            // Update the payment status for the target document (the bill)
            const updated = await prisma.document.update({
                where: {
                    id: link.targetDocumentId,
                },
                data: {
                    paymentStatus: "PAID",
                } as any
            });

            if (updated) {
                console.log(`Updated Document ID ${link.targetDocumentId} to PAID.`);
                updatedCount++;
            }
        }
    }

    console.log(`Finished. Updated ${updatedCount} bill items to PAID status.`);
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
