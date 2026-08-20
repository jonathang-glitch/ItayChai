import { prisma } from './index.js';
import { resetClientInbox, seedIdentity } from './seed-data.js';

seedIdentity()
  .then(async () => {
    await resetClientInbox();
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
