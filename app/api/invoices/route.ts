// app/api/invoices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/app/generated/prisma/client';

type InvoiceStatus = 'OPEN' | 'READY' | 'PAID' ;

// helper to generate a ticket number like "INV-2025-000001"
function generateTicketNumber(createdAt: Date, sequence: number): string {
  const year = createdAt.getFullYear();
  const seqStr = sequence.toString().padStart(6, '0');
  return `INV-${year}-${seqStr}`;
}

// GET /api/invoices?status=OPEN&days=30&search=ali&ticketNumber=INV-2025-000001
// GET /api/invoices?status=OPEN&search=ali&ticketNumber=INV-2025-000001&start=2025-12-01&end=2025-12-09
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const statusParam = searchParams.get('status');
  const search = searchParams.get('search') ?? undefined;
  const ticketNumber = searchParams.get('ticketNumber') ?? undefined;
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const where: Prisma.InvoiceWhereInput = {};

  // filter by status
  if (statusParam === 'OPEN' || statusParam === 'READY' || statusParam === 'PAID') {
    where.status = statusParam as InvoiceStatus;
  }

  // filter by date range
  if (startParam || endParam) {
    where.createdAt = {};
    if (startParam) {
      const start = new Date(startParam);
      if (!isNaN(start.getTime())) where.createdAt.gte = start;
    }
    if (endParam) {
      const end = new Date(endParam);
      if (!isNaN(end.getTime())) where.createdAt.lte = end;
    }
  }

  // ticketNumber exact match (for scanner / quick lookup)
  if (ticketNumber) {
    where.ticketNumber = ticketNumber;
  } else if (search && search.trim() !== '') {
    const term = search.trim();
    // search by ticket, customer name or phone
    where.OR = [
      { ticketNumber: { contains: term } },
      { customer: { name: { contains: term } } },
      { customer: { phone: { contains: term } } },
    ];
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: true,
      items: {
        include: {
          item: true,
          serviceType: true,
        },
      },
    },
  });

  return NextResponse.json(invoices);
}

// POST /api/invoices
// body: { customerId, notes?, items: [{ itemId, serviceTypeId, quantity, adjustedAmount? }, ...] }
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    customerId?: number;
    notes?: string;
    items?: {
      itemId?: number;
      serviceTypeId?: number;
      quantity?: number;
      adjustedAmount?: number; // already in LBP from frontend
    }[];
  };

  if (!body.customerId) {
    return NextResponse.json(
      { error: 'customerId is required' },
      { status: 400 },
    );
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: 'At least one invoice item is required' },
      { status: 400 },
    );
  }

  // normalize / validate
  const normalizedItems = body.items
    .map((it) => ({
      itemId: it.itemId ?? 0,
      serviceTypeId: it.serviceTypeId ?? 0,
      quantity: it.quantity ?? 0,
      adjustedAmount: it.adjustedAmount ?? 0,
    }))
    .filter(
      (it) =>
        it.itemId > 0 &&
        it.serviceTypeId > 0 &&
        it.quantity > 0,
    );

  if (normalizedItems.length === 0) {
    return NextResponse.json(
      { error: 'Valid invoice items are required' },
      { status: 400 },
    );
  }

  // fetch base prices for all item/serviceType pairs
  const itemIds = Array.from(new Set(normalizedItems.map((i) => i.itemId)));
  const serviceTypeIds = Array.from(
    new Set(normalizedItems.map((i) => i.serviceTypeId)),
  );

  const prices = await prisma.itemPrice.findMany({
    where: {
      itemId: { in: itemIds },
      serviceTypeId: { in: serviceTypeIds },
      active: true,
    },
  });

  const priceMap = new Map<string, number>();
  for (const p of prices) {
    const key = `${p.itemId}-${p.serviceTypeId}`;
    priceMap.set(key, p.price);
  }

  let subtotal = 0;
  const itemsData: Prisma.InvoiceItemCreateManyInvoiceInput[] = [];

  for (const it of normalizedItems) {
    const key = `${it.itemId}-${it.serviceTypeId}`;
    const basePrice = priceMap.get(key);

    if (basePrice === undefined) {
      return NextResponse.json(
        {
          error: `No active price found for itemId=${it.itemId} and serviceTypeId=${it.serviceTypeId}`,
        },
        { status: 400 },
      );
    }

    const adjustedAmount = it.adjustedAmount ?? 0;
    const unitPrice = basePrice;
    const finalUnitPrice = unitPrice + adjustedAmount;
    const lineTotal = finalUnitPrice * it.quantity;

    subtotal += lineTotal;

    itemsData.push({
      itemId: it.itemId,
      serviceTypeId: it.serviceTypeId,
      quantity: it.quantity,
      unitPrice,
      adjustedAmount,
      lineTotal,
    });
  }

  const now = new Date();

  // crude sequence per day for ticketNumber
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const count = await prisma.invoice.count();

  const ticketNumber = generateTicketNumber(now, count + 1);

  const invoice = await prisma.invoice.create({
    data: {
      customerId: body.customerId,
      notes: body.notes?.trim() || null,
      ticketNumber,
      status: 'OPEN',
      subtotal,
      adjustedAmount: 0,
      total: subtotal,
      items: {
        createMany: {
          data: itemsData,
        },
      },
    },
    include: {
      customer: true,
      items: {
        include: {
          item: true,
          serviceType: true,
        },
      },
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}

// PUT /api/invoices
// body: { id? , ticketNumber?, status?: 'OPEN' | 'READY' | 'PAID', adjustedAmount?: number }
export async function PUT(request: NextRequest) {
  const body = (await request.json()) as {
    id?: number;
    ticketNumber?: string;
    status?: InvoiceStatus;
    adjustedAmount?: number; // already in LBP from frontend
  };

  if (!body.id && !body.ticketNumber) {
    return NextResponse.json(
      { error: 'id or ticketNumber is required' },
      { status: 400 },
    );
  }

  const whereUnique: Prisma.InvoiceWhereUniqueInput = body.id
    ? { id: body.id }
    : { ticketNumber: body.ticketNumber! };

  const existing = await prisma.invoice.findUnique({
    where: whereUnique,
  });

  if (!existing) {
    return NextResponse.json(
      { error: 'Invoice not found' },
      { status: 404 },
    );
  }

  const data: Prisma.InvoiceUpdateInput = {};

  if (body.status) {
    data.status = body.status;
  }

  if (typeof body.adjustedAmount === 'number') {
    const subtotal = existing.subtotal ?? 0;
    const adj = body.adjustedAmount;
    data.adjustedAmount = adj;
    data.total = subtotal + adj;
  }

  const updated = await prisma.invoice.update({
    where: whereUnique,
    data,
    include: {
      customer: true,
      items: {
        include: {
          item: true,
          serviceType: true,
        },
      },
    },
  });

  return NextResponse.json(updated);
}