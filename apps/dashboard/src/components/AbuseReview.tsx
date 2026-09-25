'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './model';
type Account = {
  id: string;
  suspendedUntil?: string;
  submitted: number;
  rejected: number;
  flagged: number;
  strikes: number;
};
export default function AbuseReview() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [target, setTarget] = useState('');
  const [hours, setHours] = useState(24);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const result = await api<{ accounts: Account[] }>('/api/admin/abuse');
    setAccounts(result.accounts);
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setMessage(e.message));
  }, [refresh]);
  async function review() {
    setBusy(true);
    try {
      await api('/api/admin/abuse', { userId: target, hours, note });
      setMessage('تم حفظ المراجعة. لا يوجد حظر دائم تلقائي.');
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="reports-panel abuse-panel">
      <div className="panel-heading">
        <div>
          <h2>مراجعة إساءة الاستخدام</h2>
          <p>متاحة لمدير المنصة فقط. الإيقاف مؤقت وبقرار مراجعة بشرية.</p>
        </div>
      </div>
      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              <th>الحساب الداخلي</th>
              <th>البلاغات</th>
              <th>مرفوضة</th>
              <th>للمراجعة</th>
              <th>المخالفات</th>
              <th>الإيقاف حتى</th>
              <th>مراجعة</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td dir="ltr">{a.id.slice(0, 12)}</td>
                <td>{a.submitted}</td>
                <td>{a.rejected}</td>
                <td>{a.flagged}</td>
                <td>{a.strikes}</td>
                <td>
                  {a.suspendedUntil
                    ? new Date(a.suspendedUntil).toLocaleString('ar-EG')
                    : 'غير موقوف'}
                </td>
                <td>
                  <button className="button secondary" onClick={() => setTarget(a.id)}>
                    اختيار
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {target && (
        <form
          className="admin-category-form"
          onSubmit={(e) => {
            e.preventDefault();
            void review();
          }}
        >
          <label htmlFor="suspension-hours">مدة الإيقاف</label>
          <select
            id="suspension-hours"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            <option value={0}>إلغاء الإيقاف بعد المراجعة</option>
            <option value={24}>٢٤ ساعة</option>
            <option value={168}>٧ أيام</option>
          </select>
          <label htmlFor="abuse-note">سبب القرار</label>
          <textarea
            id="abuse-note"
            required
            minLength={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="button primary" disabled={busy || note.trim().length < 3}>
            حفظ قرار المراجعة
          </button>
        </form>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
