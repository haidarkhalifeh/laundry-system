// app/service-types/page.tsx
'use client';

import { useEffect, useState } from 'react';

type ServiceType = {
  id: number;
  name: string;
  code: string;
  createdAt: string;
};

export default function ServiceTypesPage() {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadServiceTypes(searchTerm?: string) {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (searchTerm && searchTerm.trim() !== '') {
      params.set('search', searchTerm.trim());
    }

    const url = params.toString()
      ? `/api/service-types?${params.toString()}`
      : '/api/service-types';

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      setError('Failed to load service types');
      setLoading(false);
      return;
    }

    const data = (await res.json()) as ServiceType[];
    setServiceTypes(data);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadServiceTypes();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    if (!trimmedName || !trimmedCode) {
      setError('Name and code are required');
      return;
    }

    setSaving(true);
    setError(null);

    const res = await fetch('/api/service-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName,
        code: trimmedCode,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      setError('Could not create service type');
      return;
    }

    // reset form
    setName('');
    setCode('');

    // reload list with current search filter
    await loadServiceTypes(search);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    void loadServiceTypes(search);
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">
          نوع الخدمة
          </h1>
        </header>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Search */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            placeholder="البحث بالاسم أو الكود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            type="submit"
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'يبحث…' : 'بحث'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              void loadServiceTypes('');
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            إعادة ضبط
          </button>
        </form>

        {/* Add service type */}
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-medium text-slate-900">
          إضافة نوع الخدمة
          </h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                اسم *
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                الكود *
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                كود صغير مثلا :<span className="font-mono">IRON</span>,{' '}
                  <span className="font-mono">WASH_IRON</span>.
                </p>
              </div>
            </div>
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'جارٍ الحفظ…' : 'إضافة نوع الخدمة'}
            </button>
          </form>
        </section>

        {/* Service types table */}
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-900">
            قائمة نوع الخدمة
            </h2>
            <span className="text-xs text-slate-500">
            {serviceTypes.length.toLocaleString('ar-EG')} انواع  
            </span>
          </div>

          {serviceTypes.length === 0 ? (
            <p className="text-sm text-slate-500">
            لا يوجد نوع الخدمه.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">الاسم</th>
                    <th className="px-3 py-2">الكود</th>
                    <th className="px-3 py-2">تاريخ الاضافة</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceTypes.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {s.id}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {s.name}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-700">
                        {s.code}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        {new Date(s.createdAt).toLocaleString("ar-EG", {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
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