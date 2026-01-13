
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
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [days, setDays] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function loadCustomers(params?: { search?: string; days?: string }) {
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    if (params?.search?.trim()) qs.set('search', params.search.trim());
    if (params?.days?.trim()) qs.set('days', params.days.trim());

    const res = await fetch(`/api/customers?${qs.toString()}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      setError('Failed to load customers');
      setLoading(false);
      return;
    }

    setCustomers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // This is a one-time initial load — it's fine to set state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCustomers();
  }, []);

  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadCustomers({ search, days });
  }

  async function handleSaveCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    const res = await fetch('/api/customers', {
      method: editingCustomer ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingCustomer?.id,
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
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
    setEditingCustomer(null);

    loadCustomers({ search, days });
  }

  async function handleDeleteCustomer(c: Customer) {
    if (!confirm(`حذف الزبون "${c.name}"؟`)) return;

    setDeletingId(c.id);

    const res = await fetch(`/api/customers?id=${c.id}`, {
      method: 'DELETE',
    });

    setDeletingId(null);

    if (!res.ok) {
      alert('فشل حذف الزبون');
      return;
    }

    loadCustomers({ search, days });
  }

  function startEdit(c: Customer) {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone ?? '');
    setAddress(c.address ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setAddress('');
  }
  const sortedCustomers = [...customers].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name, 'ar');
    }
  
    // default: by date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Search */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-wrap gap-2 rounded-lg bg-white p-3 shadow-sm"
        >
          <input
            placeholder="البحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border px-3 py-2 text-sm"
          />
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">كل الوقت</option>
            <option value="7">آخر ٧ أيام</option>
            <option value="30">آخر ٣٠ أيام</option>
            <option value="90">آخر ٩٠ أيام</option>
          </select>
          <select
  value={sortBy}
  onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}
  className="rounded-md border px-3 py-2 text-sm"
>
  <option value="date">الأحدث أولاً</option>
  <option value="name">ترتيب أبجدي (أ–ي)</option>
</select>
          <button className="rounded-md bg-sky-600 px-4 py-2 text-white">
            بحث
          </button>
        </form>

        {/* Add / Edit */}
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">
            {editingCustomer ? 'تعديل زبون' : 'إضافة زبون جديد'}
          </h2>

          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

          <form onSubmit={handleSaveCustomer} className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم *"
              required
              className="w-full rounded-md border px-3 py-2"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="الرقم"
              className="w-full rounded-md border px-3 py-2"
            />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="العنوان"
              className="w-full rounded-md border px-3 py-2"
            />

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-emerald-600 px-4 py-2 text-white"
              >
                {saving ? 'جار الحفظ...' : editingCustomer ? 'حفظ التعديل' : 'إضافة'}
              </button>

              {editingCustomer && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-md bg-slate-200 px-4 py-2"
                >
                  إلغاء
                </button>
              )}
            </div>
          </form>
        </section>

        {/* List */}
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-3 py-2">الاسم</th>
                <th className="px-3 py-2">الرقم</th>
                <th className="px-3 py-2">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {sortedCustomers.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{c.phone || '-'}</td>
                  <td className="px-3 py-2 flex gap-2">
                    <button
                      onClick={() => startEdit(c)}
                      className="rounded bg-yellow-100 px-2 py-1"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(c)}
                      disabled={deletingId === c.id}
                      className="rounded bg-rose-100 px-2 py-1"
                    >
                      {deletingId === c.id ? '...' : 'حذف'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

      </div>
    </div>
  );
}