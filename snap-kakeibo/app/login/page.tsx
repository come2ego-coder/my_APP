"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loadRecords } from "@/lib/records";
import { loadTemplates } from "@/lib/templates";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "login") {
      const localRecords = loadRecords();
      if (localRecords.length > 0) {
        const ok = window.confirm(
          "ログインすると、このアカウントに保存されている記録が表示されます。この端末だけに保存されていた記録は表示されなくなります(消えてはいませんが、切り替わります)。続けますか?",
        );
        if (!ok) return;
      }
    }

    setLoading(true);
    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload =
        mode === "signup"
          ? { username, password, records: loadRecords(), templates: loadTemplates() }
          : { username, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `エラーが発生しました(status: ${res.status})`);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`通信エラーが発生しました: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 w-full max-w-sm mx-auto px-4 py-12">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="text-xs text-muted mb-6"
      >
        ← 戻る(ログインせずに使う)
      </button>

      <header className="text-center mb-8">
        <h1 className="text-2xl font-bold text-accent-deep tracking-wide">📷 パシャ家計簿</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "signup" ? "アカウントを作ると、機種変更してもデータを引き継げます。" : "アカウントにログイン"}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 mb-6">
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
            mode === "signup"
              ? "border-accent bg-accent/10 text-accent-deep"
              : "border-transparent bg-white text-foreground/70"
          }`}
        >
          新しく登録
        </button>
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
            mode === "login"
              ? "border-accent bg-accent/10 text-accent-deep"
              : "border-transparent bg-white text-foreground/70"
          }`}
        >
          ログイン
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">ID(半角英数字)</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="例: taro123"
            autoCapitalize="off"
            autoCorrect="off"
            className="w-full bg-white rounded-xl px-3 py-2.5 shadow-sm text-sm outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">パスワード(6文字以上)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white rounded-xl px-3 py-2.5 shadow-sm text-sm outline-none"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg py-2 px-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="mt-2 py-3 rounded-xl bg-accent text-white font-bold shadow-sm disabled:opacity-40"
        >
          {loading ? "処理中..." : mode === "signup" ? "登録してはじめる" : "ログイン"}
        </button>
      </form>

      <p className="text-center text-xs text-muted mt-6">
        ログインしなくても、この端末だけに保存する形でそのまま使えます。
      </p>
    </main>
  );
}
