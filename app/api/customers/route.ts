
import type { Prisma } from '@/app/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


/* =========================
   GET /api/customers
========================= */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search')?.trim();
  const daysParam = searchParams.get('days');

  const where: Prisma.CustomerWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  if (daysParam) {
    const days = Number(daysParam);
    if (!Number.isNaN(days) && days > 0) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      where.createdAt = { gte: since };
    }
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(customers);
}

/* =========================
   POST /api/customers
========================= */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = body.name?.trim();
  const phone = body.phone?.trim() || null;
  const address = body.address?.trim() || null;

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  try {
    // Only check phone if provided
    if (phone) {
      const exists = await prisma.customer.findUnique({
        where: { phone },
      });

      if (exists) {
        return NextResponse.json(
          { error: 'رقم الهاتف مستخدم لزبون آخر' },
          { status: 409 }
        );
      }
    }

    const customer = await prisma.customer.create({
      data: { name, phone, address },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Could not create customer' },
      { status: 500 }
    );
  }
}

/* =========================
   PUT /api/customers
========================= */
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const id = Number(body.id);
  const name = body.name?.trim();
  const phone = body.phone?.trim() || null;
  const address = body.address?.trim() || null;

  if (!id || !name) {
    return NextResponse.json(
      { error: 'Invalid data' },
      { status: 400 }
    );
  }

  try {
    // Check phone uniqueness ONLY if phone exists
    if (phone) {
      const exists = await prisma.customer.findFirst({
        where: {
          phone,
          NOT: { id },
        },
      });

      if (exists) {
        return NextResponse.json(
          { error: 'رقم الهاتف مستخدم لزبون آخر' },
          { status: 409 }
        );
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: { name, phone, address },
    });

    return NextResponse.json(customer);
  } catch {
    return NextResponse.json(
      { error: 'Could not update customer' },
      { status: 500 }
    );
  }
}

/* =========================
   DELETE /api/customers?id=1
========================= */
export async function DELETE(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get('id');
  const id = Number(idParam);

  if (!id) {
    return NextResponse.json(
      { error: 'Invalid id' },
      { status: 400 }
    );
  }

  try {
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Could not delete customer' },
      { status: 500 }
    );
  }
}