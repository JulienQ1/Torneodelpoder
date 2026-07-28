'use client';

import { useState } from 'react';
import type { ImportResult } from '@/shared/types/socket';
import { Button, Card, Input } from '@/shared/components/ui';

interface Props {
  songCount: number;
  onSave: (name?: string) => Promise<{ code: string }>;
  onLoad: (code: string) => Promise<ImportResult>;
}

/** Extract a playlist code from either a raw code or a shared /p/<code> link. */
function parseCode(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/\/p\/([^/?#]+)/i);
  return (m ? m[1]! : trimmed).toUpperCase();
}

/** Admin tools to save the current playlist to a link, or load a saved one. */
export function PlaylistTools({ songCount, onSave, onLoad }: Props) {
  const [name, setName] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setSaveError(null);
    setLink(null);
    try {
      const { code: saved } = await onSave(name.trim() || undefined);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setLink(`${origin}/p/${saved}`);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function load() {
    const parsed = parseCode(code);
    if (!parsed) return;
    setLoading(true);
    setLoadMsg(null);
    try {
      const res = await onLoad(parsed);
      const dup = res.duplicatesSkipped > 0 ? ` (${res.duplicatesSkipped} en double ignorée·s)` : '';
      setLoadMsg({
        ok: true,
        text:
          res.added.length > 0
            ? `${res.added.length} musique·s ajoutée·s${dup}.`
            : `Rien de nouveau à ajouter${dup}.`,
      });
      setCode('');
    } catch (e) {
      setLoadMsg({ ok: false, text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <h3 className="text-sm font-semibold text-slate-200">Playlists</h3>

      {/* Save */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Nom (optionnel)"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            className="flex-none"
            variant="secondary"
            onClick={save}
            loading={saving}
            disabled={songCount === 0}
          >
            💾 Sauvegarder
          </Button>
        </div>
        {link && (
          <div className="flex items-center gap-2 rounded-xl border border-brand-700/50 bg-brand-950/30 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-brand-200">{link}</span>
            <button
              onClick={copy}
              className="flex-none rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
            >
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>
        )}
        {saveError && <p className="text-xs text-rose-300">{saveError}</p>}
        <p className="text-xs text-slate-500">
          Génère un lien réutilisable pour recommencer ce tournoi plus tard.
        </p>
      </div>

      <div className="border-t border-slate-800" />

      {/* Load */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Code ou lien de playlist"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') load();
            }}
          />
          <Button className="flex-none" variant="secondary" onClick={load} loading={loading}>
            Charger
          </Button>
        </div>
        {loadMsg && (
          <p className={loadMsg.ok ? 'text-xs text-emerald-300' : 'text-xs text-rose-300'}>
            {loadMsg.text}
          </p>
        )}
      </div>
    </Card>
  );
}
