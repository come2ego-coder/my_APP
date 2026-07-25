"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Customer,
  lastVisit,
  loadCustomers,
  newCustomer,
  saveCustomers,
  todayStr,
} from "@/lib/customers";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "@/lib/settings";

function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${y}/${Number(m)}/${Number(day)}`;
}

function StampGrid({ stamps, goal, size = "md" }: { stamps: number; goal: number; size?: "sm" | "md" }) {
  const dot = size === "sm" ? "w-4 h-4" : "w-7 h-7";
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: goal }, (_, i) => (
        <span
          key={i}
          className={`${dot} rounded-full border-2 flex items-center justify-center text-[10px] ${
            i < stamps
              ? "bg-stamp-filled border-stamp-filled text-white"
              : "bg-stamp-empty border-stamp-empty text-transparent"
          }`}
        >
          {i < stamps ? "★" : ""}
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<Settings>(DEFAULT_SETTINGS);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setCustomers(loadCustomers());
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveCustomers(customers);
  }, [customers, hydrated]);

  useEffect(() => {
    if (hydrated) saveSettings(settings);
  }, [settings, hydrated]);

  useEffect(() => {
    if (showAddForm) nameInputRef.current?.focus();
  }, [showAddForm]);

  const today = todayStr();

  const filtered = useMemo(() => {
    const q = query.trim();
    const list = q
      ? customers.filter((c) => c.name.includes(q) || c.phone.includes(q))
      : customers;
    return [...list].sort((a, b) => {
      const av = lastVisit(a)?.createdAt ?? a.createdAt;
      const bv = lastVisit(b)?.createdAt ?? b.createdAt;
      return bv - av;
    });
  }, [customers, query]);

  const todayStampCount = useMemo(
    () => customers.reduce((sum, c) => sum + c.visits.filter((v) => v.date === today).length, 0),
    [customers, today],
  );

  const selected = customers.find((c) => c.id === selectedId) ?? null;

  function addCustomer() {
    const name = newName.trim();
    if (!name) return;
    const c = newCustomer(name, newPhone.trim());
    setCustomers((prev) => [c, ...prev]);
    setNewName("");
    setNewPhone("");
    setShowAddForm(false);
  }

  function addStamp(id: string) {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.stamps >= settings.goal) return c;
        return {
          ...c,
          stamps: c.stamps + 1,
          totalStamps: c.totalStamps + 1,
          visits: [...c.visits, { date: today, createdAt: Date.now() }],
        };
      }),
    );
  }

  function undoStamp(id: string) {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== id || c.stamps <= 0) return c;
        return { ...c, stamps: c.stamps - 1, visits: c.visits.slice(0, -1) };
      }),
    );
  }

  function redeemReward(id: string) {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== id || c.stamps < settings.goal) return c;
        return { ...c, stamps: c.stamps - settings.goal, rewardsRedeemed: c.rewardsRedeemed + 1 };
      }),
    );
  }

  function deleteCustomer(id: string) {
    if (!window.confirm("このお客様のカードを削除しますか?来店履歴もすべて消えます。")) return;
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setSelectedId(null);
  }

  function openSettings() {
    setSettingsDraft(settings);
    setShowSettings(true);
  }

  function saveSettingsDraft() {
    const goal = Math.max(1, Math.round(Number(settingsDraft.goal)) || DEFAULT_SETTINGS.goal);
    const reward = settingsDraft.reward.trim() || DEFAULT_SETTINGS.reward;
    const shopName = settingsDraft.shopName.trim() || DEFAULT_SETTINGS.shopName;
    setSettings({ goal, reward, shopName });
    setShowSettings(false);
  }

  return (
    <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 pb-24">
      <header className="pt-6 pb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">🎫 {settings.shopName} スタンプカード</h1>
          <p className="text-sm text-muted mt-1">
            本日 {formatDate(today)}・本日のスタンプ {todayStampCount} 個・顧客 {customers.length} 名
          </p>
        </div>
        <button
          onClick={openSettings}
          className="shrink-0 w-10 h-10 rounded-full bg-card shadow flex items-center justify-center text-lg"
          aria-label="設定"
        >
          ⚙️
        </button>
      </header>

      <div className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="名前・電話番号で検索"
          className="flex-1 rounded-xl border border-stamp-empty bg-card px-3 py-2 text-sm"
        />
        <button
          onClick={() => setShowAddForm(true)}
          className="shrink-0 rounded-xl bg-accent text-white px-4 py-2 text-sm font-semibold"
        >
          + 新規登録
        </button>
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted text-sm mt-12">
          {customers.length === 0
            ? "まだお客様が登録されていません。「+ 新規登録」から追加してください。"
            : "該当するお客様が見つかりません。"}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {filtered.map((c) => {
          const full = c.stamps >= settings.goal;
          const lv = lastVisit(c);
          return (
            <li key={c.id} className="bg-card rounded-2xl shadow p-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <button
                  className="text-left flex-1 min-w-0"
                  onClick={() => setSelectedId(c.id)}
                >
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-muted truncate">
                    {c.phone || "電話番号未登録"}
                    {lv && ` ・ 前回来店 ${formatDate(lv.date)}`}
                  </div>
                </button>
                {c.stamps > 0 && !full && (
                  <button
                    onClick={() => undoStamp(c.id)}
                    className="shrink-0 text-xs text-muted underline px-1"
                  >
                    取消
                  </button>
                )}
              </div>

              <StampGrid stamps={c.stamps} goal={settings.goal} size="sm" />

              {full ? (
                <button
                  onClick={() => redeemReward(c.id)}
                  className="rounded-xl bg-accent-deep text-white py-2 text-sm font-semibold"
                >
                  🎁 特典を渡す({settings.reward})
                </button>
              ) : (
                <button
                  onClick={() => addStamp(c.id)}
                  className="rounded-xl bg-accent text-white py-2 text-sm font-semibold"
                >
                  スタンプ +1 ({c.stamps}/{settings.goal})
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20">
          <div className="bg-card rounded-t-2xl sm:rounded-2xl p-4 w-full max-w-md flex flex-col gap-3">
            <h2 className="font-bold text-lg">新しいお客様を登録</h2>
            <input
              ref={nameInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="お名前(必須)"
              className="rounded-xl border border-stamp-empty px-3 py-2 text-sm"
            />
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="電話番号(任意)"
              className="rounded-xl border border-stamp-empty px-3 py-2 text-sm"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 rounded-xl border border-stamp-empty py-2 text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={addCustomer}
                disabled={!newName.trim()}
                className="flex-1 rounded-xl bg-accent text-white py-2 text-sm font-semibold disabled:opacity-40"
              >
                登録する
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20">
          <div className="bg-card rounded-t-2xl sm:rounded-2xl p-4 w-full max-w-md flex flex-col gap-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-lg">{selected.name}</h2>
                <p className="text-xs text-muted">{selected.phone || "電話番号未登録"}</p>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-muted text-xl leading-none px-1">
                ×
              </button>
            </div>

            <StampGrid stamps={selected.stamps} goal={settings.goal} />
            <p className="text-sm text-muted">
              現在 {selected.stamps}/{settings.goal} 個・累計スタンプ {selected.totalStamps} 個・特典利用{" "}
              {selected.rewardsRedeemed} 回
            </p>

            <div className="flex gap-2">
              {selected.stamps > 0 && (
                <button
                  onClick={() => undoStamp(selected.id)}
                  className="flex-1 rounded-xl border border-stamp-empty py-2 text-sm"
                >
                  スタンプ取消
                </button>
              )}
              {selected.stamps >= settings.goal ? (
                <button
                  onClick={() => redeemReward(selected.id)}
                  className="flex-1 rounded-xl bg-accent-deep text-white py-2 text-sm font-semibold"
                >
                  🎁 特典を渡す
                </button>
              ) : (
                <button
                  onClick={() => addStamp(selected.id)}
                  className="flex-1 rounded-xl bg-accent text-white py-2 text-sm font-semibold"
                >
                  スタンプ +1
                </button>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1">来店履歴</h3>
              {selected.visits.length === 0 ? (
                <p className="text-xs text-muted">まだ来店記録がありません。</p>
              ) : (
                <ul className="text-xs text-muted flex flex-col-reverse gap-1 max-h-32 overflow-y-auto">
                  {selected.visits.map((v, i) => (
                    <li key={i}>{formatDate(v.date)}</li>
                  ))}
                </ul>
              )}
            </div>

            <button
              onClick={() => deleteCustomer(selected.id)}
              className="mt-2 text-danger text-sm underline self-start"
            >
              このお客様を削除する
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20">
          <div className="bg-card rounded-t-2xl sm:rounded-2xl p-4 w-full max-w-md flex flex-col gap-3">
            <h2 className="font-bold text-lg">設定</h2>
            <label className="text-sm flex flex-col gap-1">
              お店の名前
              <input
                value={settingsDraft.shopName}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, shopName: e.target.value })}
                className="rounded-xl border border-stamp-empty px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm flex flex-col gap-1">
              特典に必要なスタンプ数
              <input
                type="number"
                min={1}
                value={settingsDraft.goal}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, goal: Number(e.target.value) })
                }
                className="rounded-xl border border-stamp-empty px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm flex flex-col gap-1">
              特典の内容
              <input
                value={settingsDraft.reward}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, reward: e.target.value })}
                placeholder="例: 1品サービス、ドリンク1杯無料"
                className="rounded-xl border border-stamp-empty px-3 py-2 text-sm"
              />
            </label>
            <p className="text-xs text-muted">
              ※ 変更は今後スタンプが貯まるお客様から反映されます。すでに貯まっている数はそのままです。
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 rounded-xl border border-stamp-empty py-2 text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={saveSettingsDraft}
                className="flex-1 rounded-xl bg-accent text-white py-2 text-sm font-semibold"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
