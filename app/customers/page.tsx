// app/customers/page.tsx
'use client';

import { useEffect, useState } from 'react';

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [days, setDays] = useState<string>(''); // '', '7', '30', etc.

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCustomers(params?: { search?: string; days?: string }) {
    setLoading(true);
    setError(null);

    const urlParams = new URLSearchParams();
    if (params?.search && params.search.trim()) {
      urlParams.set('search', params.search.trim());
    }
    if (params?.days && params.days.trim()) {
      urlParams.set('days', params.days.trim());
    }

    const res = await fetch(`/api/customers?${urlParams.toString()}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      setLoading(false);
      setError('Failed to load customers');
      return;
    }

    const data = await res.json();
    setCustomers(data);
    setLoading(false);
  }

  // initial load
  useEffect(() => {
    // This is a one-time initial load — it's fine to set state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCustomers();
  }, []);

  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    await loadCustomers({ search, days });
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to save customer');
      setSaving(false);
      return;
    }

    setSaving(false);
    setName('');
    setPhone('');
    setAddress('');

    // reload list with same filters
    loadCustomers({ search, days });
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">
          الزبائن
          </h1>
          <span className="text-xs text-slate-500">
            {customers.length.toLocaleString("ar-LB")} زبائن
          </span>
        </header>

        {/* Search & filter */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-3 shadow-sm"
        >
          <input
            type="text"
            placeholder="البحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[180px] flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">كل الوقت</option>
            <option value="7">آخر ٧ أيام</option>
            <option value="30">آخر ٣٠ أيام</option>
            <option value="90">آخر ٩٠ أيام</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? 'جار البحث...' : 'بحث'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setDays('');
              loadCustomers();
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            إعادة ضبط
          </button>
        </form>

        {/* Add customer */}
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-medium text-slate-900">
          إضافة زبون جديد
          </h2>

          {error && (
            <p className="mb-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <form onSubmit={handleAddCustomer} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  الاسم *
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  الرقم
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                العنوان / ملحوظات
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? 'جار حفظ التغييرات...' : 'إضافة زبون جديد'}
            </button>
          </form>
        </section>

        {/* Customer list */}
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-900">
            قائمة الزبائن
            </h2>
            <span className="text-xs text-slate-500">
            {customers.length.toLocaleString("ar-LB")} زبائن
          </span>
          </div>

          {customers.length === 0 ? (
            <p className="text-sm text-slate-500">
             لم يتم العثور على زبائن.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">الاسم</th>
                    <th className="px-3 py-2">الرقم</th>
                    <th className="px-3 py-2">العنوان</th>
                    <th className="px-3 py-2">تاريخ الاضافة</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {c.id.toLocaleString("ar-LB")}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {c.name}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {c.phone || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {c.address || '-'}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        {new Date(c.createdAt).toLocaleString('ar-LB', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'long',
  
})}
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