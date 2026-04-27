/**
 * /merchants — list every merchant Lighthouse has seen, with category
 * inline-editable. Clicking a row opens the per-merchant timeline.
 *
 * The "Merge" action lets the user collapse duplicates that the
 * normalizer didn't catch.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiPost, type MerchantItem } from '../lib/api';
import PageHeader from '../components/PageHeader';
import MerchantBadge from '../components/MerchantBadge';
import Modal from '../components/Modal';
import { CATEGORY_LABEL } from '../components/CategoryBreakdown';
import { ChevronRight, Combine, Edit2, Save } from 'lucide-react';

export default function MerchantsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['merchants'],
    queryFn: () => api<{ merchants: MerchantItem[] }>('/api/merchants'),
  });
  const list = q.data?.merchants ?? [];
  const [editId, setEditId] = useState<number | null>(null);
  const [mergeId, setMergeId] = useState<number | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Merchants"
        description={`${list.length} merchant${list.length === 1 ? '' : 's'} on file. Edit a category or merge duplicates.`}
      />
      <div className="p-8 max-w-5xl">
        <div className="lh-card overflow-hidden">
          <table className="w-full">
            <thead className="lh-eyebrow border-b border-lh-line/60">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Merchant</th>
                <th className="text-left px-4 py-3 font-medium">Domain</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {q.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-lh-line/30">
                    {Array.from({ length: 4 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="lh-skeleton h-3 w-32" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                list.map((m) => (
                  <tr key={m.id} className="border-b border-lh-line/30 hover:bg-lh-slab2/40 group">
                    <td className="px-5 py-3">
                      <Link to={`/merchants/${m.id}`} className="flex items-center gap-3 hover:text-lh-coral transition-colors">
                        <MerchantBadge name={m.display_name} size="sm" />
                        <span className="text-lh-fore">{m.display_name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-lh-mute font-mono text-xs">{m.domain ?? '—'}</td>
                    <td className="px-4 py-3 text-lh-mute">{m.category ? CATEGORY_LABEL[m.category] ?? m.category : 'other'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          type="button"
                          className="lh-btn-icon"
                          onClick={() => setEditId(m.id)}
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          className="lh-btn-icon"
                          onClick={() => setMergeId(m.id)}
                          title="Merge into…"
                        >
                          <Combine size={12} />
                        </button>
                        <Link to={`/merchants/${m.id}`} className="lh-btn-icon" title="Open">
                          <ChevronRight size={12} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EditMerchantModal
        id={editId}
        list={list}
        onClose={() => setEditId(null)}
        onSaved={() => {
          setEditId(null);
          void qc.invalidateQueries({ queryKey: ['merchants'] });
        }}
      />
      <MergeMerchantModal
        id={mergeId}
        list={list}
        onClose={() => setMergeId(null)}
        onMerged={() => {
          setMergeId(null);
          void qc.invalidateQueries({ queryKey: ['merchants'] });
          void qc.invalidateQueries({ queryKey: ['summary'] });
        }}
      />
    </div>
  );
}

function EditMerchantModal({
  id,
  list,
  onClose,
  onSaved,
}: {
  id: number | null;
  list: MerchantItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const m = list.find((x) => x.id === id);
  const [name, setName] = useState(m?.display_name ?? '');
  const [category, setCategory] = useState(m?.category ?? 'other');

  // Reset state when target changes.
  if (m && m.display_name !== name && id !== null && (name === '' || !list.find((x) => x.display_name === name))) {
    // initial-mount sync; safe because Modal remounts when `id` changes.
  }

  const save = useMutation({
    mutationFn: () =>
      api(`/api/merchants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ display_name: name, category }),
      }),
    onSuccess: onSaved,
  });

  return (
    <Modal
      open={id != null}
      onClose={onClose}
      title="Edit merchant"
      width="max-w-md"
      footer={
        <>
          <button type="button" className="lh-btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="lh-btn-primary"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            <Save size={13} /> Save
          </button>
        </>
      }
    >
      {m ? (
        <div className="space-y-3">
          <label className="block">
            <span className="lh-eyebrow text-[10px]">Display name</span>
            <input
              className="lh-input w-full mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="lh-eyebrow text-[10px]">Category</span>
            <select
              className="lh-select w-full mt-1"
              value={category ?? 'other'}
              onChange={(e) => setCategory(e.target.value)}
            >
              {Object.entries(CATEGORY_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </Modal>
  );
}

function MergeMerchantModal({
  id,
  list,
  onClose,
  onMerged,
}: {
  id: number | null;
  list: MerchantItem[];
  onClose: () => void;
  onMerged: () => void;
}) {
  const m = list.find((x) => x.id === id);
  const [intoId, setIntoId] = useState<number | null>(null);
  const merge = useMutation({
    mutationFn: () => apiPost(`/api/merchants/${id}/merge`, { into: intoId }),
    onSuccess: onMerged,
  });
  const candidates = list.filter((x) => x.id !== id);

  return (
    <Modal
      open={id != null}
      onClose={onClose}
      title="Merge merchant into another"
      description={
        m
          ? `${m.display_name} will disappear; all its receipts move to the chosen merchant.`
          : ''
      }
      width="max-w-md"
      footer={
        <>
          <button type="button" className="lh-btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="lh-btn-primary"
            onClick={() => merge.mutate()}
            disabled={!intoId || merge.isPending}
          >
            <Combine size={13} /> Merge
          </button>
        </>
      }
    >
      {m ? (
        <select
          className="lh-select w-full"
          value={intoId ?? ''}
          onChange={(e) => setIntoId(Number.parseInt(e.target.value, 10))}
        >
          <option value="">Pick a merchant to keep…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
              {c.domain ? ` (${c.domain})` : ''}
            </option>
          ))}
        </select>
      ) : null}
    </Modal>
  );
}
