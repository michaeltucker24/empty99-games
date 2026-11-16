// Optional accounts UI, shared by every game: the "save your progress" sheet
// (age check → email → 6-digit code → nickname), the Profile account card,
// and the hook that keeps this device's progress and the account in sync.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  accountsEnabled,
  ageStatus,
  currentAccount,
  deleteAccount,
  hasStoredSession,
  isUnder13,
  nicknameProblem,
  pullProgress,
  pushProgress,
  saveNickname,
  sendCode,
  setAgeStatus,
  signOut,
  suggestNickname,
  verifyCode,
  type Account,
} from '../core/account';
import { mergeProgress, type Progress } from '../core/progress';
import { CalcBot, CalcSays } from './CalcBot';
import { Icon } from './Icons';

// ---------- Sync hook ----------

export function useAccount(game: string, progress: Progress, commit: (p: Progress) => void) {
  const [account, setAccount] = useState<Account | null>(null);
  const [syncing, setSyncing] = useState(false);
  const latest = useRef(progress);
  latest.current = progress;
  const ready = useRef(false);

  /** Pull the saved copy, merge it with this device, save both. */
  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const remote = await pullProgress(game);
      const merged = remote ? mergeProgress(latest.current, remote) : latest.current;
      commit(merged);
      latest.current = merged;
      await pushProgress(game, merged);
      ready.current = true;
    } finally {
      setSyncing(false);
    }
  }, [game, commit]);

  // Returning player with a saved sign-in: restore it quietly.
  useEffect(() => {
    if (!hasStoredSession()) return;
    currentAccount()
      .then((a) => {
        setAccount(a);
        if (a) return syncNow();
      })
      .catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save to the account a couple of seconds after progress changes.
  useEffect(() => {
    if (!account || !ready.current) return;
    const t = setTimeout(() => {
      pushProgress(game, latest.current).catch(() => undefined);
    }, 2000);
    return () => clearTimeout(t);
  }, [progress, account, game]);

  const onSignedIn = useCallback(
    async (a: Account) => {
      setAccount(a);
      await syncNow();
    },
    [syncNow],
  );

  return {
    account,
    syncing,
    enabled: accountsEnabled(),
    onSignedIn,
    setNickname: (nickname: string) => setAccount((a) => (a ? { ...a, nickname } : a)),
    signOut: async () => {
      await signOut();
      setAccount(null);
      ready.current = false;
    },
    deleteAccount: async () => {
      const err = await deleteAccount();
      if (!err) {
        setAccount(null);
        ready.current = false;
      }
      return err;
    },
  };
}

// ---------- Save-progress sheet ----------

type Step = 'pitch' | 'age' | 'under' | 'email' | 'code' | 'nickname' | 'done';

export function SaveProgressSheet({
  start,
  onClose,
  onSnooze,
  onSignedIn,
  onNickname,
}: {
  start: 'pitch' | 'email';
  onClose: () => void;
  onSnooze?: () => void;
  onSignedIn: (a: Account) => Promise<void>;
  onNickname: (name: string) => void;
}) {
  const firstStep = (s: 'pitch' | 'email'): Step => {
    if (ageStatus() === 'under') return 'under';
    return s === 'email' ? (ageStatus() === 'ok' ? 'email' : 'age') : 'pitch';
  };
  const [step, setStep] = useState<Step>(firstStep(start));
  const [year, setYear] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [nick, setNick] = useState(() => suggestNickname());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const thisYear = new Date().getUTCFullYear();
  const years = Array.from({ length: 100 }, (_, i) => thisYear - i);

  const go = (s: Step) => {
    setError('');
    setStep(s);
  };

  async function submitEmail() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address');
    setBusy(true);
    const err = await sendCode(email.trim());
    setBusy(false);
    if (err) return setError(err);
    go('code');
  }

  async function submitCode() {
    if (!/^\d{6,8}$/.test(code.trim())) return setError('Enter the code from the email');
    setBusy(true);
    const { account, error: err } = await verifyCode(email.trim(), code.trim());
    if (err || !account) {
      setBusy(false);
      return setError(err ?? 'That code didn’t work');
    }
    await onSignedIn(account);
    setBusy(false);
    if (account.nickname) {
      onNickname(account.nickname);
      go('done');
    } else go('nickname');
  }

  async function submitNickname() {
    const problem = nicknameProblem(nick.trim());
    if (problem) return setError(problem);
    setBusy(true);
    const err = await saveNickname(nick.trim());
    setBusy(false);
    if (err) return setError(err);
    onNickname(nick.trim());
    go('done');
  }

  return (
    <div className="sheet-backdrop" onClick={step === 'pitch' ? undefined : onClose}>
      <div className="sharesheet savesheet" role="dialog" aria-modal="true" aria-label="Save your progress" onClick={(e) => e.stopPropagation()}>
        <div className="sharesheet-head">
          <strong>{step === 'done' ? 'Progress saved' : 'Save your progress'}</strong>
          <button className="iconbtn" aria-label="Close" onClick={step === 'pitch' && onSnooze ? onSnooze : onClose}>
            ✕
          </button>
        </div>

        {step === 'pitch' && (
          <>
            <CalcSays mood="worried" size={72}>
              Your streak, XP and stars only live in this browser. Clear it and they're gone.
            </CalcSays>
            <p className="hint" style={{ marginTop: 12 }}>
              Save them to your email. It's free, takes a minute, and works on any device.
            </p>
            <div className="cards">
              <button className="btn primary block" onClick={() => go(ageStatus() === 'ok' ? 'email' : 'age')}>
                Save my progress
              </button>
              <button className="linkbtn" onClick={onSnooze ?? onClose}>
                Not now
              </button>
            </div>
          </>
        )}

        {step === 'age' && (
          <form
            className="cards"
            onSubmit={(e) => {
              e.preventDefault();
              const y = Number(year);
              if (!y) return setError('Pick the year you were born');
              if (isUnder13(y, thisYear)) {
                setAgeStatus('under');
                return go('under');
              }
              setAgeStatus('ok');
              go('email');
            }}
          >
            <label className="field">
              <span>What year were you born?</span>
              <select value={year} onChange={(e) => (setYear(e.target.value), setError(''))}>
                <option value="">Choose a year</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">We only use this to check you're 13 or older. It isn't saved anywhere.</p>
            {error && <p className="field-error">{error}</p>}
            <button className="btn primary block" type="submit">
              Continue
            </button>
          </form>
        )}

        {step === 'under' && (
          <div className="cards" style={{ textAlign: 'center' }}>
            <CalcBot mood="happy" size={88} />
            <p>
              <strong>Accounts are for players 13 and older.</strong> You can keep playing everything. Your progress stays saved in this browser.
            </p>
            <button className="btn primary block" onClick={onClose}>
              Keep playing
            </button>
          </div>
        )}

        {step === 'email' && (
          <form
            className="cards"
            onSubmit={(e) => {
              e.preventDefault();
              submitEmail();
            }}
          >
            <label className="field">
              <span>Your email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => (setEmail(e.target.value), setError(''))}
                autoFocus
              />
            </label>
            <p className="hint">We'll email you a sign-in code. No password needed. Already saved on another device? Use the same email.</p>
            {error && <p className="field-error">{error}</p>}
            <button className="btn primary block" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send my code'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form
            className="cards"
            onSubmit={(e) => {
              e.preventDefault();
              submitCode();
            }}
          >
            <label className="field">
              <span>Code sent to {email.trim()}</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="12345678"
                maxLength={8}
                value={code}
                onChange={(e) => (setCode(e.target.value.replace(/\D/g, '')), setError(''))}
                autoFocus
                className="code-input"
              />
            </label>
            {error && <p className="field-error">{error}</p>}
            <button className="btn primary block" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Save my progress'}
            </button>
            <button type="button" className="linkbtn" onClick={() => go('email')}>
              Use a different email or resend
            </button>
          </form>
        )}

        {step === 'nickname' && (
          <form
            className="cards"
            onSubmit={(e) => {
              e.preventDefault();
              submitNickname();
            }}
          >
            <label className="field">
              <span>Pick a nickname</span>
              <input value={nick} maxLength={16} onChange={(e) => (setNick(e.target.value), setError(''))} autoFocus />
            </label>
            <p className="hint">Shown on share cards and future leaderboards. Don't use your real name.</p>
            {error && <p className="field-error">{error}</p>}
            <button className="btn primary block" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Done'}
            </button>
            <button type="button" className="linkbtn" onClick={() => setNick(suggestNickname())}>
              Suggest another
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="cards" style={{ textAlign: 'center' }}>
            <CalcBot mood="cheer" size={96} />
            <p>
              <strong>You're saved.</strong> Sign in with the same email on any device and your streak, XP and stars come with you.
            </p>
            <button className="btn primary block" onClick={onClose}>
              Keep playing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Profile card ----------

export function AccountCard({
  account,
  syncing,
  onSave,
  onSignOut,
  onDelete,
}: {
  account: Account | null;
  syncing: boolean;
  onSave: () => void;
  onSignOut: () => void;
  onDelete: () => Promise<string | null>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  if (!account)
    return (
      <div className="card account-card">
        <div className="card-row">
          <p className="row-title">Save your progress</p>
          <Icon name="shield" size={20} />
        </div>
        <p className="hint">Right now your progress only lives in this browser. Save it to your email to keep it on any device.</p>
        <button className="btn primary block" onClick={onSave}>
          Save my progress
        </button>
        <button className="linkbtn" onClick={onSave}>
          Already saved? Sign in
        </button>
      </div>
    );
  return (
    <div className="card account-card">
      <div className="card-row">
        <div>
          <p className="eyebrow">Signed in</p>
          <p className="row-title">{account.nickname ?? 'Pilot'}</p>
        </div>
        <span className={`sync-tag ${syncing ? 'busy' : ''}`}>{syncing ? 'Syncing…' : 'Saved'}</span>
      </div>
      <p className="hint">{account.email}</p>
      {!confirming ? (
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <button className="btn small" onClick={onSignOut}>
            Sign out
          </button>
          <button className="linkbtn" onClick={() => setConfirming(true)}>
            Delete account
          </button>
        </div>
      ) : (
        <div className="danger-box">
          <p>This deletes your account and the progress saved to it. Progress in this browser stays. This can't be undone.</p>
          {error && <p className="field-error">{error}</p>}
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <button
              className="btn small danger"
              onClick={async () => {
                const err = await onDelete();
                if (err) setError(err);
                else setConfirming(false);
              }}
            >
              Delete forever
            </button>
            <button className="btn small" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
