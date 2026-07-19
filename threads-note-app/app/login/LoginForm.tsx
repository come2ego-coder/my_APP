"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ログインに失敗しました。");
        return;
      }
      router.push(searchParams.get("next") || "/");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`通信エラーが発生しました: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 w-full max-w-sm mx-auto px-4 py-16">
      <h1 className="font-mincho text-2xl font-bold text-plum-deep text-center mb-6">
        パスワードを入力
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          autoFocus
          className="w-full rounded-lg border border-plum/20 bg-white p-3 text-sm text-plum-deep placeholder:text-plum-deep/40 focus:outline-none focus:ring-2 focus:ring-gold/60"
        />
        {error && <p className="text-sm text-red-800">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password.trim()}
          className="w-full rounded-lg bg-plum text-gold-light font-medium py-3 shadow-md transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "確認中..." : "入る"}
        </button>
      </form>
    </main>
  );
}
