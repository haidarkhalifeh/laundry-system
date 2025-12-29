// app/api/customers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/app/generated/prisma/client';

// GET /api/customers?search=ali&days=30
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const search = searchParams.get('search') ?? undefined;
  const daysParam = searchParams.get('days');

  const where: Prisma.CustomerWhereInput = {};

  if (search && search.trim() !== '') {
    const term = search.trim();

    where.OR = [
      { name: { contains: term } },
      { phone: { contains: term } },
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

// POST /api/customers
// body: { name: string; phone?: string | null; address?: string | null }
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    name?: string;
    phone?: string | null;
    address?: string | null;
  };

  const name = body.name?.trim();
  const phone = body.phone?.trim();
  if (!name) {
    return NextResponse.json(
      { error: 'Name is required' },
      { status: 400 },
    );
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        name,
        phone: phone || undefined,
        address: body.address?.trim() || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (err: unknown) {
    // handle unique phone errors etc. if you want later
    return NextResponse.json(
      { error: 'Could not create customer' },
      { status: 500 },
    );
  }
}