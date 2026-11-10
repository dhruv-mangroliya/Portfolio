import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { useConfirm } from './ui.jsx';

/** Keeps the dashboard out of search engines. */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = 'Dashboard';
    return () => {
      meta.remove();
      document.title = prevTitle;
    };
  }, []);
}

/**
 * Warns before leaving a page with unsaved changes (in-app navigation and tab close).
 * Returns a `bypass()` function to call right before an intentional navigation (e.g. after saving).
 */
export function useUnsavedGuard(dirty) {
  const confirm = useConfirm();
  const skip = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !skip.current && currentLocation.pathname !== nextLocation.pathname
  );

  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirm({
      title: 'Discard unsaved changes?',
      message: 'You have edits that haven’t been saved yet.',
      confirmLabel: 'Discard changes',
    }).then((ok) => (ok ? blockerRef.current.proceed?.() : blockerRef.current.reset?.()));
  }, [blocker.state, confirm]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return () => {
    skip.current = true;
    setTimeout(() => (skip.current = false), 0);
  };
}
