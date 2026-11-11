// Money tracker: (1) monthly income, (2) where the money is (bank, mutual funds…), (3) analysis chart for a chosen month range.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, setMoneyPasscode } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { cx } from '../../shared/utils.js';
import IncomeChart, { CompareChart, usePairColors } from '../IncomeChart.jsx';
import { ErrorBox, PageHeader, Spinner, useConfirm, useToast } from '../ui.jsx';

/* ------------------------------------------------------------------ helpers */

const inr = (n, digits = 0) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: n % 1 ? 2 : digits })}`;
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (m, long = false) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: long ? 'long' : 'short', year: 'numeric' });
};
const sum = (list, f = (x) => x.amount) => list.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const ACCOUNT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];

/** Money is locked behind a passcode every time the tab is opened. */
export default function Money() {
  const [data, setData] = useState(null);
  // Leaving the tab forgets the passcode, so it's asked again next time.
  useEffect(() => () => setMoneyPasscode(''), []);
  if (!data) return <MoneyLock onUnlock={setData} />;
  return <MoneyPage initial={data} onLock={() => { setMoneyPasscode(''); setData(null); }} />;
}

function MoneyLock({ onUnlock }) {
  const [code, setCode] = useState('');
  const [state, setState] = useState({ busy: false, error: '', shake: 0 });
  const inputRef = useRef(null);

  async function submit(e) {
    e.preventDefault();
    if (!code) return;
    setState((s) => ({ ...s, busy: true, error: '' }));
    setMoneyPasscode(code);
    try {
      onUnlock(await api.money());
    } catch (err) {
      setMoneyPasscode('');
      setCode('');
      setState((s) => ({ busy: false, error: err.status === 403 ? 'Wrong passcode. Try again.' : err.message, shake: s.shake + 1 }));
      inputRef.current?.focus();
    }
  }

  return (
    <div className="page money-page">
      <PageHeader title="Money" subtitle="What you earn each month, and where it goes." icon="wallet" accent="lime" />
      <form className="card money-lock" onSubmit={submit} noValidate>
        <span className="money-lock-icon" aria-hidden="true"><Icon name="lock" size={26} /></span>
        <h2>Enter passcode</h2>
        <p>This section is locked. Enter the number to view it.</p>
        <input
          key={state.shake}
          ref={inputRef}
          className={cx('ainput money-lock-input', state.error && 'bad')}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={12}
          placeholder="Passcode"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          aria-label="Passcode"
          aria-invalid={!!state.error}
          aria-describedby="money-lock-err"
        />
        <p id="money-lock-err" className="err" role="alert">{state.error}</p>
        <button className="abtn abtn-primary" disabled={!code || state.busy}>{state.busy ? 'Checking…' : <><Icon name="unlock" size={16} /> Unlock</>}</button>
      </form>
    </div>
  );
}

function MoneyPage({ initial, onLock }) {
  const toast = useToast();
  const [data, setData] = useState(initial);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem('money-tab') || 'income';
    } catch {
      return 'income';
    }
  });
  const pickTab = (t) => {
    setTab(t);
    try {
      localStorage.setItem('money-tab', t);
    } catch {
      /* ignore */
    }
  };

  const [year, setYearState] = useState(() => {
    try {
      return localStorage.getItem('money-year') || String(new Date().getFullYear());
    } catch {
      return String(new Date().getFullYear());
    }
  });
  const setYear = (y) => {
    setYearState(y);
    try {
      localStorage.setItem('money-year', y);
    } catch {
      /* ignore */
    }
  };
  // Years that have any data, plus the current one — newest first.
  const years = useMemo(() => {
    const set = new Set([String(new Date().getFullYear())]);
    data?.incomes.forEach((e) => set.add(e.month.slice(0, 4)));
    data?.transfers.forEach((t) => set.add(t.date.slice(0, 4)));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [data]);

  const load = useCallback(() => {
    setError(null);
    api.money().then(setData).catch((e) => (e.status === 403 ? onLock() : setError(e)));
  }, [onLock]);

  /** Generic add / update / delete that keeps local state in sync. */
  const mutate = {
    add: async (kind, body) => {
      try {
        const { item } = await api.moneyAdd(kind, body);
        setData((d) => ({ ...d, [kind]: [...d[kind], item] }));
        return item;
      } catch (err) {
        toast(err.message, 'error');
        return null;
      }
    },
    update: async (kind, id, body) => {
      try {
        const { item } = await api.moneyUpdate(kind, id, body);
        setData((d) => ({ ...d, [kind]: d[kind].map((x) => (x.id === id ? item : x)) }));
      } catch (err) {
        toast(err.message, 'error');
      }
    },
    remove: async (kind, id) => {
      try {
        await api.moneyDelete(kind, id);
        setData((d) => ({
          ...d,
          [kind]: d[kind].filter((x) => x.id !== id),
          ...(kind === 'accounts' && { transfers: d.transfers.filter((t) => t.accountId !== id) }),
        }));
      } catch (err) {
        toast(err.message, 'error');
      }
    },
  };

  return (
    <div className="page money-page">
      <PageHeader
        title="Money"
        subtitle="What you earn each month, and where it goes."
        icon="wallet"
        accent="lime"
        actions={<button type="button" className="abtn" onClick={onLock}><Icon name="lock" size={16} /> Lock</button>}
      />
      <div className="money-toolbar">
        <div className="tabs" role="tablist" aria-label="Money sections">
          <button type="button" role="tab" aria-selected={tab === 'income'} className={cx('tab', tab === 'income' && 'on')} onClick={() => pickTab('income')}>Monthly income</button>
          <button type="button" role="tab" aria-selected={tab === 'wealth'} className={cx('tab', tab === 'wealth' && 'on')} onClick={() => pickTab('wealth')}>Where my money is</button>
          <button type="button" role="tab" aria-selected={tab === 'analysis'} className={cx('tab', tab === 'analysis' && 'on')} onClick={() => pickTab('analysis')}>Analysis</button>
        </div>
        {data && tab !== 'analysis' && <YearPicker value={years.includes(year) || year === 'all' ? year : years[0]} years={years} onChange={setYear} />}
      </div>
      {error && <ErrorBox error={error} onRetry={load} />}
      {!data && !error && <Spinner />}
      {data && tab === 'income' && <IncomeTab data={data} mutate={mutate} year={years.includes(year) || year === 'all' ? year : years[0]} />}
      {data && tab === 'analysis' && <AnalysisTab data={data} />}
      {data && tab === 'wealth' && <WealthTab data={data} setData={setData} mutate={mutate} year={years.includes(year) || year === 'all' ? year : years[0]} />}
    </div>
  );
}

/* ================================================================== 1. Income */

function IncomeTab({ data, mutate, year }) {
  const confirm = useConfirm();
  const now = thisMonth();
  const all = data.incomes;
  const incomes = year === 'all' ? all : all.filter((e) => e.month.startsWith(year));

  const byMonth = useMemo(() => {
    const m = new Map();
    for (const e of incomes) m.set(e.month, [...(m.get(e.month) ?? []), e]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [incomes]);

  const total = sum(incomes);
  const monthTotals = byMonth.map(([m, list]) => ({ m, total: sum(list) }));
  const best = monthTotals.reduce((a, b) => (!a || b.total > a.total ? b : a), null);
  const avg = monthTotals.length ? total / monthTotals.length : 0;
  const allTime = sum(all);
  const scope = year === 'all' ? 'all time' : year;

  return (
    <>
      <div className="money-stats">
        <Stat label={year === 'all' ? 'Earned till now' : `Earned in ${year}`} value={inr(total)} sub={`${monthTotals.length} ${monthTotals.length === 1 ? 'month' : 'months'} logged`} strong />
        <Stat label="Monthly average" value={monthTotals.length ? inr(Math.round(avg)) : '—'} sub={`Across months logged · ${scope}`} />
        <Stat label="Best month" value={best ? inr(best.total) : '—'} sub={best ? monthLabel(best.m, true) : 'Nothing logged'} />
        <Stat label="All-time total" value={inr(allTime)} sub={`This month: ${inr(sum(all.filter((e) => e.month === now)))}`} />
      </div>

      <section className="card money-card">
        <header className="card-head"><h2><Icon name="plus" size={18} /> Log income</h2></header>
        <IncomeForm onAdd={(body) => mutate.add('incomes', body)} />

        <header className="card-head money-subhead"><h2><Icon name="calendar" size={18} /> {year === 'all' ? 'All months' : `Months in ${year}`}</h2></header>
        {byMonth.length === 0 ? (
          <p className="money-empty">{year === 'all' ? 'Nothing logged yet. Add this month’s income above.' : `Nothing logged for ${year}.`}</p>
        ) : (
          <div className="money-table-wrap">
            <table className="money-table">
              <thead>
                <tr><th scope="col">Month</th><th scope="col">Income</th><th scope="col" className="num">Total</th></tr>
              </thead>
              <tbody>
                {byMonth.map(([m, list]) => (
                  <tr key={m} className={cx(m === now && 'is-current')}>
                    <td className="strong">{monthLabel(m)}</td>
                    <td>
                      <div className="money-chips">
                        {list.map((e) => (
                          <span key={e.id} className="money-chip">
                            {e.source || 'Income'} <b>{inr(e.amount)}</b>
                            <button
                              type="button"
                              aria-label={`Delete ${e.source || 'income'} ${inr(e.amount)} in ${monthLabel(m)}`}
                              onClick={async () =>
                                (await confirm({ title: 'Delete this entry?', message: `${e.source || 'Income'} · ${inr(e.amount)} in ${monthLabel(m, true)}`, confirmLabel: 'Delete' })) &&
                                mutate.remove('incomes', e.id)
                              }
                            >
                              <Icon name="x" size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="num strong">{inr(sum(list))}</td>
                  </tr>
                ))}
              </tbody>
              {byMonth.length > 1 && (
                <tfoot>
                  <tr><td className="strong">Total</td><td /><td className="num strong">{inr(total)}</td></tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function IncomeForm({ onAdd }) {
  const [f, setF] = useState({ month: thisMonth(), amount: '', source: '' });
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    if (!f.month) return setErr('Pick a month.');
    if (!(Number(f.amount) > 0)) return setErr('Enter the amount you earned.');
    setErr('');
    if (await onAdd({ month: f.month, amount: Number(f.amount), source: f.source.trim() })) setF((x) => ({ ...x, amount: '', source: '' }));
  }
  return (
    <form className="money-form" onSubmit={submit} noValidate>
      <label><span>Month</span><input className="ainput" type="month" value={f.month} max={thisMonth()} onChange={(e) => setF({ ...f, month: e.target.value })} /></label>
      <label><span>Amount (₹)</span><input className="ainput" type="number" min="0" inputMode="decimal" placeholder="e.g. 85000" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
      <label className="grow"><span>Source <em>(optional)</em></span><input className="ainput" maxLength={80} placeholder="Salary, freelance…" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></label>
      <button className="abtn abtn-primary"><Icon name="plus" size={16} /> Add</button>
      {err && <p className="err full">{err}</p>}
    </form>
  );
}

/* ================================================================== 3. Analysis */

const addMonths = (m, n) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthList = (from, to) => {
  const out = [];
  for (let m = from; m <= to && out.length < 600; m = addMonths(m, 1)) out.push(m);
  return out;
};

function AnalysisTab({ data }) {
  const [sub, setSub] = useState(() => {
    try {
      return localStorage.getItem('money-analysis') || 'time';
    } catch {
      return 'time';
    }
  });
  const pick = (v) => {
    setSub(v);
    try {
      localStorage.setItem('money-analysis', v);
    } catch {
      /* ignore */
    }
  };
  return (
    <>
      <div className="ana-subtabs" role="tablist" aria-label="Analysis type">
        <button type="button" role="tab" aria-selected={sub === 'time'} className={cx('ana-subtab', sub === 'time' && 'on')} onClick={() => pick('time')}>
          <Icon name="chart" size={16} /> Time based analysis
        </button>
        <button type="button" role="tab" aria-selected={sub === 'compare'} className={cx('ana-subtab', sub === 'compare' && 'on')} onClick={() => pick('compare')}>
          <Icon name="calendar" size={16} /> Year-wise compare
        </button>
      </div>
      {sub === 'time' ? <TimeAnalysis data={data} /> : <CompareYears data={data} />}
    </>
  );
}

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1));

function CompareYears({ data }) {
  const colors = usePairColors();
  const years = useMemo(() => {
    const set = new Set([String(new Date().getFullYear())]);
    data.incomes.forEach((e) => set.add(e.month.slice(0, 4)));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [data.incomes]);
  // Default: the previous year vs the latest year (older first, so the change reads left → right).
  const [pair, setPair] = useState(() => [years[1] ?? String(Number(years[0]) - 1), years[0]]);
  const [a, b] = pair;
  const [asTable, setAsTable] = useState(false);

  const yearData = (y) => {
    const months = MONTHS.map((_, i) => sum(data.incomes.filter((e) => e.month === `${y}-${String(i + 1).padStart(2, '0')}`)));
    const logged = months.filter((v) => v > 0);
    const total = sum(logged, (v) => v);
    const bestIdx = logged.length ? months.indexOf(Math.max(...months)) : -1;
    return { months, total, logged: logged.length, avg: logged.length ? total / logged.length : 0, bestIdx };
  };
  const A = yearData(a);
  const B = yearData(b);
  const rows = MONTHS.map((d, i) => ({
    label: d.toLocaleDateString(undefined, { month: 'short' }),
    long: d.toLocaleDateString(undefined, { month: 'long' }),
    a: A.months[i],
    b: B.months[i],
  }));
  const diff = B.total - A.total;
  const pct = A.total > 0 ? Math.round((diff / A.total) * 100) : null;
  const yearOptions = [...new Set([...years, a, b])].sort((x, y) => y.localeCompare(x));
  const monthName = (i) => MONTHS[i].toLocaleDateString(undefined, { month: 'long' });

  return (
    <>
      <section className="card money-card ana-controls">
        <div className="cmp-pick">
          <span className="cmp-key" style={{ background: colors[0] }} />
          <YearPicker value={a} years={yearOptions} includeAll={false} onChange={(y) => setPair([y, b])} />
          <span className="cmp-vs">vs</span>
          <span className="cmp-key" style={{ background: colors[1] }} />
          <YearPicker value={b} years={yearOptions} includeAll={false} onChange={(y) => setPair([a, y])} />
        </div>
        <button type="button" className="abtn abtn-sm" onClick={() => setPair([b, a])}><Icon name="refresh" size={15} /> Swap</button>
      </section>

      {a === b ? (
        <p className="money-empty">Pick two different years to compare.</p>
      ) : (
        <>
          <div className="cmp-stats">
            {[[a, A, 0], [b, B, 1]].map(([y, d, k]) => (
              <div key={y} className="card cmp-year">
                <span className="k"><i style={{ background: colors[k] }} /> {y}</span>
                <strong>{inr(d.total)}</strong>
                <span className="s">Avg {d.logged ? inr(Math.round(d.avg)) : '—'}/month · {d.logged} {d.logged === 1 ? 'month' : 'months'} logged</span>
                <span className="s">Best: {d.bestIdx >= 0 ? `${monthName(d.bestIdx)} (${inr(d.months[d.bestIdx])})` : '—'}</span>
              </div>
            ))}
            <div className={cx('card cmp-diff', diff > 0 && 'up', diff < 0 && 'down')}>
              <span className="k">{b} vs {a}</span>
              <strong>
                {diff !== 0 && <Icon name={diff > 0 ? 'arrow-up' : 'arrow-down'} size={18} strokeWidth={3} />}
                {diff >= 0 ? '+' : '−'}{inr(Math.abs(diff))}
              </strong>
              <span className="s">{pct == null ? `No income logged in ${a}` : `${pct >= 0 ? '+' : ''}${pct}% total income`}</span>
              {A.logged > 0 && B.logged > 0 && (
                <span className="s">Monthly average {B.avg >= A.avg ? '+' : '−'}{inr(Math.round(Math.abs(B.avg - A.avg)))}</span>
              )}
            </div>
          </div>

          <section className="card money-card">
            <header className="card-head">
              <h2><Icon name="chart" size={18} /> Month by month</h2>
              <div className="ana-view" role="tablist" aria-label="View">
                <button type="button" role="tab" aria-selected={!asTable} className={cx('chip-btn', !asTable && 'on')} onClick={() => setAsTable(false)}>Chart</button>
                <button type="button" role="tab" aria-selected={asTable} className={cx('chip-btn', asTable && 'on')} onClick={() => setAsTable(true)}>Table</button>
              </div>
            </header>
            {A.logged + B.logged === 0 ? (
              <p className="money-empty">No income logged in {a} or {b}.</p>
            ) : asTable ? (
              <div className="money-table-wrap">
                <table className="money-table">
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      <th scope="col" className="num"><span className="dot" style={{ background: colors[0] }} /> {a}</th>
                      <th scope="col" className="num"><span className="dot" style={{ background: colors[1] }} /> {b}</th>
                      <th scope="col" className="num">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const d = r.b - r.a;
                      const both = r.a > 0 && r.b > 0;
                      return (
                        <tr key={r.label}>
                          <td className="strong">{r.long}</td>
                          <td className="num">{r.a ? inr(r.a) : '—'}</td>
                          <td className="num">{r.b ? inr(r.b) : '—'}</td>
                          <td className={cx('num', both && (d >= 0 ? 'pos' : 'neg'))}>{both ? `${d >= 0 ? '+' : '−'}${inr(Math.abs(d))}` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="strong">Total</td>
                      <td className="num strong">{inr(A.total)}</td>
                      <td className="num strong">{inr(B.total)}</td>
                      <td className={cx('num strong', diff >= 0 ? 'pos' : 'neg')}>{diff >= 0 ? '+' : '−'}{inr(Math.abs(diff))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <>
                <CompareChart rows={rows} years={[a, b]} inr={inr} />
                <p className="ana-hint">Hover or tap a month to compare both years · empty slot = nothing logged that month</p>
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}

function TimeAnalysis({ data }) {
  const now = thisMonth();
  const first = data.incomes.reduce((a, e) => (!a || e.month < a ? e.month : a), null) ?? now;
  const [range, setRange] = useState({ from: addMonths(now, -11) < first ? first : addMonths(now, -11), to: now });
  const [asTable, setAsTable] = useState(false);
  const valid = range.from && range.to && range.from <= range.to;

  const presets = [
    { key: '6m', label: 'Last 6 months', from: addMonths(now, -5), to: now },
    { key: '12m', label: 'Last 12 months', from: addMonths(now, -11), to: now },
    { key: 'ytd', label: 'This year', from: `${now.slice(0, 4)}-01`, to: now },
    { key: 'all', label: 'All time', from: first, to: now > first ? now : first },
  ];

  const rows = useMemo(() => {
    if (!valid) return [];
    return monthList(range.from, range.to).map((m) => {
      const list = data.incomes.filter((e) => e.month === m);
      const bySource = new Map();
      for (const e of list) bySource.set(e.source || 'Income', (bySource.get(e.source || 'Income') ?? 0) + e.amount);
      const [y, mo] = m.split('-').map(Number);
      const d = new Date(y, mo - 1, 1);
      return {
        month: m,
        label: monthLabel(m, true),
        short: d.toLocaleDateString(undefined, mo === 1 || m === range.from ? { month: 'short', year: '2-digit' } : { month: 'short' }),
        total: sum(list),
        sources: [...bySource.entries()].sort((a, b) => b[1] - a[1]),
      };
    });
  }, [data.incomes, range, valid]);

  const logged = rows.filter((r) => r.total > 0);
  const total = sum(rows, (r) => r.total);
  const avg = logged.length ? total / logged.length : 0;
  const best = logged.reduce((a, b) => (!a || b.total > a.total ? b : a), null);
  const worst = logged.reduce((a, b) => (!a || b.total < a.total ? b : a), null);
  const firstLogged = logged[0];
  const lastLogged = logged.at(-1);
  const change = firstLogged && lastLogged && firstLogged !== lastLogged ? lastLogged.total - firstLogged.total : null;
  const sources = useMemo(() => {
    const m = new Map();
    for (const r of rows) for (const [n, a] of r.sources) m.set(n, (m.get(n) ?? 0) + a);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <>
      <section className="card money-card ana-controls">
        <div className="ana-range">
          <label><span>From</span><input className="ainput" type="month" value={range.from} max={range.to || undefined} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} /></label>
          <span className="ana-arrow" aria-hidden="true"><Icon name="arrowRight" size={18} /></span>
          <label><span>To</span><input className="ainput" type="month" value={range.to} min={range.from || undefined} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} /></label>
        </div>
        <div className="ana-presets">
          {presets.map((p) => (
            <button key={p.key} type="button" className={cx('chip-btn', range.from === p.from && range.to === p.to && 'on')} onClick={() => setRange({ from: p.from, to: p.to })}>{p.label}</button>
          ))}
        </div>
      </section>

      {!valid ? (
        <p className="err">“From” must be on or before “To”.</p>
      ) : (
        <>
          <div className="money-stats">
            <Stat label="Total income" value={inr(total)} sub={`${monthLabel(range.from)} – ${monthLabel(range.to)}`} strong />
            <Stat label="Monthly average" value={logged.length ? inr(Math.round(avg)) : '—'} sub={`over ${logged.length} of ${rows.length} ${rows.length === 1 ? 'month' : 'months'} with income`} />
            <Stat label="Highest month" value={best ? inr(best.total) : '—'} sub={best ? best.label : 'Nothing logged'} />
            <Stat
              label="Change"
              value={change == null ? '—' : `${change >= 0 ? '+' : '−'}${inr(Math.abs(change))}`}
              sub={change == null ? 'Needs two months with income' : `${firstLogged.label} → ${lastLogged.label}${firstLogged.total ? ` (${change >= 0 ? '+' : '−'}${Math.abs(Math.round((change / firstLogged.total) * 100))}%)` : ''}`}
            />
          </div>

          <section className="card money-card">
            <header className="card-head">
              <h2><Icon name="chart" size={18} /> Monthly income</h2>
              <div className="ana-view" role="tablist" aria-label="View">
                <button type="button" role="tab" aria-selected={!asTable} className={cx('chip-btn', !asTable && 'on')} onClick={() => setAsTable(false)}>Chart</button>
                <button type="button" role="tab" aria-selected={asTable} className={cx('chip-btn', asTable && 'on')} onClick={() => setAsTable(true)}>Table</button>
              </div>
            </header>
            {logged.length === 0 ? (
              <p className="money-empty">No income logged between {monthLabel(range.from, true)} and {monthLabel(range.to, true)}.</p>
            ) : asTable ? (
              <div className="money-table-wrap">
                <table className="money-table">
                  <thead><tr><th scope="col">Month</th><th scope="col">Sources</th><th scope="col" className="num">Total</th><th scope="col" className="num">vs average</th></tr></thead>
                  <tbody>
                    {[...rows].reverse().map((r) => (
                      <tr key={r.month}>
                        <td className="strong">{r.label}</td>
                        <td>{r.sources.map(([n, a]) => `${n} ${inr(a)}`).join(' · ') || '—'}</td>
                        <td className="num strong">{r.total ? inr(r.total) : '—'}</td>
                        <td className={cx('num', r.total && (r.total >= avg ? 'pos' : 'neg'))}>{r.total ? `${r.total >= avg ? '+' : '−'}${inr(Math.round(Math.abs(r.total - avg)))}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td className="strong">Total</td><td /><td className="num strong">{inr(total)}</td><td /></tr></tfoot>
                </table>
              </div>
            ) : (
              <>
                <IncomeChart data={rows} average={avg} inr={inr} />
                <p className="ana-hint">Hover or tap a bar for details · dashed line = monthly average{worst && best !== worst ? ` · lowest: ${worst.label} (${inr(worst.total)})` : ''}</p>
              </>
            )}
          </section>

          {sources.length > 1 && (
            <section className="card money-card">
              <header className="card-head"><h2><Icon name="list" size={18} /> By source</h2></header>
              <ul className="ana-sources">
                {sources.map(([n, a]) => (
                  <li key={n}>
                    <span className="name">{n}</span>
                    <span className="bar"><i style={{ width: `${(a / sources[0][1]) * 100}%` }} /></span>
                    <b>{inr(a)}</b>
                    <small>{Math.round((a / total) * 100)}%</small>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}

/** Year dropdown in the dashboard's own style (not the browser's native select). */
function YearPicker({ value, years, onChange, includeAll = true }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const options = includeAll ? [...years, 'all'] : years;
  const label = (y) => (y === 'all' ? 'All years' : y);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.indexOf(value)));
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (y) => {
    onChange(y);
    setOpen(false);
    ref.current?.querySelector('.ydd-btn')?.focus();
  };
  function onKey(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      return setOpen(true);
    }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(options[active]); }
  }

  return (
    <div className="ydd" ref={ref} onKeyDown={onKey}>
      <button type="button" className={cx('ydd-btn', open && 'open')} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Year: ${label(value)}`}>
        <Icon name="calendar" size={16} />
        <span>{label(value)}</span>
        <Icon name="chevron-down" size={16} className="ydd-chev" />
      </button>
      {open && (
        <ul className="ydd-menu" role="listbox" aria-label="Year" aria-activedescendant={`ydd-${options[active]}`}>
          {options.map((y, i) => (
            <li
              key={y}
              id={`ydd-${y}`}
              role="option"
              aria-selected={y === value}
              className={cx(i === active && 'active', y === value && 'on', y === 'all' && 'sep')}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(y)}
            >
              {label(y)}
              {y === value && <Icon name="check" size={15} strokeWidth={3} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, sub, strong, bar }) {
  return (
    <div className={cx('card money-stat', strong && 'strong')}>
      <span className="k">{label}</span>
      <strong className="v">{value}</strong>
      {bar != null && <span className="money-bar"><i style={{ width: `${Math.min(100, bar * 100)}%` }} /></span>}
      {sub && <span className="s">{sub}</span>}
    </div>
  );
}

/* ================================================================== 2. Where my money is */

function WealthTab({ data, setData, mutate, year }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { accounts, transfers } = data;
  const [newAcc, setNewAcc] = useState({ name: '', color: ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length] });
  const [filter, setFilter] = useState(null); // accountId | null
  const [showAll, setShowAll] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(accounts.length === 0);

  const totals = accounts.map((a) => ({ ...a, total: sum(transfers.filter((t) => t.accountId === a.id)) }));
  const grand = sum(totals, (a) => a.total);
  const positive = totals.filter((a) => a.total > 0);
  const positiveSum = sum(positive, (a) => a.total);
  const accById = new Map(accounts.map((a) => [a.id, a]));
  const inYear = year === 'all' ? transfers : transfers.filter((t) => t.date.startsWith(year));
  const entries = filter ? inYear.filter((t) => t.accountId === filter) : inYear;
  const added = sum(entries.filter((t) => t.amount > 0));
  const withdrawn = -sum(entries.filter((t) => t.amount < 0));
  const visible = showAll ? entries : entries.slice(0, 15);

  async function addTransfer(body) {
    try {
      const { item } = await api.moneyAdd('transfers', body);
      setData((d) => ({ ...d, transfers: [item, ...d.transfers].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)) }));
      const acc = accById.get(body.accountId);
      toast(`${body.amount < 0 ? 'Withdrew' : 'Added'} ${inr(Math.abs(body.amount))} ${body.amount < 0 ? 'from' : 'to'} ${acc?.name ?? 'account'}`);
      return true;
    } catch (err) {
      toast(err.message, 'error');
      return false;
    }
  }

  async function addAccount(e) {
    e.preventDefault();
    if (!newAcc.name.trim()) return;
    if (await mutate.add('accounts', { name: newAcc.name.trim(), color: newAcc.color })) {
      setNewAcc({ name: '', color: ACCOUNT_COLORS[(accounts.length + 1) % ACCOUNT_COLORS.length] });
    }
  }

  return (
    <>
      <section className="card money-holdings">
        <div className="mh-head">
          <span className="k">Total saved & invested</span>
          <strong>{inr(grand)}</strong>
        </div>
        {positiveSum > 0 && (
          <div className="mh-bar" role="img" aria-label={positive.map((a) => `${a.name} ${Math.round((a.total / positiveSum) * 100)}%`).join(', ')}>
            {positive.map((a) => <i key={a.id} style={{ width: `${(a.total / positiveSum) * 100}%`, background: a.color }} />)}
          </div>
        )}
        <ul className="mh-list">
          {totals.map((a) => (
            <li key={a.id}>
              <button type="button" className={cx('mh-item', filter === a.id && 'on')} onClick={() => setFilter((f) => (f === a.id ? null : a.id))} aria-pressed={filter === a.id} title="Show only this place’s entries">
                <span className="dot" style={{ background: a.color }} />
                <span className="name">{a.name}</span>
                <b>{inr(a.total)}</b>
                <small>{positiveSum > 0 && a.total > 0 ? `${Math.round((a.total / positiveSum) * 100)}%` : '—'}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="money-grid">
        <section className="card money-card">
          <header className="card-head"><h2><Icon name="plus" size={18} /> Add money</h2></header>
          {accounts.length ? (
            <TransferForm accounts={accounts} defaultAccount={filter} onAdd={addTransfer} />
          ) : (
            <p className="money-empty">Add a place on the right first (Bank, Mutual funds…).</p>
          )}

          <header className="card-head money-subhead">
            <h2><Icon name="list" size={18} /> {filter ? `${accById.get(filter)?.name}` : 'Entries'} · {year === 'all' ? 'all years' : year}</h2>
            {filter && <button type="button" className="abtn abtn-sm" onClick={() => setFilter(null)}>All places</button>}
          </header>
          {entries.length > 0 && (
            <div className="tx-summary">
              <span>Added <b className="pos">+{inr(added)}</b></span>
              <span>Withdrawn <b className="neg">−{inr(withdrawn)}</b></span>
              <span>Net <b>{added - withdrawn < 0 ? '−' : '+'}{inr(Math.abs(added - withdrawn))}</b></span>
            </div>
          )}
          {entries.length === 0 ? (
            <p className="money-empty">{year === 'all' ? 'No entries yet.' : `No entries in ${year}.`}</p>
          ) : (
            <ul className="tx-list">
              {visible.map((t) => {
                const a = accById.get(t.accountId);
                return (
                  <li key={t.id}>
                    <span className="dot" style={{ background: a?.color }} />
                    <span className="tx-main">
                      <strong>{a?.name ?? 'Deleted place'}</strong>
                      <small>{new Date(`${t.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}{t.note && ` · ${t.note}`}</small>
                    </span>
                    <b className={cx('tx-amt', t.amount < 0 ? 'neg' : 'pos')}>{t.amount < 0 ? '−' : '+'}{inr(Math.abs(t.amount))}</b>
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label="Delete entry"
                      onClick={async () => (await confirm({ title: 'Delete this entry?', message: `${t.amount < 0 ? '−' : '+'}${inr(Math.abs(t.amount))} · ${a?.name ?? ''}`, confirmLabel: 'Delete' })) && mutate.remove('transfers', t.id)}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {entries.length > 15 && (
            <div className="tx-more"><button type="button" className="abtn abtn-sm" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show latest 15' : `Show all ${entries.length}`}</button></div>
          )}
        </section>

        <section className={cx('card money-card places-card', placesOpen && 'open')}>
          <button type="button" className="places-toggle" onClick={() => setPlacesOpen((o) => !o)} aria-expanded={placesOpen} aria-controls="places-body">
            <h2><Icon name="settings" size={18} /> Manage places <small>{accounts.length}</small></h2>
            <Icon name="chevron-down" size={18} className="places-chev" />
          </button>
          {placesOpen && (
          <div id="places-body">
          <p className="money-help">Where you keep money — bank, mutual funds, stocks, FD, PPF…</p>
          <ul className="acc-list">
            {accounts.map((a) => (
              <AccountRow key={a.id} a={a} onSave={(patch) => mutate.update('accounts', a.id, patch)} onDelete={async () => (await confirm({ title: `Delete “${a.name}”?`, message: 'All entries recorded for it will be removed too.', confirmLabel: 'Delete' })) && mutate.remove('accounts', a.id)} />
            ))}
          </ul>
          <form className="acc-add" onSubmit={addAccount}>
            <ColorDots value={newAcc.color} onChange={(color) => setNewAcc((x) => ({ ...x, color }))} />
            <input className="ainput" maxLength={40} placeholder="Add a place, e.g. Stocks" value={newAcc.name} onChange={(e) => setNewAcc((x) => ({ ...x, name: e.target.value }))} aria-label="New place name" />
            <button className="abtn" disabled={!newAcc.name.trim()}><Icon name="plus" size={15} /> Add</button>
          </form>
          </div>
          )}
        </section>
      </div>
    </>
  );
}

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function TransferForm({ accounts, defaultAccount, onAdd }) {
  const [f, setF] = useState({ kind: 'add', accountId: defaultAccount || accounts[0]?.id, amount: '', date: todayKey(), note: '' });
  const [err, setErr] = useState('');
  useEffect(() => {
    if (defaultAccount) setF((x) => ({ ...x, accountId: defaultAccount }));
  }, [defaultAccount]);
  useEffect(() => {
    if (!accounts.some((a) => a.id === f.accountId)) setF((x) => ({ ...x, accountId: accounts[0]?.id }));
  }, [accounts, f.accountId]);

  async function submit(e) {
    e.preventDefault();
    const n = Number(f.amount);
    if (!(n > 0)) return setErr('Enter an amount.');
    if (!f.date) return setErr('Pick a date.');
    setErr('');
    if (await onAdd({ accountId: f.accountId, amount: f.kind === 'withdraw' ? -n : n, date: f.date, note: f.note.trim() })) setF((x) => ({ ...x, amount: '', note: '' }));
  }

  return (
    <form className="money-form tx-form" onSubmit={submit} noValidate>
      <div className="tx-kind" role="radiogroup" aria-label="Add or withdraw">
        <button type="button" role="radio" aria-checked={f.kind === 'add'} className={cx(f.kind === 'add' && 'on')} onClick={() => setF({ ...f, kind: 'add' })}><Icon name="plus" size={14} /> Add</button>
        <button type="button" role="radio" aria-checked={f.kind === 'withdraw'} className={cx(f.kind === 'withdraw' && 'on', 'w')} onClick={() => setF({ ...f, kind: 'withdraw' })}><Icon name="minus" size={14} /> Withdraw</button>
      </div>
      <label><span>Place</span>
        <select className="ainput" value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label><span>Amount (₹)</span><input className="ainput" type="number" min="0" inputMode="decimal" placeholder="e.g. 25000" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
      <label><span>Date</span><input className="ainput" type="date" value={f.date} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
      <label className="grow"><span>Note <em>(optional)</em></span><input className="ainput" maxLength={120} placeholder="e.g. SIP, bonus, FD opened" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      <button className="abtn abtn-primary">{f.kind === 'withdraw' ? <><Icon name="minus" size={16} /> Withdraw</> : <><Icon name="plus" size={16} /> Add</>}</button>
      {err && <p className="err full">{err}</p>}
    </form>
  );
}

function AccountRow({ a, onSave, onDelete }) {
  const [name, setName] = useState(a.name);
  return (
    <li>
      <ColorDots value={a.color} onChange={(color) => onSave({ color })} compact />
      <input className="ainput" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name.trim() !== a.name && onSave({ name: name.trim() })} aria-label="Place name" />
      <button type="button" className="icon-btn danger" onClick={onDelete} aria-label={`Delete ${a.name}`}><Icon name="trash" size={15} /></button>
    </li>
  );
}

function ColorDots({ value, onChange, compact }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="acc-color">
      <button type="button" className="acc-swatch" style={{ background: value }} onClick={() => setOpen((o) => !o)} aria-label="Change colour" aria-expanded={open} />
      {open && (
        <span className={cx('acc-pop', compact && 'compact')} role="radiogroup" aria-label="Colour">
          {ACCOUNT_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={value === c} className={cx('acc-swatch', value === c && 'on')} style={{ background: c }} onClick={() => { onChange(c); setOpen(false); }} aria-label={c} />
          ))}
        </span>
      )}
    </span>
  );
}
