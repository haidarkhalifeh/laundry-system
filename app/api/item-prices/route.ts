// app/api/itemprices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/itemprices?onlyActive=true
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const onlyActive = searchParams.get('onlyActive');

  const where: { active?: boolean } = {};

  if (onlyActive === 'true') {
    where.active = true;
  }

  const prices = await prisma.itemPrice.findMany({
    where,
    orderBy: [
      { item: { name: 'asc' } },
      { serviceType: { name: 'asc' } },
    ],
    include: {
      item: true,
      serviceType: true,
    },
  });

  return NextResponse.json(prices);
}

// POST /api/itemprices
// body: { itemId: number; serviceTypeId: number; price: number }
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    itemId?: number;
    serviceTypeId?: number;
    price?: number;
  };

  const itemId = Number(body.itemId);
  const serviceTypeId = Number(body.serviceTypeId);
  const price = Number(body.price);

  if (!itemId || !serviceTypeId || Number.isNaN(price) || price <= 0) {
    return NextResponse.json(
      { error: 'itemId, serviceTypeId and a positive price are required' },
      { status: 400 },
    );
  }

  try {
    // Use the composite unique key @@unique([itemId, serviceTypeId])
    const itemPrice = await prisma.itemPrice.upsert({
      where: {
        itemId_serviceTypeId: {
          itemId,
          serviceTypeId,
        },
      },
      update: {
        price,
        active: true, // if it existed but was inactive, reactivate it
      },
      create: {
        itemId,
        serviceTypeId,
        price,
        active: true,
      },
      include: {
        item: true,
        serviceType: true,
      },
    });

    return NextResponse.json(itemPrice, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not save item price' },
      { status: 500 },
    );
  }
}

// PATCH /api/itemprices
// body: { id: number; active: boolean }
export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as {
    id?: number;
    active?: boolean;
  };

  const id = Number(body.id);
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const active = body.active ?? false;

  try {
    const updated = await prisma.itemPrice.update({
      where: { id },
      data: { active },
      include: {
        item: true,
        serviceType: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not update item price' },
      { status: 500 },
    );
  }
}