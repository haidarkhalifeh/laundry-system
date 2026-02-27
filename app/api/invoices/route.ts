// app/api/invoices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/app/generated/prisma/client';

type InvoiceStatus = 'OPEN' | 'READY' | 'PAID' | 'CANCELED';

// helper to generate a ticket number like "INV-2025-000001"
function generateTicketNumber(createdAt: Date, sequence: number): string {
  const year = createdAt.getFullYear();
  const seqStr = sequence.toString().padStart(6, '0');
  return `INV-${year}-${seqStr}`;
}

// GET /api/invoices
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const statusParam = searchParams.get('status');
  const search = searchParams.get('search') ?? undefined;
  const ticketNumber = searchParams.get('ticketNumber') ?? undefined;
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const where: Prisma.InvoiceWhereInput = {};

  // ---------- STATUS ----------
  if (
    statusParam === 'OPEN' ||
    statusParam === 'READY' ||
    statusParam === 'PAID' ||
    statusParam === 'CANCELED'
  ) {
    where.status = statusParam as InvoiceStatus;
  }

  // ---------- DATE RANGE (CREATED OR PAID) ----------
if (startParam || endParam) {
  const start = startParam ? new Date(startParam) : undefined;
  const end = endParam ? new Date(endParam + 'T23:59:59.999') : undefined;

  const createdRange = {
    ...(start && !isNaN(start.getTime()) && { gte: start }),
    ...(end && !isNaN(end.getTime()) && { lte: end }),
  };

  const paidRange = {
    ...(start && !isNaN(start.getTime()) && { gte: start }),
    ...(end && !isNaN(end.getTime()) && { lte: end }),
  };

  if (statusParam === 'PAID') {
    // ONLY paidAt
    where.paidAt = paidRange;
  } else if (statusParam === 'OPEN' || statusParam === 'CANCELED' || statusParam === 'READY') {
    // ONLY createdAt
    where.createdAt = createdRange;
  } else {
    // ALL statuses → split logic safely
    where.OR = [
      {
        status: { in: ['OPEN', 'CANCELED', 'READY'] },
        createdAt: createdRange,
      },
      {
        status: 'PAID',
        paidAt: paidRange,
      },
    ];
  }
}

  // ---------- SEARCH ----------
  if (ticketNumber) {
    where.ticketNumber = ticketNumber;
  } else if (search && search.trim() !== '') {
    const term = search.trim();
    where.OR = [
      ...(where.OR ?? []),
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
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    customerId?: number;
    notes?: string;
    items?: {
      itemId?: number;
      serviceTypeId?: number;
      quantity?: number;
      adjustedAmount?: number;
    }[];
  };

  if (!body.customerId) return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0)
    return NextResponse.json({ error: 'At least one invoice item is required' }, { status: 400 });

  const normalizedItems = body.items
    .map((it) => ({
      itemId: it.itemId ?? 0,
      serviceTypeId: it.serviceTypeId ?? 0,
      quantity: it.quantity ?? 0,
      adjustedAmount: it.adjustedAmount ?? 0,
    }))
    .filter((it) => it.itemId > 0 && it.serviceTypeId > 0 && it.quantity > 0);

  if (normalizedItems.length === 0)
    return NextResponse.json({ error: 'Valid invoice items are required' }, { status: 400 });

  // fetch prices
  const itemIds = Array.from(new Set(normalizedItems.map((i) => i.itemId)));
  const serviceTypeIds = Array.from(new Set(normalizedItems.map((i) => i.serviceTypeId)));

  const prices = await prisma.itemPrice.findMany({
    where: { itemId: { in: itemIds }, serviceTypeId: { in: serviceTypeIds }, active: true },
  });

  const priceMap = new Map<string, number>();
  for (const p of prices) priceMap.set(`${p.itemId}-${p.serviceTypeId}`, p.price);

  let subtotal = 0;
  const itemsData: Prisma.InvoiceItemCreateManyInvoiceInput[] = [];

  for (const it of normalizedItems) {
    const key = `${it.itemId}-${it.serviceTypeId}`;
    const basePrice = priceMap.get(key);
    if (basePrice === undefined)
      return NextResponse.json(
        { error: `No active price found for itemId=${it.itemId} and serviceTypeId=${it.serviceTypeId}` },
        { status: 400 },
      );

    const unitPrice = basePrice;
    const finalUnitPrice = unitPrice + it.adjustedAmount;
    const lineTotal = finalUnitPrice * it.quantity;
    subtotal += lineTotal;

    itemsData.push({
      itemId: it.itemId,
      serviceTypeId: it.serviceTypeId,
      quantity: it.quantity,
      unitPrice,
      adjustedAmount: it.adjustedAmount,
      lineTotal,
    });
  }

  const now = new Date();
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
      items: { createMany: { data: itemsData } },
    },
    include: {
      customer: true,
      items: { include: { item: true, serviceType: true } },
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}

// PUT /api/invoices - update status, adjustedAmount, or items
export async function PUT(request: NextRequest) {
  const body = (await request.json()) as {
    id?: number;
    ticketNumber?: string;
    status?: InvoiceStatus;
    adjustedAmount?: number;
    paidAt?: string;
    items?: { itemId?: number; serviceTypeId?: number; quantity?: number; adjustedAmount?: number }[];
  };

  if (!body.id && !body.ticketNumber)
    return NextResponse.json({ error: 'id or ticketNumber is required' }, { status: 400 });

  const whereUnique: Prisma.InvoiceWhereUniqueInput = body.id ? { id: body.id } : { ticketNumber: body.ticketNumber! };

  const existing = await prisma.invoice.findUnique({ where: whereUnique });
  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const data: Prisma.InvoiceUpdateInput = {};

  // --- handle status update ---
  if (body.status) {
    if (existing.status === 'CANCELED')
      return NextResponse.json({ error: `Cannot change status of ${existing.status} invoice` }, { status: 400 });

    if (body.status === 'CANCELED' && existing.status !== 'OPEN')
      return NextResponse.json({ error: 'Only OPEN invoices can be canceled' }, { status: 400 });

    if (body.status === 'READY') {
      try {
        const invoice = await prisma.invoice.findUnique({
          where: { id: existing.id },
          include: {
            items: {
              include: {
                item: true,
                serviceType: true,
              },
            },
            customer: true,
          },
        });
    
        if (!invoice?.customer?.phone) return;
    
        const phoneNumber = `961${invoice.customer.phone.replace(/^0/, '')}`;
    
        // Convert number to Arabic numerals
        const toArabicNumeral = (num: number) => {
          const arabicNums = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
          return num.toString().split('').map(d => arabicNums[+d] || d).join('');
        };
    
        // Format items
        const itemsText = invoice.items.map(i => {
          const quantity = toArabicNumeral(i.quantity);
          const itemName = i.item.name;
          const serviceName = i.serviceType.name;
          return `- ${quantity} ${itemName} (${serviceName})`;
        }).join('\n');
    
        // Format total with commas and L.L
        const formatLBP = (num: number) => num.toLocaleString('en-US') + ' L.L';
        const totalUSD = (invoice.total / 90000).toFixed(2);
    
        const messageBody = `مرحباً ${invoice.customer.name || ''} 👋
  طلبكم أصبح جاهزاً للاستلام من مصبغة المختار 🧺
  
  📄 تفاصيل الطلب:
  ${itemsText}
  
  💰 المجموع: ${formatLBP(invoice.total)}
  ~${totalUSD}$
  
  —
  هذا الرقم مخصص للإشعارات والعروض فقط
  💾 يرجى حفظ الرقم لتصلك طلباتك والعروض
  📞 لخدمة الزبائن:81679891` ;
    
        console.log('📱 Sending READY WhatsApp to:', phoneNumber);
    
        await fetch('https://gate.whapi.cloud/messages/text', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.WHAPI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: phoneNumber,
            body: messageBody,
          }),
        });
    
        console.log('✅ WhatsApp READY message sent');
    
      } catch (error) {
        console.error('❌ Whapi Send Error:', error);
      }
    }

    if (!(existing.status === 'PAID' && body.status === 'READY')) {
      data.status = body.status;
    }
    if (body.status === 'PAID') {
      data.paidAt = body.paidAt
        ? new Date(body.paidAt)
        : new Date();
    }
  }

  


  // --- handle adjustedAmount ---
  if (typeof body.adjustedAmount === 'number') {
    const subtotal = existing.subtotal ?? 0;
    const adj = body.adjustedAmount;
    data.adjustedAmount = adj;
    data.total = subtotal + adj;
  }

  // --- handle editing invoice items ---
  if (body.items && Array.isArray(body.items)) {
    if (existing.status !== 'OPEN')
      return NextResponse.json({ error: 'Only OPEN invoices can be edited' }, { status: 400 });

    const normalizedItems = body.items
      .map((it) => ({
        itemId: it.itemId ?? 0,
        serviceTypeId: it.serviceTypeId ?? 0,
        quantity: it.quantity ?? 0,
        adjustedAmount: it.adjustedAmount ?? 0,
      }))
      .filter((it) => it.itemId > 0 && it.serviceTypeId > 0 && it.quantity > 0);

    if (normalizedItems.length === 0)
      return NextResponse.json({ error: 'Valid invoice items are required' }, { status: 400 });

    const itemIds = Array.from(new Set(normalizedItems.map((i) => i.itemId)));
    const serviceTypeIds = Array.from(new Set(normalizedItems.map((i) => i.serviceTypeId)));

    const prices = await prisma.itemPrice.findMany({
      where: { itemId: { in: itemIds }, serviceTypeId: { in: serviceTypeIds }, active: true },
    });

    const priceMap = new Map<string, number>();
    for (const p of prices) priceMap.set(`${p.itemId}-${p.serviceTypeId}`, p.price);

    let subtotal = 0;
    const itemsData: Prisma.InvoiceItemCreateManyInvoiceInput[] = [];

    for (const it of normalizedItems) {
      const key = `${it.itemId}-${it.serviceTypeId}`;
      const basePrice = priceMap.get(key);
      if (basePrice === undefined)
        return NextResponse.json(
          { error: `No active price for itemId=${it.itemId} serviceTypeId=${it.serviceTypeId}` },
          { status: 400 },
        );

      const unitPrice = basePrice;
      const finalUnitPrice = unitPrice + it.adjustedAmount;
      const lineTotal = finalUnitPrice * it.quantity;
      subtotal += lineTotal;

      itemsData.push({
        itemId: it.itemId,
        serviceTypeId: it.serviceTypeId,
        quantity: it.quantity,
        unitPrice,
        adjustedAmount: it.adjustedAmount,
        lineTotal,
      });
    }

    // delete old items and insert new
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
    await prisma.invoiceItem.createMany({ data: itemsData.map(d => ({ ...d, invoiceId: existing.id })) });

    data.subtotal = subtotal;
    data.total = subtotal + (existing.adjustedAmount ?? 0);
  }

  const updated = await prisma.invoice.update({
    where: whereUnique,
    data,
    include: {
      customer: true,
      items: { include: { item: true, serviceType: true } },
    },
  });

  return NextResponse.json(updated);
}