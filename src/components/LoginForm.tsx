'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginForm() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get('next') || '/admin';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    setLoading(false);
    if (res.ok) {
      router.replace(nextPath);
    } else {
      setErr('密碼錯誤');
    }
  }

  return (
    <form className="login-card" onSubmit={onSubmit}>
      <h1>Admin</h1>
      <p>請輸入後台密碼</p>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        autoFocus
        placeholder="密碼"
      />
      {err && <div className="flash err" style={{ textAlign: 'left' }}>{err}</div>}
      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? '登入中…' : '登入'}
      </button>
    </form>
  );
}
