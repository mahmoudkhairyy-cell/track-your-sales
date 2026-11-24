"use client";

import { FormEvent, useEffect, useState } from "react";
import { cairoISODate } from "@/lib/dates";
import { EmptyState, PrimaryButton, SecondaryButton, inputClass, useToast } from "@/components/ui";
import {
  CONTRACT_STATUS_LABEL,
  ContractItem,
  ContractStatus,
  contractsBranchId,
  createContractId,
  markContractDeleted,
  pushContracts,
  readContracts,
  writeContracts,
} from "@/lib/contracts";

const STATUS_STYLE: Record<ContractStatus, string> = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  missing: "bg-amber-50 text-amber-700 border-amber-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

function daysOld(date: string): number {
  const then = new Date(`${date}T12:00:00`).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86400000);
}

export default function ContractsPage() {
  const toast = useToast();
  const [branchId, setBranchId] = useState("");
  const [items, setItems] = useState<ContractItem[] | null>(null);
  const [client, setClient] = useState("");
  const [contractDate, setContractDate] = useState(cairoISODate());
  const [status, setStatus] = useState<ContractStatus>("sent");
  const [sentDate, setSentDate] = useState(cairoISODate());
  const [note, setNote] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const id = contractsBranchId();
      setBranchId(id);
      setItems(id ? readContracts(id) : []);
    });
    return () => { cancelled = true; };
  }, []);

  function persist(next: ContractItem[]) {
    setItems(next);
    if (branchId) writeContracts(branchId, next);
  }

  async function syncNow(silent = false) {
    if (syncing) return;
    setSyncing(true);
    const ok = await pushContracts();
    setSyncing(false);
    if (!silent) {
      if (ok) toast.push("success", "اترفعت التعاقدات للمتابعة");
      else toast.push("error", "المزامنة ما تمتش. هنحاول تاني مع المزامنة الجاية.");
    }
  }

  function add(event: FormEvent) {
    event.preventDefault();
    const trimmed = client.trim();
    if (!trimmed || !contractDate || items === null) return;
    const item: ContractItem = {
      id: createContractId(),
      client: trimmed.slice(0, 120),
      status,
      contractDate,
      sentDate: status === "sent" ? (sentDate || contractDate) : null,
      note: note.trim().slice(0, 500),
      updatedAt: Date.now(),
    };
    persist([item, ...items]);
    setClient("");
    setNote("");
    setStatus("sent");
    void syncNow(true);
  }

  function setItemStatus(id: string, nextStatus: ContractStatus) {
    if (items === null) return;
    persist(items.map((item) => item.id === id
      ? { ...item, status: nextStatus, sentDate: nextStatus === "sent" ? (item.sentDate ?? cairoISODate()) : item.sentDate, updatedAt: Date.now() }
      : item));
    void syncNow(true);
  }

  function remove(id: string) {
    if (items === null) return;
    if (!window.confirm("تمسح التعاقد ده؟")) return;
    if (branchId) markContractDeleted(branchId, id);
    persist(items.filter((item) => item.id !== id));
    void syncNow(true);
  }

  if (items === null) {
    return <div className="tys-page mx-auto max-w-md space-y-3 pb-4" dir="rtl"><p className="p-6 text-center text-sm text-[var(--color-text-secondary)]">بيحمّل...</p></div>;
  }

  const counts = items.reduce<Record<ContractStatus, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, { sent: 0, missing: 0, rejected: 0 });

  return (
    <div className="tys-page mx-auto max-w-md space-y-4 pb-4" dir="rtl">
      <section className="orn-rich-card rounded-[24px] border border-white bg-white/90 p-4 shadow-sm">
        <h1 className="text-lg font-black text-[var(--color-text-primary)]">التعاقدات</h1>
        <p className="mt-1 text-xs leading-6 text-[var(--color-text-secondary)]">
          سجّل كل تعاقد بحالته. مدير الفرع ومدير المنطقة بيشوفوا الحالات دي في المتابعة.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-2 py-2">
            <p className="text-lg font-black tabular-nums text-emerald-700">{counts.sent}</p>
            <p className="text-[11px] font-bold text-emerald-700">اتبعت</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-2 py-2">
            <p className="text-lg font-black tabular-nums text-amber-700">{counts.missing}</p>
            <p className="text-[11px] font-bold text-amber-700">ناقص</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 px-2 py-2">
            <p className="text-lg font-black tabular-nums text-red-700">{counts.rejected}</p>
            <p className="text-[11px] font-bold text-red-700">مرفوض</p>
          </div>
        </div>
      </section>

      <section className="orn-rich-card rounded-[24px] border border-white bg-white/90 p-4 shadow-sm">
        <h2 className="text-sm font-black text-[var(--color-text-primary)]">تعاقد جديد</h2>
        <form onSubmit={add} className="mt-3 space-y-3">
          <div>
            <label className="text-xs font-bold text-[var(--color-text-secondary)]" htmlFor="contract-client">اسم العميل / رقم التعاقد</label>
            <input id="contract-client" value={client} onChange={(e) => setClient(e.target.value)} className={inputClass} maxLength={120} placeholder="مثال: أحمد محمد - 010xxxxxxx" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-[var(--color-text-secondary)]" htmlFor="contract-date">تاريخ التعاقد</label>
              <input id="contract-date" type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-text-secondary)]" htmlFor="contract-status">الحالة</label>
              <select id="contract-status" value={status} onChange={(e) => setStatus(e.target.value as ContractStatus)} className={inputClass}>
                {(Object.keys(CONTRACT_STATUS_LABEL) as ContractStatus[]).map((key) => (
                  <option key={key} value={key}>{CONTRACT_STATUS_LABEL[key]}</option>
                ))}
              </select>
            </div>
          </div>
          {status === "sent" ? (
            <div>
              <label className="text-xs font-bold text-[var(--color-text-secondary)]" htmlFor="contract-sent-date">تاريخ الإرسال للشركة</label>
              <input id="contract-sent-date" type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} className={inputClass} />
            </div>
          ) : null}
          <div>
            <label className="text-xs font-bold text-[var(--color-text-secondary)]" htmlFor="contract-note">ملاحظة (اختياري)</label>
            <input id="contract-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} maxLength={500} placeholder="أي تفاصيل تساعد المتابعة" />
          </div>
          <PrimaryButton type="submit" disabled={!client.trim() || !contractDate}>سجّل التعاقد</PrimaryButton>
        </form>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[var(--color-text-primary)]">تعاقداتي ({items.length})</h2>
          <SecondaryButton type="button" onClick={() => void syncNow()} disabled={syncing}>
            {syncing ? "بيترفع..." : "مزامنة دلوقتي"}
          </SecondaryButton>
        </div>
        {items.length === 0 ? (
          <EmptyState title="لسه مفيش تعاقدات" text="سجّل أول تعاقد من الفورم اللي فوق." />
        ) : (
          items.map((item) => (
            <article key={item.id} className="orn-rich-card rounded-[20px] border border-white bg-white/90 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-[var(--color-text-primary)]">{item.client}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                    تاريخ التعاقد: {item.contractDate}
                    {item.sentDate ? ` · اتبعت: ${item.sentDate}` : ""}
                    {item.status !== "sent" && daysOld(item.contractDate) >= 3 ? (
                      <span className="font-bold text-red-600"> · متأخر {daysOld(item.contractDate)} يوم</span>
                    ) : null}
                  </p>
                  {item.note ? <p className="mt-1 text-[11px] leading-5 text-[var(--color-text-secondary)]">{item.note}</p> : null}
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${STATUS_STYLE[item.status]}`}>
                  {CONTRACT_STATUS_LABEL[item.status]}
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {(Object.keys(CONTRACT_STATUS_LABEL) as ContractStatus[]).filter((key) => key !== item.status).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setItemStatus(item.id, key)}
                    className="rounded-full border border-[var(--color-border)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-secondary)] transition hover:border-[#edc4a4]"
                  >
                    {key === "sent" ? "✓ اتبعت" : CONTRACT_STATUS_LABEL[key]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="mr-auto rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700"
                >
                  مسح
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
