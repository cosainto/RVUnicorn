/**
 * One-time script to fix Deanna's duplicate rig situation.
 * Run on Railway with: npx ts-node scripts/fix-deanna-rig.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const deannaId = 'cmm9kukta0006i88masvtz2tp';
  const willId = 'cmlpeyk82005s3qause3sws7y';

  // Step 1: Find both rigs
  const deannaRig = await prisma.rig.findFirst({
    where: { ownerId: deannaId },
    select: { id: true, slug: true, rigName: true },
  });

  const willRig = await prisma.rig.findFirst({
    where: { ownerId: willId },
    select: { id: true, slug: true, rigName: true, make: true, model: true },
  });

  console.log('Deanna rig:', deannaRig);
  console.log('Will rig:', willRig);

  if (!willRig) {
    console.error('ERROR: Will rig not found');
    return;
  }

  // Step 2: Fix duplicate "Pursuit Pursuit" in model name
  if (willRig.model && willRig.model.includes('Pursuit Pursuit')) {
    await (prisma.rig as any).update({
      where: { id: willRig.id },
      data: { model: willRig.model.replace('Pursuit Pursuit', 'Pursuit') },
    });
    console.log('Fixed duplicate "Pursuit" in model name');
  }

  // Also check if model starts with make (e.g., make="Coachmen", model="Coachmen Pursuit 31bh")
  if (willRig.make && willRig.model && willRig.model.startsWith(willRig.make)) {
    const fixedModel = willRig.model.replace(new RegExp(`^${willRig.make}\\s*`), '');
    await (prisma.rig as any).update({
      where: { id: willRig.id },
      data: { model: fixedModel },
    });
    console.log(`Fixed model: "${willRig.model}" → "${fixedModel}"`);
  }

  // Step 3: Delete Deanna's rig if it exists
  if (deannaRig) {
    console.log(`Deleting Deanna rig: ${deannaRig.id} (${deannaRig.rigName || deannaRig.slug})`);

    // Clean up child records (Rig has onDelete: Cascade on most relations,
    // but be explicit to avoid surprises)
    const models = [
      'rigPost', 'rigTimelineItem', 'rigMomentBundle', 'rigMemory',
      'rigTrip', 'rigTripStop', 'rigPilot', 'rigCoPilot', 'rigFollow',
      'rigModLog', 'rigFuelLog', 'rigPageView', 'rigQRCode',
    ];

    for (const model of models) {
      try {
        const result = await (prisma as any)[model].deleteMany({ where: { rigId: deannaRig.id } });
        if (result.count > 0) console.log(`  Deleted ${result.count} ${model}`);
      } catch {
        // Model may not exist or have different field names — skip
      }
    }

    try {
      await (prisma.rig as any).delete({ where: { id: deannaRig.id } });
      console.log('SUCCESS: Deanna rig deleted');
    } catch (e: any) {
      console.error('Failed to delete rig:', e.message);

      // Try cascading approach
      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "Rig" WHERE id = $1`,
          deannaRig.id
        );
        console.log('SUCCESS: Deanna rig deleted via raw SQL');
      } catch (e2: any) {
        console.error('Raw SQL delete also failed:', e2.message);
      }
    }
  } else {
    console.log('No separate rig found for Deanna — already deleted');
  }

  // Step 4: Ensure Deanna is a co-pilot on Will's rig
  try {
    await (prisma.rigCoPilot as any).upsert({
      where: { rigId_userId: { rigId: willRig.id, userId: deannaId } },
      create: { rigId: willRig.id, userId: deannaId, role: 'COPILOT' },
      update: {},
    });
    console.log('Deanna added as co-pilot on Will rig');
  } catch (e: any) {
    console.log('Co-pilot upsert note:', e.message);
  }

  // Also add as RigPilot for backward compatibility
  try {
    await (prisma.rigPilot as any).upsert({
      where: { rigId_userId: { rigId: willRig.id, userId: deannaId } },
      create: { rigId: willRig.id, userId: deannaId, role: 'COPILOT', canEdit: true },
      update: {},
    });
    console.log('Deanna added as RigPilot on Will rig');
  } catch (e: any) {
    console.log('RigPilot upsert note:', e.message);
  }

  // Step 5: Verify
  const deannaRigCount = await prisma.rig.count({ where: { ownerId: deannaId } });
  const updatedWillRig = await prisma.rig.findFirst({
    where: { ownerId: willId },
    select: { rigName: true, make: true, model: true, slug: true },
  });
  const deannaSeesRig = await prisma.rig.findFirst({
    where: {
      OR: [
        { ownerId: deannaId },
        { coPilots: { some: { userId: deannaId } } },
        { pilots: { some: { userId: deannaId } } },
      ],
    },
    select: { rigName: true, slug: true },
  });

  console.log('\n--- VERIFICATION ---');
  console.log('Deanna own rigs:', deannaRigCount, '(should be 0)');
  console.log('Will rig:', updatedWillRig?.rigName, '| model:', updatedWillRig?.model);
  console.log('Deanna sees rig via co-pilot:', deannaSeesRig?.rigName, '(should be Pursuit of Memories)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
