import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import Icon from '../../shared/Icon.jsx';
import { cx } from '../../shared/utils.js';
import { COLLECTIONS } from '../schema.js';
import { EmptyState, ErrorBox, PageHeader, Spinner, useConfirm, useToast } from '../ui.jsx';

export default function CollectionList() {
  const { collection } = useParams();
  const def = COLLECTIONS[collection];
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setItems(null);
    setError(null);
    api.list(collection).then(setItems).catch(setError);
  }, [collection]);
  useEffect(() => {
    if (def) load();
  }, [def, load]);

  if (!def) return <Navigate to="/admin" replace />;

  async function move(index, delta) {
    const next = [...items];
    const j = index + delta;
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next); // optimistic
    setBusy(true);
    try {
      setItems(await api.reorder(collection, next.map((i) => i.id)));
    } catch (e) {
      toast(e.message, 'error');
      load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleHidden(item) {
    try {
      const updated = await api.update(collection, item.id, { hidden: !item.hidden });
      setItems((list) => list.map((i) => (i.id === item.id ? updated : i)));
      toast(updated.hidden ? 'Hidden from the website' : 'Now visible on the website');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function remove(item) {
    const ok = await confirm({
      title: `Delete this ${def.singular}?`,
      message: `“${def.title(item)}” will be permanently removed. Tip: you can hide it instead.`,
    });
    if (!ok) return;
    try {
      await api.remove(collection, item.id);
      setItems((list) => list.filter((i) => i.id !== item.id));
      toast('Deleted');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={def.label}
        subtitle={def.blurb}
        icon={def.icon}
        accent={def.accent}
        actions={
          <Link to={`/admin/c/${collection}/new`} className="abtn abtn-primary">
            <Icon name="plus" size={16} /> Add {def.singular}
          </Link>
        }
      />

      {error && <ErrorBox error={error} onRetry={load} />}
      {!items && !error && <Spinner />}

      {items?.length === 0 && (
        <EmptyState
          icon={def.icon}
          title={`No ${def.label.toLowerCase()} yet`}
          action={<Link to={`/admin/c/${collection}/new`} className="abtn abtn-primary"><Icon name="plus" size={16} /> Add the first one</Link>}
        >
          Anything you add here appears on your website straight away.
        </EmptyState>
      )}

      {items?.length > 0 && (
        <>
          <p className="hint"><Icon name="sparkles" size={14} /> The order here is the order on your website. Use the arrows to rearrange.</p>
          <ul className={cx('item-list', `a-${def.accent}`)} aria-busy={busy}>
            {items.map((item, i) => {
              const badges = (def.badges?.(item) ?? []).filter(Boolean);
              return (
                <li key={item.id} className={cx('item-row', item.hidden && 'is-hidden')}>
                  <div className="reorder">
                    <button className="icon-btn" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Move up"><Icon name="up" size={16} /></button>
                    <button className="icon-btn" disabled={busy || i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><Icon name="down" size={16} /></button>
                  </div>
                  <Link to={`/admin/c/${collection}/${item.id}`} className="item-main">
                    <strong>{def.title(item)}</strong>
                    {def.subtitle(item) && <span>{def.subtitle(item)}</span>}
                  </Link>
                  <div className="item-badges">
                    {badges.map((b) => <em key={b} className="pill pill-accent">{b}</em>)}
                    {item.hidden && <em className="pill">Hidden</em>}
                  </div>
                  <div className="item-actions">
                    <button className="icon-btn" onClick={() => toggleHidden(item)} title={item.hidden ? 'Show on website' : 'Hide from website'} aria-label={item.hidden ? 'Show on website' : 'Hide from website'}>
                      <Icon name={item.hidden ? 'eyeOff' : 'eye'} size={18} />
                    </button>
                    <Link className="icon-btn" to={`/admin/c/${collection}/${item.id}`} title="Edit" aria-label="Edit"><Icon name="edit" size={18} /></Link>
                    <button className="icon-btn danger" onClick={() => remove(item)} title="Delete" aria-label="Delete"><Icon name="trash" size={18} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
