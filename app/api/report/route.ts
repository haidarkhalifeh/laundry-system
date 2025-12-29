// app/api/report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { InvoiceStatus } from '@/app/generated/prisma/client';

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
  total: number;
  createdAt: Date;
  customer?: { id: number | null; name?: string; phone?: string } | null;
  items: InvoiceItemRow[];
  // ticketNumber may or may not exist — access via record when needed
  [key: string]: unknown;
};

type InvoiceListItem = {
  id: number;
  ticketNumber: string | null;
  customer: { id: number | null; name: string; phone?: string } | null;
  createdAt: Date;
  total: number;
};

type TopInvoiceItem = {
  id: number;
  ticketNumber: string | null;
  customer: { id: number | null; name: string } | null;
  createdAt: Date;
  total: number;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // yyyy-mm-dd

  const fromParam = searchParams.get('from') || todayStr;
  const toParam = searchParams.get('to') || todayStr;

  // interpret as date-only range [from, to+1day)
  const from = new Date(fromParam);
  const to = new Date(toParam);
  to.setDate(to.getDate() + 1);

  // --- parse options ---
  const includeTopItems = searchParams.get('includeTopItems') !== '0';
  const includeTopCustomers = searchParams.get('includeTopCustomers') !== '0';
  const includeInvoices = searchParams.get('includeInvoices') !== '0';
  const includeTopInvoices = searchParams.get('includeTopInvoices') !== '0';

  const topItemsLimit = Number(searchParams.get('topItemsLimit') ?? '10') || 10;
  const topInvoicesLimit = Number(searchParams.get('topInvoicesLimit') ?? '') || topItemsLimit;

  const parseCSV = (s: string | null) =>
    (s || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  const excludeItemsTokens = parseCSV(searchParams.get('excludeItems'));
  const excludeCustomersTokens = parseCSV(searchParams.get('excludeCustomers'));
  const excludeInvoicesTokens = parseCSV(searchParams.get('excludeInvoices'));
  const excludeTopInvoicesTokens = parseCSV(searchParams.get('excludeTopInvoices'));

  // helper: returns true if any token matches numeric id or substring (case-insensitive)
  const matchesToken = (value: string | number | null, tokens: string[]) => {
    if (!tokens || tokens.length === 0) return false;
    const valStr = value == null ? '' : String(value).toLowerCase();
    for (const t of tokens) {
      const tt = t.toLowerCase();
      if (!tt) continue;
      if (/^\d+$/.test(tt)) {
        if (String(valStr) === tt) return true;
        if (String(valStr).includes(tt)) return true;
      } else {
        if (valStr.includes(tt)) return true;
      }
    }
    return false;
  };

  // 1) Fetch paid invoices in range — include customer and items
    const paidInvoicesRaw = await prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.PAID,
        createdAt: {
          gte: from,
          lt: to,
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            item: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

  // Type the result into our narrower InvoiceWithRelations shape
  const paidInvoices: InvoiceWithRelations[] = paidInvoicesRaw.map((inv) => inv as unknown as InvoiceWithRelations);

  // 2) Apply invoice-level exclusions (excludeInvoices, excludeCustomers)
  const invoicesFiltered = paidInvoices.filter((inv) => {
    const customerName = inv.customer?.name ?? '';
    const customerId = inv.customer?.id ?? null;

    if (excludeCustomersTokens.length > 0) {
      if (matchesToken(customerName, excludeCustomersTokens)) return false;
      if (customerId !== null && matchesToken(String(customerId), excludeCustomersTokens)) return false;
    }

    const ticketNumber = String((inv as Record<string, unknown>)['ticketNumber'] ?? '');
    if (excludeInvoicesTokens.length > 0) {
      if (matchesToken(ticketNumber, excludeInvoicesTokens)) return false;
      if (matchesToken(String(inv.id), excludeInvoicesTokens)) return false;
    }

    return true;
  });

  // 3) Expenses in range
  const expenses = await prisma.expense.findMany({
    where: {
      createdAt: {
        gte: from,
        lt: to,
      },
    },
  });

  // 4) Compute revenueTotal and invoice count (apply excludeItems when summing)
  let revenueTotal = 0;
  const revenueInvoiceCount = invoicesFiltered.length;

  for (const inv of invoicesFiltered) {
    if (excludeItemsTokens.length > 0) {
      let invoiceSum = 0;
      for (const line of inv.items) {
        const itemId = line.itemId;
        const itemName = line.item?.name ?? '';
        if (matchesToken(String(itemId), excludeItemsTokens) || matchesToken(itemName, excludeItemsTokens)) {
          continue;
        }
        invoiceSum += line.lineTotal;
      }
      revenueTotal += invoiceSum;
    } else {
      revenueTotal += inv.total;
    }
  }

  // 5) Expense totals
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const expenseCount = expenses.length;

  // 6) Top items aggregation
  const itemMap = new Map<number, TopItem>();
  if (includeTopItems) {
    for (const inv of invoicesFiltered) {
      for (const line of inv.items) {
        const itemId = line.itemId;
        const itemName = line.item?.name ?? `Item #${itemId}`;

        if (excludeItemsTokens.length > 0) {
          if (matchesToken(String(itemId), excludeItemsTokens) || matchesToken(itemName, excludeItemsTokens)) {
            continue;
          }
        }

        const quantity = line.quantity;
        const amount = line.lineTotal;

        const existing = itemMap.get(itemId);
        if (!existing) {
          itemMap.set(itemId, {
            itemId,
            itemName,
            quantity,
            amount,
          });
        } else {
          existing.quantity += quantity;
          existing.amount += amount;
        }
      }
    }
  }
  const topItems = Array.from(itemMap.values()).sort((a, b) => b.amount - a.amount).slice(0, topItemsLimit);

  // 7) Top customers aggregation
  const customerMap = new Map<string, TopCustomer>();
  if (includeTopCustomers) {
    for (const inv of invoicesFiltered) {
      const cust = inv.customer;
      const customerKey = cust ? String(cust.id) : 'unknown';
      const name = cust?.name ?? 'غير معروف';

      const lineTotalForInvoice = excludeItemsTokens.length > 0
        ? inv.items.reduce((s: number, l: InvoiceItemRow) => {
            const itemId = l.itemId;
            const itemName = l.item?.name ?? '';
            if (matchesToken(String(itemId), excludeItemsTokens) || matchesToken(itemName, excludeItemsTokens)) {
              return s;
            }
            return s + l.lineTotal;
          }, 0)
        : inv.total;

      const existing = customerMap.get(customerKey);
      if (!existing) {
        customerMap.set(customerKey, {
          customerId: cust?.id ?? null,
          name,
          invoiceCount: 1,
          amount: lineTotalForInvoice,
        });
      } else {
        existing.invoiceCount += 1;
        existing.amount += lineTotalForInvoice;
      }
    }
  }
    // top customers based on total amount (highest spenders first), tie-breaker by invoice count
    const topCustomers = Array.from(customerMap.values()).sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return b.invoiceCount - a.invoiceCount;
    });

  // 8) Invoices list (respect includeInvoices and exclusions)
    // 8) Invoices list (respect includeInvoices and exclusions) — sort by date (newest first)
    const invoicesList: InvoiceListItem[] = includeInvoices
    ? invoicesFiltered
        .slice() // clone
        .sort((a, b) => (b.createdAt.getTime ? (b.createdAt.getTime() - a.createdAt.getTime()) : 0))
        .map((inv) => {
          const ticketNumberStr = String((inv as Record<string, unknown>)['ticketNumber'] ?? null);
          const totalAdjusted = excludeItemsTokens.length > 0
            ? inv.items.reduce((s: number, l: InvoiceItemRow) => {
                const itemId = l.itemId;
                const itemName = l.item?.name ?? '';
                if (matchesToken(String(itemId), excludeItemsTokens) || matchesToken(itemName, excludeItemsTokens)) {
                  return s;
                }
                return s + l.lineTotal;
              }, 0)
            : inv.total;

          return {
            id: inv.id,
            ticketNumber: ticketNumberStr || null,
            customer: inv.customer ? { id: inv.customer.id ?? null, name: inv.customer.name ?? '', phone: inv.customer.phone ?? undefined } : null,
            createdAt: inv.createdAt,
            total: totalAdjusted,
          };
        })
    : [];

  // 9) Top invoices
  const topInvoicesArr: TopInvoiceItem[] = [];
  if (includeTopInvoices) {
    const candidate = invoicesFiltered.filter((inv) => {
      const ticket = String((inv as Record<string, unknown>)['ticketNumber'] ?? '');
      if (excludeTopInvoicesTokens.length > 0) {
        if (matchesToken(ticket, excludeTopInvoicesTokens)) return false;
        if (matchesToken(String(inv.id), excludeTopInvoicesTokens)) return false;
      }
      return true;
    });

    const withTotals: TopInvoiceItem[] = candidate.map((inv) => {
      const total = excludeItemsTokens.length > 0
        ? inv.items.reduce((s: number, l: InvoiceItemRow) => {
            const itemId = l.itemId;
            const itemName = l.item?.name ?? '';
            if (matchesToken(String(itemId), excludeItemsTokens) || matchesToken(itemName, excludeItemsTokens)) {
              return s;
            }
            return s + l.lineTotal;
          }, 0)
        : inv.total;

      return {
        id: inv.id,
        ticketNumber: String((inv as Record<string, unknown>)['ticketNumber'] ?? null) || null,
        customer: inv.customer ? { id: inv.customer.id ?? null, name: inv.customer.name ?? '' } : null,
        createdAt: inv.createdAt,
        total,
      };
    });

    withTotals
      .sort((a, b) => b.total - a.total)
      .slice(0, topInvoicesLimit)
      .forEach((t) => topInvoicesArr.push(t));
  }

  const netTotal = revenueTotal - expenseTotal;

  return NextResponse.json({
    from: fromParam,
    to: toParam,
    revenueTotal,
    revenueInvoiceCount,
    expenseTotal,
    expenseCount,
    netTotal,
    topItems,
    topCustomers,
    invoicesList,
    topInvoices: topInvoicesArr,
  });
}