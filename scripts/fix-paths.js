
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPaths() {
    const docs = await prisma.document.findMany();
    console.log(`Checking ${docs.length} documents...`);

    for (const doc of docs) {
        const expectedPath = `/processed/${doc.fileName}`;
        if (doc.filePath !== expectedPath) {
            console.log(`Fixing path for ${doc.fileName}: ${doc.filePath} -> ${expectedPath}`);
            await prisma.document.update({
                where: { id: doc.id },
                data: { filePath: expectedPath }
            });
        }
    }
    await prisma.$disconnect();
}

fixPaths().catch(console.error);
