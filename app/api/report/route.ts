import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { InvoiceStatus } from '@/app/generated/prisma/client';

/* ===================== TYPES ===================== */

type TopItem = {
  itemId: number;
  itemName: string;
  quantity: number;
  amount: number;
};

type TopCustomer = {
  customerId: number | null;
  name: string;
  invoiceCount: number;
  amount: number;
};

type InvoiceItemRow = {
  itemId: number;
  quantity: number;
  lineTotal: number;
  item?: { id?: number; name?: string } | null;
};

type InvoiceWithRelations = {
  id: number;
  ticketNumber?: string | null;
  total: number;
  createdAt: Date;
  paidAt?: Date | null;
  customer?: { id: number | null; name?: string; phone?: string } | null;
  items: InvoiceItemRow[];
};

type InvoiceListItem = {
  id: number;
  ticketNumber: string | null;
  customer: { id: number | null; name: string; phone?: string } | null;
  date: Date;
  total: number;
};

type TopInvoiceItem = {
  id: number;
  ticketNumber: string | null;
  customer: { id: number | null; name: string } | null;
  date: Date;
  total: number;
};

/* ===================== HANDLER ===================== */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const fromParam = searchParams.get('from') || todayStr;
  const toParam = searchParams.get('to') || todayStr;

  const from = new Date(fromParam);
  const to = new Date(toParam);
  to.setDate(to.getDate() + 1); // inclusive range

  /* ---------- OPTIONS ---------- */
  const includeTopItems = searchParams.get('includeTopItems') !== '0';
  const includeTopCustomers = searchParams.get('includeTopCustomers') !== '0';
  const includeInvoices = searchParams.get('includeInvoices') !== '0';
  const includeTopInvoices = searchParams.get('includeTopInvoices') !== '0';

  const topItemsLimit = Number(searchParams.get('topItemsLimit') ?? '10') || 10;
  const topInvoicesLimit =
    Number(searchParams.get('topInvoicesLimit') ?? '') || topItemsLimit;

  const parseCSV = (s: string | null) =>
    (s || '').split(',').map(t => t.trim()).filter(Boolean);

  const excludeItemsTokens = parseCSV(searchParams.get('excludeItems'));
  const excludeCustomersTokens = parseCSV(searchParams.get('excludeCustomers'));
  const excludeInvoicesTokens = parseCSV(searchParams.get('excludeInvoices'));
  const excludeTopInvoicesTokens = parseCSV(searchParams.get('excludeTopInvoices'));

  const matchesToken = (value: string | number | null, tokens: string[]) => {
    if (!tokens.length) return false;
    const val = String(value ?? '').toLowerCase();
    return tokens.some(t => val.includes(t.toLowerCase()));
  };

  /* ===================== 1) PAID INVOICES (PAID AT) ===================== */

  const paidInvoicesRaw = await prisma.invoice.findMany({
    where: {
      status: InvoiceStatus.PAID,
      paidAt: {
        gte: from,
        lt: to,
      },
    },
    include: {
      customer: true,
      items: {
        include: { item: true },
      },
    },
    orderBy: {
      paidAt: 'desc',
    },
  });

  const invoices: InvoiceWithRelations[] =
    paidInvoicesRaw as unknown as InvoiceWithRelations[];

  /* ===================== 2) FILTER INVOICES ===================== */

  const invoicesFiltered = invoices.filter(inv => {
    const customerName = inv.customer?.name ?? '';
    const customerId = inv.customer?.id ?? null;

    if (
      excludeCustomersTokens.length &&
      (matchesToken(customerName, excludeCustomersTokens) ||
        matchesToken(customerId, excludeCustomersTokens))
    ) {
      return false;
    }

    if (
      excludeInvoicesTokens.length &&
      (matchesToken(inv.ticketNumber ?? '', excludeInvoicesTokens) ||
        matchesToken(inv.id, excludeInvoicesTokens))
    ) {
      return false;
    }

    return true;
  });

  /* ===================== 3) EXPENSES ===================== */

  const expenses = await prisma.expense.findMany({
    where: {
      createdAt: {
        gte: from,
        lt: to,
      },
    },
  });

  /* ===================== 4) REVENUE ===================== */

  let revenueTotal = 0;

  for (const inv of invoicesFiltered) {
    if (excludeItemsTokens.length) {
      revenueTotal += inv.items.reduce((s, l) => {
        const name = l.item?.name ?? '';
        if (
          matchesToken(l.itemId, excludeItemsTokens) ||
          matchesToken(name, excludeItemsTokens)
        )
          return s;
        return s + l.lineTotal;
      }, 0);
    } else {
      revenueTotal += inv.total;
    }
  }

  const revenueInvoiceCount = invoicesFiltered.length;

  /* ===================== 5) EXPENSE TOTAL ===================== */

  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const expenseCount = expenses.length;

  /* ===================== 6) TOP ITEMS ===================== */

  const itemMap = new Map<number, TopItem>();

  if (includeTopItems) {
    for (const inv of invoicesFiltered) {
      for (const line of inv.items) {
        const itemId = line.itemId;
        const itemName = line.item?.name ?? `Item #${itemId}`;

        if (
          excludeItemsTokens.length &&
          (matchesToken(itemId, excludeItemsTokens) ||
            matchesToken(itemName, excludeItemsTokens))
        )
          continue;

        const existing = itemMap.get(itemId);
        if (!existing) {
          itemMap.set(itemId, {
            itemId,
            itemName,
            quantity: line.quantity,
            amount: line.lineTotal,
          });
        } else {
          existing.quantity += line.quantity;
          existing.amount += line.lineTotal;
        }
      }
    }
  }

  const topItems = Array.from(itemMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topItemsLimit);

  /* ===================== 7) TOP CUSTOMERS ===================== */

  const customerMap = new Map<string, TopCustomer>();

  if (includeTopCustomers) {
    for (const inv of invoicesFiltered) {
      const cust = inv.customer;
      const key = String(cust?.id ?? 'unknown');
      const name = cust?.name ?? 'غير معروف';

      const amount = excludeItemsTokens.length
        ? inv.items.reduce((s, l) => {
            const itemName = l.item?.name ?? '';
            if (
              matchesToken(l.itemId, excludeItemsTokens) ||
              matchesToken(itemName, excludeItemsTokens)
            )
              return s;
            return s + l.lineTotal;
          }, 0)
        : inv.total;

      const existing = customerMap.get(key);
      if (!existing) {
        customerMap.set(key, {
          customerId: cust?.id ?? null,
          name,
          invoiceCount: 1,
          amount,
        });
      } else {
        existing.invoiceCount += 1;
        existing.amount += amount;
      }
    }
  }

  const topCustomers = Array.from(customerMap.values()).sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    return b.invoiceCount - a.invoiceCount;
  });

  /* ===================== 8) INVOICE LIST ===================== */

  const invoicesList: InvoiceListItem[] = includeInvoices
    ? invoicesFiltered
        .slice()
        .sort(
          (a, b) =>
            (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0),
        )
        .map(inv => ({
          id: inv.id,
          ticketNumber: inv.ticketNumber ?? null,
          customer: inv.customer
            ? {
                id: inv.customer.id ?? null,
                name: inv.customer.name ?? '',
                phone: inv.customer.phone ?? undefined,
              }
            : null,
          date: inv.paidAt ?? inv.createdAt,
          total: inv.total,
        }))
    : [];

  /* ===================== 9) TOP INVOICES ===================== */

  const topInvoices: TopInvoiceItem[] = [];

  if (includeTopInvoices) {
    invoicesFiltered
      .filter(inv => {
        if (!excludeTopInvoicesTokens.length) return true;
        return !(
          matchesToken(inv.ticketNumber ?? '', excludeTopInvoicesTokens) ||
          matchesToken(inv.id, excludeTopInvoicesTokens)
        );
      })
      .map(inv => ({
        id: inv.id,
        ticketNumber: inv.ticketNumber ?? null,
        customer: inv.customer
          ? { id: inv.customer.id ?? null, name: inv.customer.name ?? '' }
          : null,
        date: inv.paidAt ?? inv.createdAt,
        total: inv.total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, topInvoicesLimit)
      .forEach(i => topInvoices.push(i));
  }

  /* ===================== FINAL ===================== */

  return NextResponse.json({
    from: fromParam,
    to: toParam,
    revenueTotal,
    revenueInvoiceCount,
    expenseTotal,
    expenseCount,
    netTotal: revenueTotal - expenseTotal,
    topItems,
    topCustomers,
    invoicesList,
    topInvoices,
  });
}