import { Suspense } from 'react';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <Suspense fallback={<div className="login-card"><h1>Admin</h1><p>載入中…</p></div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
