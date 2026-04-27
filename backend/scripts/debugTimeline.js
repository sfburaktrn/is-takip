const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const samples = [];

  const damperCompleted = await prisma.damper.findFirst({
    where: { teslimat: false },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, imalatNo: true, productionStartedAt: true, updatedAt: true },
  });
  if (damperCompleted) samples.push({ productType: 'DAMPER', label: 'damper (tamamlanan?)', ...damperCompleted });

  const damperDelivered = await prisma.damper.findFirst({
    where: { teslimat: true },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, imalatNo: true, productionStartedAt: true, updatedAt: true, teslimAt: true },
  });
  if (damperDelivered) samples.push({ productType: 'DAMPER', label: 'damper (teslim)', ...damperDelivered });

  const dorseCompleted = await prisma.dorse.findFirst({
    where: { teslimat: false },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, imalatNo: true, productionStartedAt: true, updatedAt: true },
  });
  if (dorseCompleted) samples.push({ productType: 'DORSE', label: 'dorse (tamamlanan?)', ...dorseCompleted });

  const dorseDelivered = await prisma.dorse.findFirst({
    where: { teslimat: true },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, imalatNo: true, productionStartedAt: true, updatedAt: true, teslimAt: true },
  });
  if (dorseDelivered) samples.push({ productType: 'DORSE', label: 'dorse (teslim)', ...dorseDelivered });

  if (!samples.length) {
    console.log('no sample product found');
    return;
  }

  for (const s of samples) {
    const { productType, id: productId } = s;
    console.log('\n=== SAMPLE ===');
    console.log(s);

    const events = await prisma.stepCompletionEvent.findMany({
      where: { productType, productId },
      orderBy: { completedAt: 'asc' },
      select: { mainStepKey: true, completedAt: true },
    });
    console.log('stepCompletionEvent', { count: events.length, last: events.at(-1) });

    const auditCount = await prisma.auditLog.count({ where: { productType, productId } });
    console.log('auditLog count', auditCount);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

