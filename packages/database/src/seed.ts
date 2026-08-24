import { prisma } from './index.js';
import { resetClientInbox, seedIdentity } from './seed-data.js';
import { seedDemoStories } from './seed-stories.js';

seedIdentity()
  .then(async () => {
    await resetClientInbox();
    await seedDemoStories();
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
