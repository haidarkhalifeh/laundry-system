// app/itemprices/page.tsx
'use client';

import { useEffect, useState } from 'react';

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

type ItemPrice = {
  id: number;
  price: number;
  active: boolean;
  createdAt: string;
  item: Item;
  serviceType: ServiceType;
};

export default function ItemPricesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [prices, setPrices] = useState<ItemPrice[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Loaders
  async function loadItems() {
    const res = await fetch('/api/items'); // assumes your items GET exists
    const data = await res.json();
    setItems(data);
  }

  async function loadServices() {
    const res = await fetch('/api/service-types'); // assumes servicetypes GET exists
    const data = await res.json();
    setServices(data);
  }

  async function loadPrices() {
    setLoading(true);
    const res = await fetch('/api/item-prices');
    const data = await res.json();
    setPrices(data);
    setLoading(false);
  }

  useEffect(() => {
    // This is a one-time initial load — it's fine to set state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadItems();
    loadServices();
    loadPrices();
  }, []);

  async function handleSavePrice(e: React.FormEvent) {
    e.preventDefault();

    const itemIdNum = Number(selectedItemId);
    const serviceTypeIdNum = Number(selectedServiceTypeId);
    const priceNum = Number(price);

    if (!itemIdNum || !serviceTypeIdNum || Number.isNaN(priceNum) || priceNum <= 0) {
      alert('Please choose item, service and enter a positive price.');
      return;
    }

    setSaving(true);
    const res = await fetch('/api/item-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: itemIdNum,
        serviceTypeId: serviceTypeIdNum,
        price: priceNum,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? 'Could not save item price');
      return;
    }

    setPrice('');
    await loadPrices();
  }

  async function toggleActive(p: ItemPrice) {
    const res = await fetch('/api/item-prices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: p.id,
        active: !p.active,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? 'Could not update status');
      return;
    }

    await loadPrices();
  }

  return (
    <div  className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">
          أسعار العناصر
          </h1>
          <p className="text-sm text-slate-500">
          تحديد السعر بناء على العنصر ونوع الخدمة
          </p>
        </header>

        {/* Form */}
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-medium text-slate-900">
          تحديد / تحديث السعر
          </h2>
          <form
            onSubmit={handleSavePrice}
            className="grid gap-3 md:grid-cols-[2fr,2fr,1.5fr,auto]"
          >
            {/* Item select */}
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-medium text-slate-600">
                العنصر
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="text-slate-600 w-full rounded-md border border-slate-300 px-2 py-1 font-semibold focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-50"
              >
                <option value="" className='text-slate-600'>حدد العنصر…</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id} className="text-slate-600">
                    {it.name} {it.active ? '' : '(inactive)'}
                  </option>
                ))}
                
              </select>
            </div>

            {/* ServiceType select */}
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-medium text-slate-600">
               نوع الخدمة
              </label>
              <select
                value={selectedServiceTypeId}
                onChange={(e) => setSelectedServiceTypeId(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">حدد نوع الخدمة…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Price input */}
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-medium text-slate-600">
              السعر
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="مثلا 100,000"
              />
            </div>

            {/* Save button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? 'يحفظ…' : 'حفظ'}
              </button>
            </div>
          </form>
        </section>

        {/* List */}
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-900">
            قائمة الأسعار
            </h2>
            <span className="text-xs text-slate-500">
            {prices.length.toLocaleString("ar-LB")}  اسعار 
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : prices.length === 0 ? (
            <p className="text-sm text-slate-500">
              لم يتم تحديد الأسعار بعد. أضف واحدة أعلاه.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">العنصر </th>
                    <th className="px-3 py-2">الخدمة</th>
                    <th className="px-3 py-2">السعر</th>
                    <th className="px-3 py-2">الحالة</th>
                    <th className="px-3 py-2">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-3 py-2 text-slate-800">
                        {p.item.name}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {p.serviceType.name}
                      </td>
                      <td className="px-3 py-2 text-slate-800">
                        {p.price.toLocaleString('en-LB')}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {p.active ? 'فعال' : 'غير فعال'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleActive(p)}
                          className={`rounded-md px-3 py-1 text-xs font-medium ${
                            p.active
                              ? 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {p.active ? 'تجميد العنصر' : 'تفعيل العنصر'}
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