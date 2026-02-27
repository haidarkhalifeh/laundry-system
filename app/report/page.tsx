// app/report/page.tsx
'use client';

import { useEffect, useState } from 'react';


const USD_RATE = 90000;
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

type InvoiceListItem = {
  id: number;
  ticketNumber: string | null;
  customer: { id: number | null; name: string; phone?: string } | null;
  createdAt: string;
  total: number;
  paidAt: string | null;
};

type TopInvoiceItem = {
  id: number;
  ticketNumber: string | null;
  customer: { id: number | null; name: string } | null;
  createdAt: string;
  total: number;
};

type ReportResponse = {
  from: string;
  to: string;
  revenueTotal: number;
  revenueInvoiceCount: number;
  expenseTotal: number;
  expenseCount: number;
  netTotal: number;
  topItems?: TopItem[];
  topCustomers?: TopCustomer[];
  invoicesList?: InvoiceListItem[];
  topInvoices?: TopInvoiceItem[];
  createdInvoicesCount: number;
  createdInvoicesTotal: number;
  notPaidInvoicesCount: number;
  notPaidInvoicesTotal: number;
};

const todayStr = new Date().toISOString().slice(0, 10);
function formatDateArabic(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ar-LB", {
    weekday: "long",   // اسم اليوم
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}
function startOfWeekMonday(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday=0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function saturdayOfWeekFromMonday(monday: Date) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 5);
  d.setHours(23, 59, 59, 999);
  return d;
}

function firstDayOfMonth(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function lastDayOfMonth(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export default function ReportPage() {
 

  const [unlocked, setUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const REPORT_CODE = 'mukhtar2009'; // change to anything you want

  const [from, setFrom] = useState<string>(todayStr);
  const [to, setTo] = useState<string>(todayStr);

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportResponse | null>(null);

  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const [includeTopItems, setIncludeTopItems] = useState(true);
  const [includeTopCustomers, setIncludeTopCustomers] = useState(true);
  const [includeInvoices, setIncludeInvoices] = useState(true);
  const [includeTopInvoices, setIncludeTopInvoices] = useState(true);

  const [topItemsLimit, setTopItemsLimit] = useState<number>(10);
  const [topInvoicesLimit, setTopInvoicesLimit] = useState<number>(10);

  const [excludeItems, setExcludeItems] = useState<string>('');
  const [excludeCustomers, setExcludeCustomers] = useState<string>('');
  const [excludeInvoices, setExcludeInvoices] = useState<string>('');
  const [excludeTopInvoices, setExcludeTopInvoices] = useState<string>('');

  const [loadingMsg, setLoadingMsg] = useState<string>('');

  async function loadReport(customFrom?: string, customTo?: string) {
    setLoading(true);
    setLoadingMsg('جاري تحميل التقرير...');
    const params = new URLSearchParams();
    params.set('from', customFrom ?? from);
    params.set('to', customTo ?? to);
    params.set('period', period);

    params.set('includeTopItems', includeTopItems ? '1' : '0');
    params.set('includeTopCustomers', includeTopCustomers ? '1' : '0');
    params.set('includeInvoices', includeInvoices ? '1' : '0');
    params.set('includeTopInvoices', includeTopInvoices ? '1' : '0');

    params.set('topItemsLimit', String(topItemsLimit || 10));
    params.set('topInvoicesLimit', String(topInvoicesLimit || topItemsLimit || 10));

    if (excludeItems.trim()) params.set('excludeItems', excludeItems.trim());
    if (excludeCustomers.trim()) params.set('excludeCustomers', excludeCustomers.trim());
    if (excludeInvoices.trim()) params.set('excludeInvoices', excludeInvoices.trim());
    if (excludeTopInvoices.trim()) params.set('excludeTopInvoices', excludeTopInvoices.trim());

    try {
      const res = await fetch(`/api/report?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'فشل تحميل التقرير');
        setLoading(false);
        setLoadingMsg('');
        return;
      }
      const data = (await res.json()) as ReportResponse;
      setReport(data);
      setFrom(data.from);
      setTo(data.to);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      alert('فشل الاتصال بالخادم.');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPeriod(p: 'daily' | 'weekly' | 'monthly') {
    setPeriod(p);
    const now = new Date();
    if (p === 'daily') {
      const d = new Date().toISOString().slice(0, 10);
      setFrom(d);
      setTo(d);
      loadReport(d, d);
    } else if (p === 'weekly') {
      const monday = startOfWeekMonday(now);
      const saturday = saturdayOfWeekFromMonday(monday);
      const f = monday.toISOString().slice(0, 10);
      const t = saturday.toISOString().slice(0, 10);
      setFrom(f);
      setTo(t);
      loadReport(f, t);
    } else {
      const fDate = firstDayOfMonth(now);
      const lDate = lastDayOfMonth(now);
      const f = fDate.toISOString().slice(0, 10);
      const t = lDate.toISOString().slice(0, 10);
      setFrom(f);
      setTo(t);
      loadReport(f, t);
    }
  }

  const revenue = report?.revenueTotal ?? 0;
  const expenses = report?.expenseTotal ?? 0;
  const net = report?.netTotal ?? 0;

  if (!unlocked) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#122035]">
        <div className="bg-white p-8 rounded-xl shadow w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold mb-4">تقرير المصبغة 🔒</h1>
          <p className="text-gray-500 mb-4">أدخل رمز الدخول</p>
  
          <input
            type="password"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="رمز الدخول"
            className="w-full border rounded-md px-4 py-2 mb-4 text-center text-lg"
          />
  
          <button
            onClick={() => {
              if (codeInput === REPORT_CODE) {
                setUnlocked(true);
              } else {
                alert('رمز غير صحيح');
              }
            }}
            className="w-full bg-emerald-600 text-white py-2 rounded-md font-bold"
          >
            دخول
          </button>
        </div>
      </div>
    );
  }
  return (
    <div dir="rtl" className="bg-[#122035] min-h-screen print:min-h-auto px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <h1 className="text-3xl font-extrabold text-white">تقرير المصبغة</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-lg font-semibold text-white hover:bg-emerald-700"
            >
              طباعة
            </button>
          </div>
        </header>

        {/* Controls */}
        <section className="rounded-lg bg-white p-6 shadow-sm print:border print:shadow-none no-print">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-lg font-semibold text-slate-700">الفترة</div>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={() => applyPeriod('daily')}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${
                    period === 'daily' ? 'bg-sky-600 text-white' : 'border border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  يومي
                </button>
                <button
                  type="button"
                  onClick={() => applyPeriod('weekly')}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${
                    period === 'weekly' ? 'bg-sky-600 text-white' : 'border border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  أسبوعي (من الإثنين إلى السبت)
                </button>
                <button
                  type="button"
                  onClick={() => applyPeriod('monthly')}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${
                    period === 'monthly' ? 'bg-sky-600 text-white' : 'border border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  شهري
                </button>

                <div className="ml-auto flex gap-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">من</label>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">إلى</label>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="self-end">
                    <button
                      type="button"
                      onClick={() => loadReport()}
                      disabled={loading}
                      className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                      {loading ? 'جاري التحميل…' : 'تطبيق'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Options */}
            <div>
              <div className="mb-2 text-lg font-semibold text-slate-700">الخيارات</div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-600">الأصناف الأكثر مبيعاً / الخدمات</div>
                    <div className="text-xs text-slate-400">إظهار أو إخفاء قائمة الأصناف الأكثر مبيعاً</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="includeTopItems"
                      type="checkbox"
                      checked={includeTopItems}
                      onChange={() => setIncludeTopItems((v) => !v)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="includeTopItems" className="text-sm text-slate-700">تضمين</label>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-600">أهم الزبائن</div>
                    <div className="text-xs text-slate-400">إظهار أو إخفاء الزبائن الأكثر تكراراً</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="includeTopCustomers"
                      type="checkbox"
                      checked={includeTopCustomers}
                      onChange={() => setIncludeTopCustomers((v) => !v)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="includeTopCustomers" className="text-sm text-slate-700">تضمين</label>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-600">عرض الفواتير في الفترة</div>
                    <div className="text-xs text-slate-400">قائمة الفواتير المكتسبة خلال الفترة</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="includeInvoices"
                      type="checkbox"
                      checked={includeInvoices}
                      onChange={() => setIncludeInvoices((v) => !v)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="includeInvoices" className="text-sm text-slate-700">تضمين</label>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-600">الفواتير الكبرى (Top invoices)</div>
                    <div className="text-xs text-slate-400">عرض أعلى الفواتير من حيث المبلغ</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="includeTopInvoices"
                      type="checkbox"
                      checked={includeTopInvoices}
                      onChange={() => setIncludeTopInvoices((v) => !v)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="includeTopInvoices" className="text-sm text-slate-700">تضمين</label>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">عرض أعلى عدد أصناف</label>
                    <input
                      type="number"
                      min={1}
                      value={topItemsLimit}
                      onChange={(e) => setTopItemsLimit(Number(e.target.value || 1))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">عرض أعلى عدد فواتير</label>
                    <input
                      type="number"
                      min={1}
                      value={topInvoicesLimit}
                      onChange={(e) => setTopInvoicesLimit(Number(e.target.value || 1))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">استبعاد أصناف (مفصول بفواصل)</label>
                    <input
                      value={excludeItems}
                      onChange={(e) => setExcludeItems(e.target.value)}
                      placeholder="مثال: فوط,بطانيات"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">استبعاد زبائن (مفصول بفواصل)</label>
                    <input
                      value={excludeCustomers}
                      onChange={(e) => setExcludeCustomers(e.target.value)}
                      placeholder="مثال: احمد,محمود"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">استبعاد فواتير (أرقام مفصولة بفواصل)</label>
                    <input
                      value={excludeInvoices}
                      onChange={(e) => setExcludeInvoices(e.target.value)}
                      placeholder="مثال: 123,456"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">استبعاد من Top invoices (أرقام مفصولة بفواصل)</label>
                    <input
                      value={excludeTopInvoices}
                      onChange={(e) => setExcludeTopInvoices(e.target.value)}
                      placeholder="مثال: 789,101"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Summary */}
        {/* Created Invoices Total */}
  <div className="rounded-lg bg-white p-6 shadow-sm print:border print:shadow-none">
    <div className="text-sm font-semibold uppercase text-slate-500">
      إجمالي الفواتير المُنشأة
    </div>
    <div className="mt-3 text-3xl font-extrabold text-slate-900">
      {(report?.createdInvoicesTotal ?? 0).toLocaleString('en-LB', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} ل.ل
    </div>
    <div className="text-xl text-black-500 font-bold">
      ≈{' '}
      {((report?.createdInvoicesTotal ?? 0) / USD_RATE).toLocaleString('en-LB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}{' '}
      $
    </div>
    <div className="mt-2 text-sm text-slate-500">
      {report?.createdInvoicesCount ?? 0} فاتورة تم إنشاؤها خلال الفترة
      </div>
  </div>

          {/* not paid invoices total*/}
          <div className="rounded-lg bg-white p-6 shadow-sm print:border print:shadow-none">
    <div className="text-sm font-semibold uppercase text-slate-500">
      إجمالي الفواتير الموجودة
    </div>
    <div className="mt-3 text-3xl font-extrabold text-slate-900">
      {(report?.notPaidInvoicesTotal ?? 0).toLocaleString('en-LB', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} ل.ل
    </div>
    <div className="text-xl text-black-500 font-bold">
      ≈{' '}
      {((report?.notPaidInvoicesTotal ?? 0) / USD_RATE).toLocaleString('en-LB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}{' '}
      $
    </div>
    <div className="mt-2 text-sm text-slate-500">
      {report?.notPaidInvoicesCount ?? 0} فاتورة تم إنشاؤها خلال الفترة
      </div>
  </div>

  
        <section className="grid gap-4 grid-cols-1">
          <div className="rounded-lg bg-white p-6 shadow-sm print:border print:shadow-none">
            <div className="text-sm font-semibold uppercase text-slate-500">إجمالي الفواتير المدفوعة</div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900">
              <div>{revenue.toLocaleString('en-LB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ل.ل
              </div>
              
                <div className="text-2xl text-black-500 font-bold">
            ≈{' '}
            {
              (revenue/USD_RATE).toLocaleString('en-LB', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            $
          </div>
              
            </div>
            <div className="mt-2 text-sm text-slate-500">{report?.revenueInvoiceCount ?? 0} فاتورة</div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm print:border print:shadow-none">
            <div className="text-sm font-semibold uppercase text-slate-500">إجمالي المصروفات</div>
            <div className="mt-3 text-3xl font-extrabold text-rose-900">
              <div>{expenses.toLocaleString('en-LB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ل.ل
              </div>
              
                <div className="text-2xl text-black-500 font-bold">
            ≈{' '}
            {
              (expenses/USD_RATE).toLocaleString('en-LB', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            $
          </div>
              
            </div>
            <div className="mt-2 text-sm text-slate-500">{report?.expenseCount ?? 0} مصروف</div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm print:border print:shadow-none">
            <div className="text-sm font-semibold uppercase text-slate-500">الصافي (إيراد - مصروف)</div>
            <div className={'mt-3 text-3xl font-extrabold ' + (net >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
              <div>{net.toLocaleString('en-LB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ل.ل
              </div>
              
                <div className="text-2xl text-black-500 font-bold">
            ≈{' '}
            {
              (net/USD_RATE).toLocaleString('en-LB', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            $
          </div>
              
            </div>
            <div className="mt-2 text-xl font-bold text-slate-500">الفترة: 
              <div>{formatDateArabic(report?.from || from)}</div>
              <div>{formatDateArabic(report?.to || to)}</div>
            </div>
          </div>
        </section>

        {/* Top Items */}
        {includeTopItems && (
  <section className="rounded-lg bg-white p-6  print:p-4 shadow-sm print:border print:shadow-none">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-2xl font-bold text-slate-900">الأصناف الأعلى مبيعاً</h2>
      <span className="text-xl font-bold text-slate-500">{report?.topItems?.length ?? 0} صنف</span>
    </div>

    {!report || (report.topItems?.length ?? 0) === 0 ? (
      <p className="text-sm text-slate-500">لا توجد أصناف لعرضها.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full text-right text-xs font-light">
          <thead>
            <tr className="border-b bg-slate-50 uppercase text-slate-500">
              <th className="px-3 py-2">الصنف</th>
              <th className="px-3 py-2">الكمية</th>
              <th className="px-3 py-2">المبلغ (ل.ل)</th>
            </tr>
          </thead>
          <tbody>
            {report.topItems!.slice(0, topItemsLimit).map((it) => (
              <tr key={it.itemId} className="border-b last:border-0">
                <td className="px-3 py-2 text-slate-900">{it.itemName}</td>
                <td className="px-3 py-2 text-right text-slate-900">{it.quantity}</td>
                <td className="px-3 py-2 text-right text-slate-900">
                  {it.amount.toLocaleString('en-LB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
)}

        {/* Top Customers */}
        {includeTopCustomers && (
  <section className="rounded-lg bg-white p-6  print:p-4 shadow-sm print:border print:shadow-none">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-2xl font-bold text-slate-900">الزبائن الأكثر تكراراً</h2>
      <span className="text-xl font-bold text-slate-500">{report?.topCustomers?.length ?? 0} زبون</span>
    </div>

    {!report || (report.topCustomers?.length ?? 0) === 0 ? (
      <p className="text-sm text-slate-500">لا توجد معلومات عن الزبائن.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full text-right text-xs font-light">
          <thead>
            <tr className="border-b bg-slate-50 uppercase text-slate-500">
              <th className="px-3 py-2">الزبون</th>
              <th className="px-3 py-2">عدد الفواتير</th>
              <th className="px-3 py-2">المجموع (ل.ل)</th>
            </tr>
          </thead>
          <tbody>
            {report.topCustomers!.map((c) => (
              <tr key={String(c.customerId ?? c.name)} className="border-b last:border-0">
                <td className="px-3 py-2 text-slate-900 ">{c.name}</td>
                <td className="px-3 py-2 text-right text-slate-900">{c.invoiceCount}</td>
                <td className="px-3 py-2 text-right text-slate-900">
                  {c.amount.toLocaleString('en-LB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
)}

        {/* Invoices list */}
        {includeInvoices && (
  <section className="rounded-lg bg-white p-6 print:p-4 shadow-sm print:border print:shadow-none">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-2xl font-bold text-slate-900">قائمة الفواتير (الفترة)</h2>
      <span className="text-xl font-bold text-slate-500">{report?.invoicesList?.length ?? 0} فاتورة</span>
    </div>

    {!report || (report.invoicesList?.length ?? 0) === 0 ? (
      <p className="text-sm text-slate-500">لا توجد فواتير في هذه الفترة.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full text-right text-xs font-light">
          <thead>
            <tr className="border-b bg-slate-50 uppercase text-slate-500">
              <th className="px-3 py-2">رقم الفاتورة</th>
              <th className="px-3 py-2">الزبون</th>
              <th className="px-3 py-2">التاريخ</th>
              <th className="px-3 py-2">المبلغ (ل.ل)</th>
            </tr>
          </thead>
          <tbody>
            {report.invoicesList!.map((inv) => (
              <tr key={inv.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono  text-slate-700">{(inv.ticketNumber || "").split("-").pop() ?? inv.id}</td>
                <td className="px-3 py-2">
                  <div className="text-slate-900">{inv.customer?.name ?? 'غير معروف'}</div>
                  <div className="text-slate-500">{inv.customer?.phone ?? ''}</div>
                </td>
                <td className="px-3 py-2  text-black-500">
                  {new Date(inv.createdAt).toLocaleString('ar-LB', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                  })}
                </td>
                <td className="px-3 py-2 text-right text-slate-900">
                  {inv.total.toLocaleString('en-LB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
)}

        {/* Top Invoices */}
        {includeTopInvoices && (
  <section className="rounded-lg bg-white p-6 print:p-4 shadow-sm print:border print:shadow-none">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-2xl font-bold text-slate-900">أعلى الفواتير</h2>
      <span className="text-xl font-bold text-slate-500">{report?.topInvoices?.length ?? 0} فاتورة</span>
    </div>

    {!report || (report.topInvoices?.length ?? 0) === 0 ? (
      <p className="text-sm text-slate-500">لا توجد فواتير كبرى لعرضها.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full text-right text-xs font-light">
          <thead>
            <tr className="border-b bg-slate-50 uppercase text-slate-500">
              <th className="px-3 py-2">رقم الفاتورة</th>
              <th className="px-3 py-2">الزبون</th>
              <th className="px-3 py-2">التاريخ</th>
              <th className="px-3 py-2">المبلغ (ل.ل)</th>
            </tr>
          </thead>
          <tbody>
            {report.topInvoices!.map((inv) => (
              <tr key={inv.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-slate-700">{(inv.ticketNumber || "").split("-").pop() ?? inv.id}</td>
                <td className="px-3 py-2">
                  <div className="text-slate-900">{inv.customer?.name ?? 'غير معروف'}</div>
                </td>
                <td className="px-3 py-2 text-black-500">
                  {new Date(inv.createdAt).toLocaleString('ar-LB', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                  })}
                </td>
                <td className="px-3 py-2 text-right text-slate-900 ">
                  {inv.total.toLocaleString('en-LB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
)}
        <div className="text-sm text-slate-500">{loadingMsg}</div>
      </div>
    </div>
  );
}