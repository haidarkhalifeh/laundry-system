// app/api/items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/app/generated/prisma/client';

// GET /api/items?search=shirt
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') ?? undefined;

  const where: Prisma.ItemWhereInput = {};

  if (search && search.trim() !== '') {
    const term = search.trim();
    where.name = { contains: term };
  }

  const items = await prisma.item.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(items);
}

// POST /api/items
// body: { name: string }
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    name?: string;
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json(
      { error: 'Name is required' },
      { status: 400 },
    );
  }

  try {
    const item = await prisma.item.create({
      data: {
        name,
        // active will use default(true) from schema
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Could not create item' },
      { status: 500 },
    );
  }
}

// PATCH /api/items
// body: { id: number; active: boolean }
export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as {
    id?: number;
    active?: boolean;
  };

  if (!body.id || typeof body.active !== 'boolean') {
    return NextResponse.json(
      { error: 'id and active are required' },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.item.update({
      where: { id: body.id },
      data: { active: body.active },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: 'Could not update item' },
      { status: 500 },
    );
  }
}