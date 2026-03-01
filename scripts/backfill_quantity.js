const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function backfillQuantity() {
    console.log("Starting backfill for existing ExtractedItems...");

    const items = await prisma.extractedItem.findMany();
    let updatedCount = 0;

    for (const item of items) {
        let quantityToSet = 1;

        // If they had metadata with quantity, backfill to that instead of the SQLite default of 1
        if (item.metadata) {
            try {
                const meta = JSON.parse(item.metadata);
                if (meta.quantity && typeof meta.quantity === 'number') {
                    quantityToSet = meta.quantity;
                }
            } catch (err) {
                // Ignore parse errors
            }
        }

        // We run an update regardless to ensure the database accurately reflects 1 or the parsed metadata quantity
        await prisma.extractedItem.update({
            where: { id: item.id },
            data: { quantity: quantityToSet }
        });

        updatedCount++;
    }

    console.log(`Successfully backfilled ${updatedCount} items.`);
}

backfillQuantity()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
