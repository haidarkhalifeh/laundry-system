// app/items/page.tsx
'use client';

import { useEffect, useState } from 'react';

type Item = {
  id: number;
  name: string;
  active: boolean;
  createdAt: string;
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [name, setName] = useState('');

  async function loadItems(searchTerm?: string) {
    setLoading(true);
    const params = new URLSearchParams();

    if (searchTerm && searchTerm.trim()) {
      params.set('search', searchTerm.trim());
    }

    const res = await fetch('/api/items?' + params.toString(), {
      cache: 'no-store',
    });
    const data = (await res.json()) as Item[];
    setItems(data);
    setLoading(false);
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    setName('');
    loadItems(search);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadItems(search);
  }

  async function handleToggleActive(item: Item) {
    setTogglingId(item.id);
    await fetch('/api/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, active: !item.active }),
    });
    setTogglingId(null);
    loadItems(search);
  }

  useEffect(() => {
    // This is a one-time initial load — it's fine to set state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadItems();
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">
          أغراض 
          </h1>
        </header>

        {/* Search */}
        <form
          onSubmit={handleSearch}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            placeholder="ابحث عن غرض..."
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
              loadItems('');
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            إعادة ضبط
          </button>
        </form>

        {/* Add item */}
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-medium text-slate-900">
          إضافة عنصر
          </h2>
          <form onSubmit={handleAddItem} className="flex gap-2">
            <input
              type="text"
              placeholder="اسم العنصر (على سبيل المثال قميص)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'جارٍ الحفظ…' : 'إضافة العنصر'}
            </button>
          </form>
        </section>

        {/* Items table */}
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-900">
            قائمة العناصر
            </h2>
            <span className="text-xs text-slate-500">
               عدد العناصر {items.length.toLocaleString("ar-EG")}
            </span>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-slate-500">
          لا يوجد عنصر.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">الاسم</th>
                    <th className="px-3 py-2">الحالة</th>
                    <th className="px-3 py-2">تاريخ الاضافة</th>
                    <th className="px-3 py-2 text-right">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {item.id.toLocaleString("ar-EG")}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {item.name}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            item.active
                              ? 'inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                              : 'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'
                          }
                        >
                          {item.active ? 'فعال' : 'غير فعال'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        {new Date(item.createdAt).toLocaleString('ar-LB', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
})}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                          disabled={togglingId === item.id}
                        >
                          {togglingId === item.id
                            ? 'جارٍ التحديث…'
                            : item.active
                            ? 'تجميد العنصر'
                            : 'تفعيل العنصر'}
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