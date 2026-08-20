import { prisma } from './index.js';
import { seedIdentity } from './seed-data.js';

seedIdentity()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
