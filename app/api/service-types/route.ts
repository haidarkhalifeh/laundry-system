// app/api/service-types/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/app/generated/prisma/client';

// GET /api/service-types?search=iron
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search')?.trim();

  const where: Prisma.ServiceTypeWhereInput = {};

  if (search && search !== '') {
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
    ];
  }

  const serviceTypes = await prisma.serviceType.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(serviceTypes);
}

// POST /api/service-types
// body: { name: string; code: string }
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    name?: string;
    code?: string;
  };

  const name = body.name?.trim();
  const code = body.code?.trim();

  if (!name) {
    return NextResponse.json(
      { error: 'Name is required' },
      { status: 400 },
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: 'Code is required' },
      { status: 400 },
    );
  }

  try {
    const serviceType = await prisma.serviceType.create({
      data: {
        name,
        code,
      },
    });

    return NextResponse.json(serviceType, { status: 201 });
  } catch {
    // You can refine this later to detect unique code errors
    return NextResponse.json(
      { error: 'Could not create service type' },
      { status: 500 },
    );
  }
}