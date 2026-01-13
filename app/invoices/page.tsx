// app/invoices/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Barcode from 'react-barcode';
import { useRef} from 'react';



const frequentItemIds = [6, 7, 8, 1]; // IDs of the 30% most-used items
const otherItemIds = [2,32,25, 3 ,4 ,5 ,27,28, 9, 10, 11, 13, 14, 15, 16,29,37,18,21,33,34,19,36,26,30,31,20,22,35,23,24,12, 17]; // remaining IDs in your desired order
const USD_RATE = 90000; // 1 USD = 90,000 LBP

type Customer = {
  id: number;
  name: string;
  phone: string;
};

type Item = {
  id: number;
  name: string;
  active: boolean;
};

type ServiceType = {
  id: number;
  name: string;
  code: string;
};

type InvoiceItemRow = {
  id: number;
  quantity: number;
  unitPrice: number;
  adjustedAmount: number;
  lineTotal: number;
  item: { id: number; name: string };
  serviceType: { id: number; name: string };
};

type Invoice = {
  id: number;
  ticketNumber: string;
  status: 'OPEN' | 'READY' | 'PAID' | 'CANCELED';
  createdAt: string;
  subtotal: number;
  adjustedAmount: number;
  total: number;
  notes: string | null;
  customer: Customer;
  items: InvoiceItemRow[];
  paidAt: string | null;
};

type DraftItemRow = {
  id: number;
  itemId: number | '';
  serviceTypeId: number | '';
  quantity: number;
  adjustedAmount: string; // raw input, will be converted to LBP on submit
};

function normalizeAmountInput(raw: string): number {
  if (!raw.trim()) return 0;

  const num = Number(raw.replace(/,/g, ''));
  if (Number.isNaN(num) || num === 0) return 0;

  let value = num;

  // USD → LBP
  if (Math.abs(num) < 1000) {
    value = num * USD_RATE;
  }

  // ✅ round to nearest 1,000 LBP
  return Math.round(value / 1000) * 1000;
}

// helpers — place them near the top of the component file
function formatDateYYYYMMDD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function toggleNegative(value: string) {
  if (!value) return '-';
  return value.startsWith('-') ? value.slice(1) : '-' + value;
}

function getWeekRange(date: Date) {
  const d = new Date(date);
  // JS: 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const day = d.getDay();
  // compute offset so Monday is returned (if Sunday -> go back 6 days)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  saturday.setHours(23, 59, 59, 999);

  return { monday, saturday };
}

function formatWithCommas(value: string) {
  if (!value) return '';

  const isNegative = value.startsWith('-');
  const clean = value.replace('-', '');

  const [intPart, decimalPart] = clean.split('.');

  const formattedInt = intPart
    ? Number(intPart).toLocaleString('en-US')
    : '0';

  return (
    (isNegative ? '-' : '') +
    formattedInt +
    (decimalPart !== undefined ? '.' + decimalPart : '')
  );
}

function stripCommas(value: string) {
  return value.replace(/,/g, '');
}

// replace your existing loadInvoices with this function



export default function InvoicesPage() {
  const ticketInputRef = useRef<HTMLInputElement | null>(null);
  

useEffect(() => {
  // initial focus on mount
  ticketInputRef.current?.focus();
}, []);
  // creation section
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  const [items, setItems] = useState<Item[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [draftItems, setDraftItems] = useState<DraftItemRow[]>([
    { id: 1, itemId: '', serviceTypeId: '', quantity: 1, adjustedAmount: '' },
  ]);
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // list / filters
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'READY' | 'PAID'>('OPEN');
  const [daysFilter, setDaysFilter] = useState('7');
  const [searchFilter, setSearchFilter] = useState('');

  // mark as paid / scanner
  const [payTicketNumber, setPayTicketNumber] = useState('');
  const [payAdjustedAmount, setPayAdjustedAmount] = useState('');
  const [existingCustomerMatch, setExistingCustomerMatch] = useState<Customer | null>(null);
  // selected invoice for view/print
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [printMode, setPrintMode] = useState(false);

  const [showPrint, setShowPrint] = useState(false);
  const [startDate, setStartDate] = useState<string | undefined>();
const [endDate, setEndDate] = useState<string | undefined>();
const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
const formRef = useRef<HTMLDivElement | null>(null);
const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  type Errors = {
    customer?: string;
    items?: string;
    general?: string;
    createCustomer?: string;
    invoice?: string;
  };
  
  const [errors, setErrors] = useState<Errors>({});
  // ---- data loading ----
  async function loadItems() {
    const res = await fetch('/api/items');
    if (!res.ok) return;
    setItems(await res.json());
  }

  async function loadServices() {
    const res = await fetch('/api/service-types');
    if (!res.ok) return;
    setServices(await res.json());
  }

  async function loadInvoices(
    customStart?: string,
    customEnd?: string,
    overrides?: { status?: typeof statusFilter; days?: string; search?: string }
  ): Promise<void> {
    setListLoading(true);
  
    // Update state if new range selected (today/week/month)
    if (customStart && customEnd) {
      setStartDate(customStart);
      setEndDate(customEnd);
    }
  
    const activeStart = customStart ?? startDate;
    const activeEnd = customEnd ?? endDate;
  
    const params = new URLSearchParams();
  
    const status = overrides?.status ?? statusFilter;
    if (status && status !== 'ALL') params.set('status', status);
  
    if (activeStart && activeEnd) {
      params.set('start', `${activeStart}T00:00:00`);
      params.set('end', `${activeEnd}T23:59:59.999`);
    } else {
      const days = overrides?.days ?? daysFilter;
      if (days && days.trim()) params.set('days', days.trim());
    }
  
    const search = overrides?.search ?? searchFilter;
    if (search && search.trim()) params.set('search', search.trim());
  
    try {
      const res = await fetch(`/api/invoices?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setInvoices(data);
    } catch (err) {
      console.error('Error loading invoices', err);
      setInvoices([]);
    } finally {
      setListLoading(false);
      
    }
  }
  useEffect(() => {
    // initial load
    void loadItems();
    void loadServices();
    void loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      loadInvoices(undefined, undefined, {
        status: statusFilter,
        days: daysFilter,
        search: searchFilter,
      });
    }, 400); // debounce delay (ms)
  
    return () => clearTimeout(t);
  }, [searchFilter, statusFilter, daysFilter]);

  useEffect(() => {
    const handleAfterPrint = () => {
      ticketInputRef.current?.focus();
    };
  
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const handleEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    setSelectedCustomer(inv.customer);
    setDraftItems(
      inv.items.map((it) => ({
        id: it.id,
        itemId: it.item.id,
        serviceTypeId: it.serviceType.id,
        quantity: it.quantity,
        adjustedAmount: String(it.adjustedAmount || 0),
      }))
    );
    setNotes(inv.notes || '');
  
    // scroll to form smoothly
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };
  // ---- customer search / create ----
  async function handleCustomerSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!customerSearch.trim()) return;

    const params = new URLSearchParams();
    params.set('search', customerSearch.trim());

    const res = await fetch(`/api/customers?${params.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      alert('فشل في البحث عن العملاء، تحدث إلى الدعم');
      return;
    }
    const data = (await res.json()) as Customer[];
    setCustomerResults(data);

  }
  function arabicToEnglishDigits(value: string) {
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    return value.replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString());
  }

  async function handleCreateCustomerInline(e: React.FormEvent) {
    e.preventDefault();
  
    const name = newCustName.trim();
    const phone = newCustPhone.trim() || null;
  
    setErrors({ createCustomer: undefined });
  
    if (!name) {
      setErrors({ createCustomer: 'الاسم مطلوب' });
      return;
    }
  
    // 🔍 check for existing customer with same name
    const res = await fetch(`/api/customers?search=${encodeURIComponent(name)}`);
    const matches = (await res.json()) as Customer[];
  
    if (matches.length > 0) {
      setExistingCustomerMatch(matches[0]);
      return; // ⛔ stop here and ask user
    }
  
    await createCustomer(name, phone);
  }

  async function createCustomer(name: string, phone: string | null) {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });
  
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setErrors({ createCustomer: err?.error || 'فشل في إنشاء الزبون' });
      return;
    }
  
    const customer = (await res.json()) as Customer;
  
    setSelectedCustomer(customer);
    setCustomerResults([]);
    setCustomerSearch(
      `${customer.name}${customer.phone ? ` (${customer.phone})` : ''}`
    );
    setNewCustName('');
    setNewCustPhone('');
  }

  const isTodayActive = () => {
    const today = formatDateYYYYMMDD(new Date());
    return startDate === today && endDate === today;
  };
  
  const isThisWeekActive = () => {
    const { monday, saturday } = getWeekRange(new Date());
    return (
      startDate === formatDateYYYYMMDD(monday) &&
      endDate === formatDateYYYYMMDD(saturday)
    );
  };
  
  const isThisMonthActive = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
    return (
      startDate === formatDateYYYYMMDD(firstDay) &&
      endDate === formatDateYYYYMMDD(lastDay)
    );
  };
  const dateBtnClass = (active: boolean) =>
    `rounded-md px-4 py-2 font-semibold transition ${
      active
        ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
        : 'bg-sky-600 text-white hover:bg-sky-700'
    }`;

  // ---- draft invoice items ----
  function updateDraftRow(id: number, patch: Partial<DraftItemRow>) {
    setDraftItems((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function addDraftRow() {
    setDraftItems((rows) => [
      ...rows,
      {
        id: rows.length ? rows[rows.length - 1].id + 1 : 1,
        itemId: '',
        serviceTypeId: '',
        quantity: 1,
        adjustedAmount: '',
      },
    ]);
  }

  function removeDraftRow(id: number) {
    setDraftItems((rows) => rows.filter((r) => r.id !== id));
  }

  // ---- create invoice ----
  async function handleSaveInvoice(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
  
    if (!selectedCustomer) {
      setErrors({ customer: 'اختر زبون أو قم بإنشاء واحد جديد أولاً' });
      return;
    }
  
    const validRows = draftItems.filter(
      (r) => r.itemId && r.serviceTypeId && r.quantity > 0
    );
    if (validRows.length === 0) {
      setErrors({ items: 'أضف على الأقل قطعة واحدة صحيحة إلى الفاتورة' });
      return;
    }
  
    const itemsPayload = validRows.map((r) => ({
      itemId: r.itemId as number,
      serviceTypeId: r.serviceTypeId as number,
      quantity: r.quantity,
      adjustedAmount: normalizeAmountInput(r.adjustedAmount),
    }));
  
    setCreating(true);
  
    try {
      const res = await fetch('/api/invoices', {
        method: editingInvoice ? 'PUT' : 'POST', // PUT if editing
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingInvoice
            ? { id: editingInvoice.id, customerId: selectedCustomer.id, notes: notes.trim() || undefined, items: itemsPayload }
            : { customerId: selectedCustomer.id, notes: notes.trim() || undefined, items: itemsPayload }
        ),
      });
  
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setErrors({ general: err?.error || 'فشل إنشاء الفاتورة، تواصل مع الدعم' });
        return;
      }
  
      const inv = (await res.json()) as Invoice;
  
      if (editingInvoice) {
        // update the invoices in the state
        setInvoices((prev) =>
          prev.map((i) => (i.id === inv.id ? inv : i))
        );
      } else {
        // new invoice
        setInvoices((prev) => [inv, ...prev]);
      }
  
      // reset form
      setDraftItems([{ id: 1, itemId: '', serviceTypeId: '', quantity: 1, adjustedAmount: '' }]);
      setNotes('');
      setEditingInvoice(null); // clear editing mode
      setSelectedCustomer(null); // reset customer selection
      setCustomerSearch('');
      await loadInvoices();
      setSelectedInvoice(inv);
      ticketInputRef.current?.focus();
    } finally {
      setCreating(false);
    }
  }

  async function searchCustomers(term: string) {
    const q = term.trim();
    if (!q) {
      setCustomerResults([]);
      return;
    }
  
    const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}`);
    if (!res.ok) return;
  
    const data = await res.json();
    setCustomerResults(data);
  }



  // ---- status updates / payment ----
  async function updateInvoiceStatus(
    invoiceId: number,
    status: 'OPEN' | 'READY' | 'PAID' | 'CANCELED',
    adjustedAmountLb: number | null = null,
  ) {
    const payload: {
      id: number;
      status: 'OPEN' | 'READY' | 'PAID' | 'CANCELED';
      adjustedAmount?: number;
    } = {
      id: invoiceId,
      status,
    };

    if (adjustedAmountLb !== null) {
      payload.adjustedAmount = adjustedAmountLb;
    }

    const res = await fetch('/api/invoices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      alert(err?.error || 'فشل تحديث الفاتورة، تحدث إلى الدعم');
      return;
    }

    await loadInvoices();
  }

  // mark as paid by ticketNumber (scanner / manual)
  async function handlePayByTicket(e: React.FormEvent) {
    e.preventDefault();
  
    setErrors({ invoice: undefined });
  
    const ticket =
      "INV-" + new Date().getFullYear() + "-" + payTicketNumber.trim();
    if (!ticket) return;
  
    const adjLb = normalizeAmountInput(payAdjustedAmount);
  
    const res = await fetch('/api/invoices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketNumber: ticket,
        status: 'PAID',
        adjustedAmount: adjLb,
        paidAt: new Date().toISOString(), // ✅ ADD THIS
      }),
    });
  
    if (!res.ok) {
      setErrors({ invoice: 'الفاتورة غير موجودة' });
      return;
    }
  
    setPayTicketNumber('');
    setPayAdjustedAmount('');
    await loadInvoices();
    ticketInputRef.current?.focus();
  }

  // ---- printing ----
  function handleView(inv: Invoice) {
    
    setSelectedInvoice(inv);
    setPrintMode(false);
    
  }

  function closeInvoiceView() {
    setSelectedInvoice(null);
    
  }
  
  function handlePrint(inv: Invoice) {
    // show invoice popup for printing
    setSelectedInvoice(inv);
    setPrintMode(true);

    // let React render, then call print, then close + refocus scanner
    setTimeout(() => {
      const img = document.querySelector('.invoice-print img') as HTMLImageElement | null;
      if (img && !img.complete) {
        img.onload = () => window.print();
        
      } else {
      
      window.print();
      document.body.classList.remove('modal-open')
      setPrintMode(false);
      setSelectedInvoice(null);           // close popup after print
      ticketInputRef.current?.focus(); 
      
      }   // back to scanner field
    }, 100);
  }

  const sortedInvoices = [...invoices].sort((a, b) => {
    // If both are PAID → sort by paidAt
    if (a.status === 'PAID' && b.status === 'PAID') {
      return (
        new Date(b.paidAt ?? 0).getTime() -
        new Date(a.paidAt ?? 0).getTime()
      );
    }
  
    // If one is PAID and the other is not → PAID first (optional)
    if (a.status === 'PAID' && b.status !== 'PAID') return -1;
    if (a.status !== 'PAID' && b.status === 'PAID') return 1;
  
    // Otherwise → sort by createdAt
    return (
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
    );
  });

  return (
    <>

    <div dir="rtl" className="min-h-screen bg-[#122035] px-4 py-6 no-print">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-white">
          الفواتير
          </h1>
        </header>

        {/* Creation section */}
        <section ref={formRef} className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-2xl font-bold text-slate-900">
          إنشاء فاتورة
          </h2>

          {/* Customer select / create */}
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <div>
              <form
                onSubmit={handleCustomerSearch}
                className="space-y-2 rounded-md border border-slate-200 p-3"
              >
                <div className="text-xl font-semibold text-slate-600">
                اختار الزبون
                </div>
                <div className="flex gap-2">
                <input
  value={customerSearch}
  onChange={(e) => {
    const value = arabicToEnglishDigits(e.target.value);
    setCustomerSearch(value);

    // debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchCustomers(value);
    }, 300);
  }}
  placeholder="البحث بالاسم أو الهاتف"
  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
/>
<button
  type="button"
  onClick={() => {
    setCustomerSearch('');
    setSelectedCustomer(null);
    setCustomerResults([]);
  }}
  className="rounded-md bg-emerald-600 px-3 py-2 text-base font-semibold text-white hover:bg-rose-700"
>
   الغاء الاختيار
</button>
                </div>
                {customerResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 text-sm">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerResults([]);
                          setCustomerSearch(
                            `${c.name} (${c.phone})`,
                          );
                        }}
                        className={`flex w-full items-center justify-between px-2 py-1 text-left hover:bg-slate-100 ${
                          selectedCustomer?.id === c.id
                            ? 'bg-sky-50'
                            : ''
                        }`}
                      >
                        <span>{c.name}</span>
                        <span className="text-xs text-slate-500">
                          {c.phone}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedCustomer && (
                  <div className="mt-1 text-xs text-emerald-700">
                    الزبون المحدد: {selectedCustomer.name} ({selectedCustomer.phone})
                  </div>
                )}
              </form>
              {errors.customer && (
  <p className="mt-2 text-xs text-rose-600">{errors.customer}</p>
)}
            </div>

            <div>
              <form
                onSubmit={handleCreateCustomerInline}
                className="space-y-2 rounded-md border border-slate-200 p-3"
              >
                <div className="text-xl font-semibold text-slate-600">
                إضافة زبون جديد
                </div>
                <input
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="الاسم"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <input
                  
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(arabicToEnglishDigits(e.target.value.replace(/[^0-9٠-٩]/g, '')))}
                  placeholder="الرقم"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                {errors.createCustomer && (
  <div className="text-xs text-rose-600 mt-1">
    {errors.createCustomer}
  </div>
)}
                <button
                  type="submit"
                  className="rounded-md bg-emerald-600 px-3 py-2 text-base font-semibold text-white hover:bg-emerald-700"
                >
                  حفظ واختيار الزبون
                </button>
              </form>
              {existingCustomerMatch && (
  <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
    <div className="text-sm font-semibold text-amber-800">
      يوجد زبون بنفس الاسم
    </div>

    <div className="text-sm text-slate-700">
      {existingCustomerMatch.name}
      {existingCustomerMatch.phone && ` – ${existingCustomerMatch.phone}`}
    </div>

    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => {
          setSelectedCustomer(existingCustomerMatch);
          setCustomerResults([]);
          setCustomerSearch(
            `${existingCustomerMatch.name}${
              existingCustomerMatch.phone ? ` (${existingCustomerMatch.phone})` : ''
            }`
          );
          setExistingCustomerMatch(null);
          setNewCustName('');
          setNewCustPhone('');
        }}
        className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
      >
        استخدمه
      </button>

      <button
        type="button"
        onClick={async () => {
          await createCustomer(newCustName.trim(), newCustPhone.trim() || null);
          setExistingCustomerMatch(null);
        }}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        أنشئ زبون جديد
      </button>
    </div>
  </div>
)}
            </div>
          </div>

          {/* Items table */}
          <form onSubmit={handleSaveInvoice} className="space-y-3">
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-full text-right text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-base uppercase text-slate-500">
                    <th className="px-3 py-2">نوع الغرض</th>
                    <th className="px-3 py-2"> نوع الخدمة</th>
                    <th className="px-3 py-2 text-right">العدد</th>
                    <th className="px-3 py-2 text-right">
                    تغيير على سعر القطعة
                      <span className="block text-[10px] text-slate-400">
                        
                      </span>
                    </th>
                    <th className="px-3 py-2 text-right">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {draftItems.map((row, idx) => (
                    <tr key={row.id} className="border-b last:border-0">
                      
                      <td className="px-3 py-2"> 
                      

                      <div className="flex flex-col gap-2">
  {/* Frequent items as buttons */}
  <div className="flex flex-wrap gap-2">
    {items
      .filter((i) => i.active && frequentItemIds.includes(i.id))
      .map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => updateDraftRow(row.id, { itemId: i.id })}
          className={`px-3 py-1 rounded-md font-semibold border transition ${
            row.itemId === i.id
              ? 'bg-sky-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {i.name}
        </button>
      ))}
  </div>

  {/* Dropdown for all other items, sorted by otherItemIds */}
  <select
    value={row.itemId}
    onChange={(e) =>
      updateDraftRow(row.id, {
        itemId: e.target.value ? Number(e.target.value) : '',
      })
    }
    className="w-full rounded-md border border-slate-300 px-2 py-1 font-semibold focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
  >
    <option value="">اختيار نوع اخر</option>
    {otherItemIds
  .map((id) => items.find((i) => i.id === id))
  .filter((i): i is Item => !!i && i.active) // ensures i is defined and active
  .map((i) => (
    <option key={i.id} value={i.id}>
      {i.name}
    </option>
  ))}
  </select>
</div>
                      </td>
                      <td className="px-3 py-2">
                      <div className="flex flex-col gap-2 flex-wrap ">
  {services.map((s) => (
    <button
      key={s.id}
      type="button"
      onClick={() =>
        updateDraftRow(row.id, { serviceTypeId: s.id })
      }
      className={`px-3 py-1 rounded-md font-semibold border transition
        ${
          row.serviceTypeId === s.id
            ? 'bg-sky-600 text-white border-sky-600'
            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
        }`}
    >
      {s.name}
    </button>
  ))}
</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                      <div className="flex items-center gap-1">
  {/* Decrease */}
  <button
    type="button"
    onClick={() =>
      updateDraftRow(row.id, {
        quantity: Math.max(1, (row.quantity || 1) - 1),
      })
    }
    className="w-8 h-8 flex items-center justify-center bg-slate-200 rounded-md text-lg font-bold hover:bg-slate-300 transition"
  >
    -
  </button>

  {/* Input */}
  <input
    type="number"
    min={1}
    value={row.quantity}
    onChange={(e) =>
      updateDraftRow(row.id, {
        quantity: Number(e.target.value) || 1,
      })
    }
    className="w-16 text-center rounded-md border border-slate-300 px-2 py-1 text-base font-bold focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 appearance-none"
    style={{ MozAppearance: 'textfield' }} // removes arrows in Firefox
  />

  {/* Increase */}
  <button
    type="button"
    onClick={() =>
      updateDraftRow(row.id, {
        quantity: (row.quantity || 1) + 1,
      })
    }
    className="w-8 h-8 flex items-center justify-center bg-sky-600 rounded-md text-white font-bold hover:bg-sky-700 transition"
  >
    +
  </button>
</div>
                      </td>
                      <td className="px-3 py-2 text-right">
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={formatWithCommas(row.adjustedAmount)}
        onChange={(e) => {
          const raw = arabicToEnglishDigits(
            e.target.value.replace(/[^0-9٠-٩\-\,]/g, '')
          );

          updateDraftRow(row.id, {
            adjustedAmount: stripCommas(raw),
          });
        }}
        placeholder="0"
        className="w-28 text-center rounded-md border border-slate-300 px-2 py-1 text-base font-bold focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      />

      <button
        type="button"
        onClick={() => {
          const current = String(row.adjustedAmount || '');
          const toggled = current.startsWith('-')
            ? current.slice(1)
            : '-' + current;

          updateDraftRow(row.id, {
            adjustedAmount: toggled,
          });
        }}
        className={`w-8 h-8 flex items-center justify-center rounded-md font-bold border transition ${
          String(row.adjustedAmount || '').startsWith('-')
            ? 'bg-red-500 text-white'
            : 'bg-slate-200'
        } hover:bg-red-400`}
      >
        −
      </button>
    </div>

    {/* Quick add */}
     
  {/* − (subtract 50,000) */}
   {/* +50,000 */}
   <div className='flex'>
   <button
    type="button"
    onClick={() => {
      const current = Number(stripCommas(row.adjustedAmount || '0'));
      const next = current + 50000;
      updateDraftRow(row.id, {
        adjustedAmount: String(next),
      });
    }}
    className="w-8 h-7 flex items-center justify-center rounded-md border border-slate-300 bg-emerald-100 text-sm font-bold text-emerald-700 hover:bg-emerald-200"
  >
    +50
  </button>
  <button
    type="button"
    onClick={() => {
      const current = Number(stripCommas(row.adjustedAmount || '0'));
      const next = current - 50000;
      updateDraftRow(row.id, {
        adjustedAmount: String(next),
      });
    }}
    className="w-8 h-7 flex items-center justify-center rounded-md border border-slate-300 bg-red-100 text-sm font-bold text-red-700 hover:bg-red-200"
  >
    −50
  </button>
  </div>
 

  </div>
</td>
                      
                      <td className="px-3 py-2 text-right">
                        {draftItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDraftRow(row.id)}
                            className="rounded border border-rose-300 px-2 py-1 text-base font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            ازالة الصف
                          </button>
                        )}
                        {idx === draftItems.length - 1 && (
                          <button
                            type="button"
                            onClick={addDraftRow}
                            className="ml-2 rounded border border-slate-300 px-2 py-1 text-base font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            اضافة صف
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {errors.items && (
  <p className="px-1 pt-2 text-xs text-rose-600">{errors.items}</p>
)}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 items-start">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-base font-semibold text-slate-600">
                ملحوظات
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-base font-semibold focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  placeholder="ملاحظات اختيارية لهذه الفاتورة"
                />
              </div>
              <div className="flex flex-col items-end gap-2">
              
             <div><button
  type="submit"
  className="rounded-md bg-emerald-600 px-4 py-2 text-xl font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
  disabled={creating}
>
  {creating
    ? editingInvoice
      ? 'جارٍ الحفظ…'
      : 'جارٍ الإنشاء…'
    : editingInvoice
    ? 'حفظ التعديل'
    : 'إنشاء فاتورة'}
</button>

{editingInvoice && (
  <button
    type="button"
    onClick={() => {
      setEditingInvoice(null);
      setDraftItems([{ id: 1, itemId: '', serviceTypeId: '', quantity: 1, adjustedAmount: '' }]);
      setNotes('');
      setSelectedCustomer(null);
    }}
    className="rounded-md bg-slate-600 px-4 py-2  text-xl font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
  >
    إلغاء التعديل
  </button>
)}
</div>

                {errors.general && (
  <p className="mt-2 text-xs text-rose-600 text-right">{errors.general}</p>
)}
                {selectedCustomer && (
                  <div className="text-xs text-slate-500 text-right">
                     الزبون المحدد: {selectedCustomer.name} (
                    {selectedCustomer.phone})
                  </div>
                )}
              </div>
            </div>
          </form>
        </section>

        {/* Filters + pay by ticket */}
        <section className="rounded-lg bg-white p-4 shadow-sm space-y-4">

          <form
            onSubmit={handlePayByTicket}
            className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3"
          >
            <div className="flex-1 min-w-[160px]">

              <label className="mb-1 block text-3xl py-3 font-bold text-black-600">
               دفع فاتورة 
              </label>
              <input
  ref={ticketInputRef}
  value={payTicketNumber}
  onChange={(e) => {
    const raw = arabicToEnglishDigits(
      e.target.value.replace(/[^0-9٠-٩]/g, '')
    );
    // always keep only the *last* 6 digits → overwrite behaviour
    const digits = raw.slice(-6);
    setPayTicketNumber(digits);
  }}
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      // prevent the scanner's Enter from submitting immediately
      e.preventDefault();
      // if you want: move focus to adjust field here
      // adjustInputRef.current?.focus();
    }
  }}
  placeholder="مسح  بالجهاز أو كتابة الفاتورة"
  className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
/>
            </div>
            <div>
              <label className="mb-1 block text-base font-semibold text-slate-600">
              التعديل على سعر الفاتورة
                
              </label>
              <div>

  {/* Input + sign toggle */}
  <div className="flex items-center gap-2">
    <input
      type="text"
      value={formatWithCommas(payAdjustedAmount)}
      onChange={(e) => {
        const raw = arabicToEnglishDigits(
          e.target.value.replace(/[^0-9٠-٩\-\,\.]/g, '')
        );
        setPayAdjustedAmount(stripCommas(raw));
      }}
      placeholder="0"
      className="w-32 rounded-md border border-slate-300 px-3 py-2 text-xl text-right focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
    />

    {/* Toggle sign */}
    <button
      type="button"
      onClick={() => setPayAdjustedAmount((prev) => toggleNegative(prev))}
      className={`w-8 h-8 flex items-center justify-center rounded-md font-bold border transition ${
        payAdjustedAmount.startsWith('-')
          ? 'bg-red-500 text-white'
          : 'bg-slate-200'
      }`}
    >
      −
    </button>
  </div>

  {/* Quick adjust buttons */}
  <div className="mt-1 flex justify-start gap-1">

    {/* +100K */}
    <button
      type="button"
      onClick={() => {
        const current = Number(stripCommas(payAdjustedAmount || '0'));
        setPayAdjustedAmount(String(current + 100000));
      }}
      className="w-8 h-7 flex items-center justify-center rounded-md border border-slate-300 bg-emerald-100 text-sm font-bold text-emerald-700 hover:bg-emerald-200"
    >
      +100
    </button>
    {/* −100K */}
    <button
      type="button"
      onClick={() => {
        const current = Number(stripCommas(payAdjustedAmount || '0'));
        setPayAdjustedAmount(String(current - 100000));
      }}
      className="w-8 h-7 flex items-center justify-center rounded-md border border-slate-300 bg-red-100 text-sm font-bold text-red-700 hover:bg-red-200"
    >
      −100
    </button>

  </div>
</div>
            </div>
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-4 py-2 text-xl font-bold text-white hover:bg-emerald-700"
            >
              وضع الفاتورة أنها مدفوعة
            </button>
            {errors.invoice && (
  <div className="text-xs text-rose-600 mt-1">
    {errors.invoice}
  </div>
)}
          </form>
        </section>

        {/* Invoice list */}
        <section className="rounded-lg bg-white p-4 shadow-sm">
        <div>
  <label className="text-2xl font-bold">بحث عن فاتورة</label>

  <div className="flex flex-wrap items-end gap-3 my-4">
    {/* Date Filter Buttons */}
    <button
  type="button"
  onClick={() => {
    const today = formatDateYYYYMMDD(new Date());
    setStartDate(today);
    setEndDate(today);
    loadInvoices(today, today, { status: statusFilter, search: searchFilter });
  }}
  className={dateBtnClass(isTodayActive())}
>
  اليوم
</button>

<button
  type="button"
  onClick={() => {
    const { monday, saturday } = getWeekRange(new Date());
    const start = formatDateYYYYMMDD(monday);
    const end = formatDateYYYYMMDD(saturday);

    setStartDate(start);
    setEndDate(end);
    loadInvoices(start, end, { status: statusFilter, search: searchFilter });
  }}
  className={dateBtnClass(isThisWeekActive())}
>
  هذا الأسبوع
</button>

<button
  type="button"
  onClick={() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const start = formatDateYYYYMMDD(firstDay);
    const end = formatDateYYYYMMDD(lastDay);

    setStartDate(start);
    setEndDate(end);
    loadInvoices(start, end, { status: statusFilter, search: searchFilter });
  }}
  className={dateBtnClass(isThisMonthActive())}
>
  هذا الشهر
</button>

    {/* Status */}
    <div>
      <label className="mb-1 block text-base font-semibold text-slate-600">
        الحالة
      </label>
      <select
        value={statusFilter}
        onChange={(e) => {
          const v = e.target.value as typeof statusFilter;
          setStatusFilter(v);
          // call loader immediately with the new status (keep current days/search)
          void loadInvoices(undefined, undefined, { status: v, days: daysFilter, search: searchFilter });
        }}
        className="rounded-md border border-slate-300 px-3 py-1 text-xl font-semibold focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      >
        <option value="ALL">الكل</option>
        <option value="OPEN">غير مدفوعة</option>
        <option value="PAID">مدفوعة</option>
        <option value="CANCELED">ملغاة</option>
      </select>
    </div>

   
    {/* Search */}
    <div className="flex-1 min-w-[160px]">
      <label className="mb-1 block text-xl font-semibold text-slate-600">
        البحث (رقم الفاتورة، الاسم، الهاتف)
      </label>
      <input
          value={searchFilter}
          onChange={(e) => setSearchFilter(arabicToEnglishDigits(e.target.value))}
          
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-xl focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        placeholder="اكتب ثم اضغط بحث"
      />
    </div>

    {/* Action buttons */}
    

    <button
       type="button"
       onClick={() => {
         setStatusFilter('OPEN');
         setDaysFilter('7');
         setSearchFilter('');
         setStartDate(undefined);
         setEndDate(undefined);
         void loadInvoices(undefined, undefined, { status: 'OPEN', days: '7', search: '' });
       }}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xl font-bold text-slate-700 hover:bg-slate-100"
    >
      اعادة ضبط
    </button>
  </div>

  <br />
</div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">
            قائمة الفواتير
            </h2>
            <span className="text-base font-semibold text-slate-500">
              {invoices.length.toLocaleString("ar-LB")} فواتير
            </span>
          </div>

          {invoices.length === 0 ? (
            <p className="text-base font-semibold text-slate-500">
              لم يتم العثور على فواتير
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-right text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-xl font-semibold uppercase text-slate-500">
                    <th className="px-3 py-2">رقم الفاتورة</th>
                    <th className="px-3 py-2">الزبون</th>
                    <th className="px-3 py-2">الحالة</th>
                    <th className="px-3 py-2">التاريخ</th>
                    <th className="px-3 py-2 text-right">المبلغ</th>
                    <th className="px-3 py-2 text-right">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                 {sortedInvoices.map((inv) => (
  <tr key={inv.id} className="border-b last:border-0">
    <td className="px-3 py-2 font-mono text-xl font-semibold text-slate-700">
      {inv.ticketNumber.split('-').pop()}
    </td>
    <td className="px-3 py-2">
      <div className="text-slate-900 text-base font-semibold">
        {inv.customer.name}
      </div>
      <div className="text-base text-slate-500">{inv.customer.phone}</div>
    </td>
    <td className="px-3 py-2 text-base font-semibold">
      <span
        className={`rounded px-2 py-1 ${
          inv.status === 'OPEN'
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : inv.status === 'READY'
            ? 'bg-sky-50 text-sky-700 border border-sky-200'
            : inv.status === 'PAID'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200' // for CANCELED
        }`}
      >
        {inv.status === 'OPEN'
          ? 'غير مدفوعة'
          : inv.status === 'READY'
          ? 'جاهزة'
          : inv.status === 'PAID'
          ? 'مدفوعة'
          : 'ملغاة'}
      </span>
    </td>
    <td className="px-3 py-2 text-base font-semibold text-slate-500">
  <div>
    {new Date(inv.createdAt).toLocaleString('ar-LB', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'long',
    })}
  </div>

  {inv.status === 'PAID' && inv.paidAt && (
    <div className="mt-1 text-sm font-medium text-emerald-600">
      مدفوعة:
      {' '}
      {new Date(inv.paidAt).toLocaleString('ar-LB', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        weekday: 'long',
      })}
    </div>
  )}
</td>
    <td className="px-3 py-2 text-right text-xl font-semibold text-slate-900">
      {inv.total.toLocaleString('en-LB', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}
    </td>
    <td className="px-3 py-2 text-right text-xl font-semibold flex gap-2 justify-end">
      {/* View button */}
      <button
        type="button"
        onClick={() => {
          handleView(inv);
          document.body.classList.add('modal-open');
        }}
        className="mr-2 rounded border border-slate-300 px-2 py-1 hover:bg-slate-100"
      >
        عرض 
      </button>

      {/* Print button */}
      <button
        type="button"
        onClick={() => handlePrint(inv)}
        className="bg-sky-50 text-sky-700 border border-sky-200 rounded px-2 py-1 hover:bg-slate-100"
      >
        طباعة 
      </button>



      {/* Edit button (only if not canceled or paid) */}
      {inv.status !== 'PAID' && inv.status !== 'CANCELED' && (
        <button
          type="button"
          onClick={() => handleEditInvoice(inv)}
          className="bg-yellow-50 text-yellow-700 border border-yellow-200 rounded px-2 py-1 hover:bg-yellow-100"
        >
          تعديل
        </button>
      )}

      {/* Cancel button (only if not paid or already canceled) */}
      {inv.status !== 'PAID' && inv.status !== 'CANCELED' && (
        <button
          type="button"
          onClick={async () => {
            if (!confirm('هل أنت متأكد من إلغاء هذه الفاتورة؟')) return;
            const res = await fetch('/api/invoices', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: inv.id, status: 'CANCELED' }),
            });
            if (res.ok) {
              const updated = await res.json();
              setInvoices((prev) =>
                prev.map((i) => (i.id === updated.id ? updated : i))
              );
            }
          }}
          className="bg-red-50 text-red-700 border border-red-200 rounded px-2 py-1 hover:bg-red-100"
        >
          إلغاء
        </button>
      )}
    </td>
    
  </tr>
))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>

         {/* Inline selected invoice view (optional) */}
         {selectedInvoice && (
  <div
    dir="rtl"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
  >
    {/* Buttons: show on screen only, hide when printing */}
    <div className="text-4xl mt-4 flex gap-5 flex-col no-print px-4 bg-white p-5">
        <button
          type="button"
          onClick={() => {closeInvoiceView();
            document.body.classList.remove('modal-open')
          }}
          className="rounded-md border border-slate-300 px-4 py-2  text-slate-700 hover:bg-slate-100"
        >
          إغلاق
        </button>
        <button
          type="button"
          onClick={() => handlePrint(selectedInvoice)}
          className="rounded-md bg-emerald-600 px-4 py-2  font-medium text-white hover:bg-emerald-700"
        >
          طباعة
        </button>
      </div>
    
    <div className=" invoice-modal max-w-lg w-full rounded-lg bg-white p-6 shadow-lg invoice-print">
      
      {/* Header */}
      <img 
  style={{ width: '100%', height: 'auto' }}
  src="/logo.png"
  alt="Laundry Logo"
  className="mx-auto mb-2 h-12 print:h-14"
/>
      <div className="flex items-start justify-between gap-4 border-b pb-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            فاتورة #{selectedInvoice.ticketNumber}
          </h2>
          <p className="text-xl text-black-500">
            {new Date(selectedInvoice.createdAt).toLocaleString('ar-LB', {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              weekday: 'long',
            })}
          
          </p>
          <p className="mt-1 text-3xl font-bold text-black-700">
            {selectedInvoice.customer.name} – {selectedInvoice.customer.phone}
          </p>
        </div>

       
      </div>

      {/* Items table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-sm uppercase text-slate-500">
              <th className="px-3 py-2">الصنف</th>
              <th className="px-3 py-2">الخدمة</th>
              <th className="px-3 py-2 text-right">العدد</th>
              <th className="px-3 py-2 text-right">سعر القطعة</th>
              <th className="px-3 py-2 text-right">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {selectedInvoice.items.map((it) => {
              const finalUnit = it.unitPrice + it.adjustedAmount;
              return (
                <tr key={it.id} className="border-b last:border-0">
                  <td className="px-3 py-2 text-base font-bold">{it.item.name}</td>
                  <td className="px-3 py-2 text-base font-bold">{it.serviceType.name}</td>
                  <td className="px-3 py-2 text-right text-base font-bold">{it.quantity}</td>
                  <td className="px-3 py-2 text-right text-base font-bold">
                    {finalUnit.toLocaleString('en-LB', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="px-3 py-2 text-right text-base font-bold">
                    {it.lineTotal.toLocaleString('en-LB', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mt-3 text-right text-base text-slate-800 space-y-1">
        <div>
          المجموع الفرعي:{' '}
          {selectedInvoice.subtotal.toLocaleString('en-LB')} ل.ل
        </div>
        <div className="font-bold text-lg">
          التعديل:{' '}
          {selectedInvoice.adjustedAmount.toLocaleString('en-LB')} ل.ل
        </div>
        <div className="text-right space-y-1">
          <div className="font-bold text-2xl">
            الإجمالي:{' '}
            {selectedInvoice.total.toLocaleString('en-LB')} ل.ل
          </div>
          <div className="text-2xl text-black-500 font-bold">
            ≈{' '}
            {(
              selectedInvoice.total / USD_RATE
            ).toLocaleString('en-LB', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            $
          </div>
          {selectedInvoice.status === 'PAID' && (
  <div className="mt-2 inline-block rounded-md px-4 py-1 text-3xl font-bold text-emerald-700 print:text-black">
    واصل
  </div>
)}
        </div>
         {/* Barcode (for scanner) */}
         <div className="flex flex-col items-center py-3">
          <Barcode
            value={selectedInvoice.ticketNumber.split('-').pop() || ''}
            format="CODE128"
            width={4.5}
            height={45}
            margin={0}
            displayValue={true}
            fontSize={10}
          />
        </div>
      </div>

      
    </div>
  </div>
)}


    </>
  );
}