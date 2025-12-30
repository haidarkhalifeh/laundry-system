// app/api/expenses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/app/generated/prisma/client';

// GET /api/expenses?search=detergent&days=30
// GET /api/expenses?search=...&days=...&from=yyyy-mm-dd&to=yyyy-mm-dd
const EXPENSE_CATEGORIES = [
  'RENT',
  'UTILITIES',
  'SUPPLIES',
  'MAINTENANCE',
  'SALARIES',
  'DELIVERY',
  'MARKETING',
  'OTHER',
] as const;

type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const search = searchParams.get('search') ?? undefined;
  const daysParam = searchParams.get('days') ?? undefined;
  const fromParam = searchParams.get('from') ?? undefined;
  const toParam = searchParams.get('to') ?? undefined;
  const categoryParam = searchParams.get('category') ?? undefined;

  const where: Prisma.ExpenseWhereInput = {};

  if (search && search.trim() !== '') {
    const term = search.trim();
    where.type = { contains: term };
  }

  if (fromParam || toParam) {
    const fromDate = fromParam ? new Date(fromParam) : undefined;
    const toDate = toParam ? new Date(toParam) : undefined;

    where.createdAt = {};
    if (fromDate) where.createdAt.gte = fromDate;
    if (toDate) where.createdAt.lte = toDate;
  } else if (daysParam) {
    const days = Number(daysParam);
    if (!Number.isNaN(days) && days > 0) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      where.createdAt = { gte: since };
    }
  }

  if (categoryParam && EXPENSE_CATEGORIES.includes(categoryParam as ExpenseCategory)) {
    where.category = categoryParam as ExpenseCategory;
  }
  
  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(expenses);
}

// Payload we accept from the UI
type ExpensePayload = {
  id?: number;
  type?: string;
  amount?: number;
  category?: ExpenseCategory;
  // yyyy-mm-dd coming from the date input; will map to createdAt
  date?: string;
};

// POST /api/expenses
export async function POST(request: NextRequest) {
  const body = (await request.json()) as ExpensePayload;

  const type = body.type?.trim();
  const amount = body.amount;

  const category =
  body.category && EXPENSE_CATEGORIES.includes(body.category)
    ? body.category
    : 'OTHER';

  if (!type || amount === undefined || Number.isNaN(amount)) {
    return NextResponse.json(
      { error: 'Type and valid amount are required' },
      { status: 400 },
    );
  }

  let createdAt: Date | undefined;
  if (body.date) {
    const d = new Date(body.date);
    if (!Number.isNaN(d.getTime())) {
      createdAt = d;
    }
  }

  const data: Prisma.ExpenseCreateInput = {
    type,
    amount,
    category,
    ...(createdAt ? { createdAt } : {}),
  };

  const expense = await prisma.expense.create({ data });

  return NextResponse.json(expense, { status: 201 });
}

// PUT /api/expenses
export async function PUT(request: NextRequest) {
  const body = (await request.json()) as ExpensePayload;

  if (!body.id) {
    return NextResponse.json(
      { error: 'id is required to update expense' },
      { status: 400 },
    );
  }
  const category =
  body.category && EXPENSE_CATEGORIES.includes(body.category)
    ? body.category
    : undefined;

  const type = body.type?.trim();
  const amount = body.amount;

  if (!type || amount === undefined || Number.isNaN(amount)) {
    return NextResponse.json(
      { error: 'Type and valid amount are required' },
      { status: 400 },
    );
  }

  let createdAt: Date | undefined;
  if (body.date) {
    const d = new Date(body.date);
    if (!Number.isNaN(d.getTime())) {
      createdAt = d;
    }
  }

  const data: Prisma.ExpenseUpdateInput = {
    type,
    amount,
    ...(createdAt ? { createdAt } : {}),
    ...(category ? { category } : {}),
  };

  try {
    const expense = await prisma.expense.update({
      where: { id: body.id },
      data,
    });

    return NextResponse.json(expense);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update expense' },
      { status: 500 },
    );
  }
}

// DELETE /api/expenses?id=123
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const idParam = searchParams.get('id');

  if (!idParam) {
    return NextResponse.json(
      { error: 'id is required' },
      { status: 400 },
    );
  }

  const id = Number(idParam);
  if (Number.isNaN(id)) {
    return NextResponse.json(
      { error: 'Invalid id' },
      { status: 400 },
    );
  }

  try {
    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 },
    );
  }
}