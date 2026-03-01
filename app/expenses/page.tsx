'use client';

import { useEffect, useState } from 'react';

type Expense = {
  id: number;
  type: string;
  amount: number;
  category: string;
  createdAt: string;
};

const EXPENSE_CATEGORIES = [
  { value: 'SUPPLIES', label: 'مواد مصبغة' },
  { value: 'UTILITIES', label: 'كهرباء / ماء / إنترنت' },
  { value: 'SALARIES', label: 'رواتب' },
  { value: 'RENT', label: 'إيجار' },
  { value: 'MAINTENANCE', label: 'صيانة' },
  { value: 'DELIVERY', label: 'توصيل / بنزين' },
  { value: 'MARKETING', label: 'تسويق' },
  { value: 'OTHER', label: 'أخرى' },
];



const branch = process.env.NEXT_PUBLIC_BRANCH;


const QUICK_TYPES = [
  'دواء غسيل',
  'تعاليق',
  'مياه خزان',
  'نيلون حرامات',
  'تراوزر غارد',
  ...(branch === 'kfarhazir' ? ['سحب'] : [])
];
function getCategoryLabel(value: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? 'أخرى';
}

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
  const [formCategory, setFormCategory] = useState('OTHER');
  const [activeRange, setActiveRange] = useState<'day' | 'week' | 'month' | 'custom'>('custom');
const [categoryFilter, setCategoryFilter] = useState('ALL');

  // load expenses
  async function loadExpenses(from?: string, to?: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (days.trim()) params.set('days', days.trim());

    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (categoryFilter !== 'ALL') {
      params.set('category', categoryFilter);
    }

 


    const res = await fetch(`/api/expenses?${params.toString()}`, {
      cache: 'no-store',
    });
    const data = (await res.json()) as Expense[];
    setExpenses(data);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      loadExpenses();
    }, 300); // debounce
  
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, days, categoryFilter]);

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
    setFormCategory('OTHER');
  }

  function arabicToEnglishDigits(value: string) {
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    return value.replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString());
  }
  // handle amount input with comma formatting
  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const converted = arabicToEnglishDigits(e.target.value);
  
    // allow digits, minus, dot, comma
    const cleaned = converted.replace(/[^0-9\-.,]/g, '');
  
    // remove commas for internal value
    const raw = cleaned.replace(/,/g, '');
  
    if (raw === '' || raw === '-') {
      setFormAmount(raw);
      return;
    }
  
    // allow typing "12." without breaking
    if (raw.endsWith('.')) {
      setFormAmount(raw);
      return;
    }
  
    const num = Number(raw);
    if (Number.isNaN(num)) return;
  
    const [intPart, decimalPart] = raw.split('.');
  
    const formattedInt = Number(intPart).toLocaleString('en-LB');
  
    setFormAmount(
      decimalPart !== undefined
        ? `${formattedInt}.${decimalPart}`
        : formattedInt
    );
  }

  function formatArabicDay(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ar-LB', {
      weekday: 'long',
    });
  }
  
  function shiftDate(dateStr: string, days: number) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return formatDateYYYYMMDD(d);
  }

  function resetFilters() {
    setActiveRange('custom');
    setCategoryFilter('ALL');
    setSearch('');
    setDays('1');
    loadExpenses();
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
      category: formCategory,
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
    setFormCategory(exp.category ?? 'OTHER');
  }

  const realExpensesTotal = expenses
  .filter(e => e.type !== 'سحب')
  .reduce((sum, e) => sum + e.amount, 0);

const withdrawalTotal = expenses
  .filter(e => e.type === 'سحب')
  .reduce((sum, e) => sum + e.amount, 0);

const normalTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

const displayedTotal =
  branch === 'kfarhazir' ? realExpensesTotal : normalTotal;

  return (
    <div dir="rtl" className="bg-[#122035] min-h-screen px-4 py-6">
      <div className="  space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-3xl font-bold text-white">المصاريف</h1>
          
        </header>

       {/* Filters */}
        {/* Form */}
        <section className="rounded-lg font-bold text-base bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-3xl text-slate-900">{formId ? 'تعديل مصروف' : 'أضف مصروف'}</h2>
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-5">

  {/* Date with arrows */}
  <div>
    <label className="mb-1 block text-black-600">التاريخ</label>
    <div className="flex items-center">
      <div>
      <button
        type="button"
        onClick={() => setFormDate(shiftDate(formDate, 1))}
        className="rounded border px-1.5 py my-1"
      >
        +
      </button>
        <button
        type="button"
        onClick={() => setFormDate(shiftDate(formDate, -1))}
        className="rounded border px-2"
      >
        -
      </button>
      
      </div>
      <input
        type="date"
        value={formDate}
        onChange={(e) => setFormDate(e.target.value)}
        className="w-full rounded-md border px-2 py-1"
      />
     
    </div>
    <div className="mt-1 text-sm text-slate-600">
      {formatArabicDay(formDate)}
    </div>
  </div>

  {/* Category */}
  <div>
    <label className="mb-1 block text-black-600">الفئة</label>
    <select
      value={formCategory}
      onChange={(e) => setFormCategory(e.target.value)}
      className="w-full rounded-md border px-3 py-2"
    >
      {EXPENSE_CATEGORIES.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  </div>

  {/* Type */}
  <div>
    <label className="mb-1 block text-black-600">اسم المصروف *</label>
    <input
      value={formType}
      onChange={(e) => setFormType(e.target.value)}
      className="w-full rounded-md border px-3 py-2"
      placeholder="منظف.. راتب.."
      required
    />
    <div className="mt-1 flex flex-wrap gap-1">
      {QUICK_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setFormType(t)}
          className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
        >
          {t}
        </button>
      ))}
    </div>
  </div>

  {/* Amount (unchanged) */}
  <div>
    <label className="mb-1 block text-black-600">المبلغ *</label>
    <input
      type="text"
      inputMode="numeric"
      placeholder=' 100,000 ل.ل او 10$'
      value={formAmount}
      onChange={handleAmountChange}
      className="w-full rounded-md border px-3 py-2"
      required
    />
  </div>

  {/* Submit */}
  <div className="flex flex-col my-7">
  <button
    type="submit"
    disabled={saving}
    className="w-full rounded-md bg-emerald-600 px-4 py-2 text-white"
  >
    {formId ? 'حفظ' : 'إضافة'}
  </button>

  {formId && (
    <button
      type="button"
      onClick={resetForm}
      className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
    >
      إلغاء التعديل
    </button>
  )}
</div>
</form>
        
        </section>

        {/* Table */}
        <section className=" text-xl font-bold rounded-lg bg-white p-4 shadow-sm">
        <section className=" text-base rounded-lg bg-white p-4 shadow-sm flex flex-wrap items-end justify-between gap-4 my-4">

  {/* Date range buttons */}
  <div className="text-base flex gap-2">
    {[
      { key: 'day', label: 'اليوم' },
      { key: 'week', label: 'هذا الأسبوع' },
      { key: 'month', label: 'هذا الشهر' },
    ].map((b) => (
      <button
        key={b.key}
        type="button"
        onClick={() => {
          setActiveRange(b.key as 'day' | 'week' | 'month');
          const now = new Date();

          if (b.key === 'day') {
            loadExpenses(formatDateYYYYMMDD(now), formatDateYYYYMMDD(now));
          } else if (b.key === 'week') {
            const { monday, saturday } = getWeekRange(now);
            loadExpenses(formatDateYYYYMMDD(monday), formatDateYYYYMMDD(saturday));
          } else {
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            loadExpenses(formatDateYYYYMMDD(first), formatDateYYYYMMDD(last));
          }
        }}
        className={`rounded-md px-4 py-2 text-white ${
          activeRange === b.key ? 'bg-emerald-600' : 'bg-sky-600'
        }`}
      >
        {b.label}
      </button>
    ))}
  </div>

  {/* Category filter */}
  <div>
    <label className="block text-sm mb-1">الفئة</label>
    <select
      value={categoryFilter}
      onChange={(e) => {
        setActiveRange('custom');
        setCategoryFilter(e.target.value);
      }}
      className="rounded-md border px-3 py-2"
    >
      <option value="ALL">الكل</option>
      {EXPENSE_CATEGORIES.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  </div>

  {/* Search */}
  <div className="flex-1 min-w-[180px]">
    <label className="block text-sm mb-1">بحث</label>
    <input
      value={search}
      onChange={(e) => {
        setActiveRange('custom');
        setSearch(e.target.value);
      }}
      className="w-full rounded-md border px-3 py-2"
      placeholder="منظف.. راتب.."
    />
  </div>

  {/* Days */}
  <div>
    <label className="block text-sm mb-1">خلال أيام</label>
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setDays((d) => String(Math.max(1, Number(d) - 1)))}
        className="rounded border px-2 py-1 text-sm"
      >
        −
      </button>
      <input
        type="number"
        min={1}
        value={days}
        onChange={(e) => {
          setActiveRange('custom');
          setDays(e.target.value);
        }}
        className="w-20 rounded-md border px-2 py-1 text-center"
      />
      <button
        type="button"
        onClick={() => setDays((d) => String(Number(d) + 1))}
        className="rounded border px-2 py-1 text-sm"
      >
        +
      </button>

      <button
  type="button"
  onClick={resetFilters}
  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-100"
>
  إعادة ضبط
</button>
    </div>
  </div>
</section>

<div className="mb-3 flex items-center justify-between">
  <h2 className="text-3xl text-black-900">قائمة المصاريف</h2>

  <div>
    <span className="text-black-500">
      {expenses.length.toLocaleString('ar-LB')} مصاريف
    </span>

    {/* Real Expenses Total */}
    <div className="text-2xl font-bold text-emerald-900">
      {displayedTotal.toLocaleString('en-LB', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}{' '}
      ليرة
    </div>

    <div className="text-xl text-emerald-700">
      {(displayedTotal / USD_RATE).toLocaleString('en-LB', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}{' '}
      $ تقريبًا
    </div>

    {/* Withdrawal Total (Only for kfarhazir) */}
    {branch === 'kfarhazir' && withdrawalTotal > 0 && (
      <div><div className="text-lg text-red-700 mt-2">
        مجموع السحب:{' '}
        {withdrawalTotal.toLocaleString('en-LB', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}{' '}
        ليرة
      </div>
      <div className="text-lg text-red-700 mt-2">
      {(withdrawalTotal / USD_RATE).toLocaleString('en-LB', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}{' '}
      $ تقريبًا
    </div>
    </div>
    )}
  </div>
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
                      <td className="px-3 py-2 text-slate-900">
  <div className="flex items-center gap-2">
    <span>{e.type}</span>
    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
      {getCategoryLabel(e.category)}
    </span>
  </div>
</td>
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