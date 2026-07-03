'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp } from '@/lib/auth-client';

// Owner login form, doubling as the first-run "create owner account" form.
// mode='create' is only rendered when no owner exists yet (single bootstrap).
export default function AuthForm({ mode }: { mode: 'login' | 'create' }) {
  const router = useRouter();
  const isCreate = mode === 'create';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = isCreate
        ? await signUp.email({ name: name.trim(), email: email.trim(), password })
        : await signIn.email({ email: email.trim(), password });

      if (result.error) {
        setError(result.error.message || 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }
      // Session cookie is set — go to the dashboard.
      router.push('/admin');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-xl max-w-sm w-full">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">
          {isCreate ? 'Create owner account' : 'Sign in'}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {isCreate
            ? 'Set up the single owner account for this instance.'
            : 'Admin access for Browser Comments.'}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {isCreate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Your name"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={isCreate ? 'new-password' : 'current-password'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder={isCreate ? 'At least 8 characters' : '••••••••'}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting
              ? isCreate
                ? 'Creating…'
                : 'Signing in…'
              : isCreate
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
