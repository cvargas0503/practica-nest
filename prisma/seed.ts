import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await hash('Practica123!', 12);
  const nombres = ['Tech Solutions', 'Marketing Pro', 'Consulting Experts'];
  for (let i = 0; i < nombres.length; i++) {
    const tenant = await prisma.tenant.upsert({
      where: { id: i + 1 },
      update: { name: nombres[i] },
      create: { id: i + 1, name: nombres[i] },
    });
    for (const role of [Role.ADMIN, Role.USER]) {
      const email = `${role.toLowerCase()}${i === 0 ? '' : i + 1}@practica.local`;
      await prisma.user.upsert({
        where: { email },
        update: { tenantId: tenant.id, role, password },
        create: { email, name: `${role} ${tenant.name}`, password, role, tenantId: tenant.id },
      });
    }
  }
  console.table(await prisma.tenant.findMany({ select: { id: true, name: true } }));
  console.table(await prisma.user.findMany({
    select: { id: true, email: true, role: true, tenantId: true },
    orderBy: { id: 'asc' },
  }));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
