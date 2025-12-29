'use client';

import { useEffect, useState } from 'react';

type Expense = {
  id: number;
  type: string;
  amount: number;
  createdAt: string; // ISO
};

const USD_RATE = 90000; // 1 USD = 90,000 LBP

function formatDateYYYYMMDD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// get Monday and Saturday of current week
function getWeekRange(d: Date) {
  const day = d.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7)); // shift to Monday
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5); // Monday + 5 = Saturday
  return { monday, saturday };
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [days, setDays] = useState('1');

  // form state
  const [formId, setFormId] = useState<number | null>(null);
  const [formDate, setFormDate] = useState(formatDateYYYYMMDD(new Date()));
  const [formType, setFormType] = useState('');
  const [formAmount, setFormAmount] = useState(''); // formatted with commas

  // load expenses
  async function loadExpenses(from?: string, to?: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (days.trim()) params.set('days', days.trim());

    if (from) params.set('from', from);
    if (to) params.set('to', to);

    const res = await fetch(`/api/expenses?${params.toString()}`, {
      cache: 'no-store',
    });
    const data = (await res.json()) as Expense[];
    setExpenses(data);
    setLoading(false);
  }

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helper: reset form
  function resetForm() {
    setFormId(null);
    setFormDate(formatDateYYYYMMDD(new Date()));
    setFormType('');
    setFormAmount('');
  }

  function arabicToEnglishDigits(value: string) {
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    return value.replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString());
  }
  // handle amount input with comma formatting
  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const converted = arabicToEnglishDigits(e.target.value);
    const raw = converted.replace(/,/g, '');
    if (raw === '') {
      setFormAmount('');
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    setFormAmount(
      num.toLocaleString('en-LB', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    );
  }

  // submit create/update
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const type = formType.trim();
    if (!type) {
      alert('Type is required');
      return;
    }
    const raw = formAmount.replace(/,/g, '');
    const entered = Number(raw);
    if (!raw || Number.isNaN(entered) || entered <= 0) {
      alert('Valid amount is required');
      return;
    }

    let amountLBP: number;
    if (entered < 1000) amountLBP = entered * USD_RATE;
    else amountLBP = entered;

    setSaving(true);

    const payload = {
      id: formId ?? undefined,
      type,
      amount: amountLBP,
      date: formDate || undefined,
    };

    const method = formId ? 'PUT' : 'POST';
    const res = await fetch('/api/expenses', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      alert(err?.error || 'Failed to save expense');
      return;
    }

    resetForm();
    loadExpenses();
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this expense?')) return;

    const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      alert(err?.error || 'Failed to delete');
      return;
    }

    loadExpenses();
  }

  function startEdit(exp: Expense) {
    setFormId(exp.id);
    const d = new Date(exp.createdAt);
    setFormDate(formatDateYYYYMMDD(d));
    setFormType(exp.type);
    setFormAmount(
      exp.amount.toLocaleString('en-LB', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    );
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div dir="rtl" className="bg-[#122035] min-h-screen px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-3xl font-bold text-white">المصاريف</h1>
          <div className="text-2xl font-bold text-white">
            المجموع في القائمة:
            <br />
            <span className="font-semibold">
              {total.toLocaleString('en-LB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
              ليرة
              <br />
            </span>
            <span className="font-semibold">
              {(total / USD_RATE).toLocaleString('en-LB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
              $ (تقريباً)
            </span>
          </div>
        </header>

       {/* Filters */}
<section className="rounded-lg bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
  {/* Left: Filter buttons */}
  <div className="flex flex-wrap gap-2">
    <button
      type="button"
      onClick={() =>
        loadExpenses(formatDateYYYYMMDD(new Date()), formatDateYYYYMMDD(new Date()))
      }
      className="rounded-md bg-sky-600 px-4 py-2 text-white hover:bg-sky-700"
    >
      اليوم
    </button>
    <button
      type="button"
      onClick={() => {
        const { monday, saturday } = getWeekRange(new Date());
        loadExpenses(formatDateYYYYMMDD(monday), formatDateYYYYMMDD(saturday));
      }}
      className="rounded-md bg-sky-600 px-4 py-2 text-white hover:bg-sky-700"
    >
      هذا الأسبوع
    </button>
    <button
      type="button"
      onClick={() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        loadExpenses(formatDateYYYYMMDD(firstDay), formatDateYYYYMMDD(lastDay));
      }}
      className="rounded-md bg-sky-600 px-4 py-2 text-white hover:bg-sky-700"
    >
      هذا الشهر
    </button>
  </div>

  {/* Right: Search + Days form */}
  <form
    onSubmit={(e) => {
      e.preventDefault();
      loadExpenses();
    }}
    className="flex flex-wrap items-end gap-3 text-2xl"
  >
    <div className="flex-1 min-w-[180px]">
      <label className="mb-1 block text-black-600 py-2">بحث (نوع)</label>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        placeholder="منظف.. راتب.."
      />
    </div>
    <div>
      <label className="mb-1 block text-base text-black-600">خلال ايام</label>
      <input
        type="number"
        min={1}
        value={days}
        onChange={(e) => setDays(e.target.value)}
        className="w-24 rounded-md border border-slate-300 px-3 py-2 text-xl focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      />
    </div>
    <button
      type="submit"
      className="rounded-md bg-sky-600 px-4 py-2 text-xl text-white hover:bg-sky-700 disabled:opacity-60"
      disabled={loading}
    >
      {loading ? 'يبحث...' : 'بحث'}
    </button>
    <button
      type="button"
      onClick={() => {
        setSearch('');
        setDays('1');
        loadExpenses();
      }}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xl text-slate-700 hover:bg-slate-100"
    >
      إعادة ضبط
    </button>
  </form>
</section>
        {/* Form */}
        <section className="rounded-lg font-bold text-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-3xl text-slate-900">{formId ? 'تعديل مصروف' : 'أضف مصروف'}</h2>
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-1">
              <label className="mb-1 block  text-black-600">تاريخ</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-black-600">اسم المصروف *</label>
              <input
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="منظف.. راتب.."
                required
              />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block  text-black-600">المبلغ (ليرة لبنانية) *</label>
              <input
                type="text"
                inputMode="numeric"
                value={formAmount}
                onChange={handleAmountChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="150,000 أو 10 (دولار)"
                required
              />
            </div>
            <div className="sm:col-span-1 flex items-end">
              <button
                type="submit"
                className="w-full rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? (formId ? 'جار الحفظ…' : 'جارٍ الإضافة…') : formId ? 'حفظ التغييرات' : 'أضف مصروف'}
              </button>
            </div>
          </form>
          {formId && (
            <button
              type="button"
              onClick={resetForm}
              className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              إلغاء التعديل
            </button>
          )}
        </section>

        {/* Table */}
        <section className=" text-xl font-bold rounded-lg bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-3xl text-black-900">قائمة المصاريف</h2>
            <span className="text-black-500">{expenses.length.toLocaleString('ar-LB')} مصاريف</span>
          </div>

          {expenses.length === 0 ? (
            <p className="text-black-500">لم يتم العثور على مصروف لهذا الاسم.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-right">
                <thead>
                  <tr className="border-b bg-slate-50 uppercase text-slate-500">
                    <th className="px-3 py-2">التاريخ</th>
                    <th className="px-3 py-2">اسم المصروف</th>
                    <th className="px-3 py-2 text-right">المبلغ</th>
                    <th className="px-3 py-2 text-right">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="px-3 py-2 text-black-500">
                        {new Date(e.createdAt).toLocaleDateString('ar-LB', {
                          year: 'numeric',
                          month: 'numeric',
                          weekday: 'long',
                          day: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-2 text-slate-900">{e.type}</td>
                      <td className="px-3 py-2 text-right text-slate-900">
                        {e.amount.toLocaleString('en-LB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-3 py-2 text-right ">
                        <button
                          type="button"
                          onClick={() => startEdit(e)}
                          className="mr-2 rounded border border-slate-300 px-2 mx-2 py-1 text-slate-700 hover:bg-slate-100"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(e.id)}
                          className="rounded border border-rose-300 px-2 py-1 text-rose-700 hover:bg-rose-50"
                        >
                          حذف
                        </button>
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
  );
}