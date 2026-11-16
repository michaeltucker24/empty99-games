// "Share score" sheet: pick a platform and jump straight to it with the score pre-written
// where the platform allows it. Instagram/TikTok get the story image via the phone's share sheet.

import { useState } from 'react';
import { makeCard, type CardSpec } from '../core/share';
import { track } from '../core/analytics';

export interface ShareData {
  game: string;
  text: string; // score line, no URL
  url: string; // full https URL
  card: CardSpec;
  fileName: string;
}

type Target = { id: string; name: string; icon: string; color: string; href?: (d: ShareData) => string };

const enc = encodeURIComponent;
const TARGETS: Target[] = [
  { id: 'instagram', name: 'Instagram', icon: '📸', color: '#D4537E' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#16161A' },
  { id: 'x', name: 'X', icon: '𝕏', color: '#16161A', href: (d) => `https://x.com/intent/tweet?text=${enc(d.text)}&url=${enc(d.url)}` },
  { id: 'threads', name: 'Threads', icon: '@', color: '#16161A', href: (d) => `https://www.threads.net/intent/post?text=${enc(`${d.text} ${d.url}`)}` },
  { id: 'whatsapp', name: 'WhatsApp', icon: '💬', color: '#1D9E75', href: (d) => `https://wa.me/?text=${enc(`${d.text} ${d.url}`)}` },
  { id: 'facebook', name: 'Facebook', icon: 'f', color: '#185FA5', href: (d) => `https://www.facebook.com/sharer/sharer.php?u=${enc(d.url)}` },
  { id: 'linkedin', name: 'LinkedIn', icon: 'in', color: '#0C447C', href: (d) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(d.url)}` },
  { id: 'reddit', name: 'Reddit', icon: '👽', color: '#D85A30', href: (d) => `https://www.reddit.com/submit?url=${enc(d.url)}&title=${enc(d.text)}` },
  { id: 'sms', name: 'Text', icon: '✉️', color: '#378ADD', href: (d) => `sms:?&body=${enc(`${d.text} ${d.url}`)}` },
];

const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function ShareMenu({ data, onClose, toast }: { data: ShareData; onClose: () => void; toast: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);
  const targets = TARGETS.filter((t) => t.id !== 'sms' || isPhone());

  async function shareImage(platform: string) {
    setBusy(true);
    try {
      const blob = await makeCard(data.card);
      if (!blob) throw new Error('no image');
      const file = new File([blob], data.fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${data.text} ${data.url}` });
        toast(`Pick ${platform} to post your story.`);
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = data.fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        toast(`Image saved. Post it to ${platform} from your phone.`);
      }
    } catch {
      /* user cancelled the share sheet */
    } finally {
      setBusy(false);
    }
  }

  function go(t: Target) {
    track(data.game, 'share_click', { platform: t.id });
    if (t.id === 'instagram' || t.id === 'tiktok') return shareImage(t.name);
    const href = t.href!(data);
    if (t.id === 'sms') window.location.href = href;
    else window.open(href, '_blank', 'noopener,noreferrer');
    onClose();
  }

  async function copy() {
    track(data.game, 'share_click', { platform: 'copy' });
    try {
      await navigator.clipboard.writeText(`${data.text} ${data.url}`);
      toast('Copied! Paste it anywhere.');
    } catch {
      toast('Could not copy');
    }
    onClose();
  }

  async function more() {
    track(data.game, 'share_click', { platform: 'native' });
    try {
      await navigator.share({ text: data.text, url: data.url });
    } catch {
      /* cancelled */
    }
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sharesheet" role="dialog" aria-label="Share your score" onClick={(e) => e.stopPropagation()}>
        <div className="sharesheet-head">
          <strong>Share your score</strong>
          <button className="iconbtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="sharesheet-preview">
          {data.text}
          <span>{data.url.replace('https://', '')}</span>
        </p>
        <div className="sharegrid">
          {targets.map((t) => (
            <button key={t.id} className="sharebtn" onClick={() => go(t)} disabled={busy}>
              <span className="shareico" style={{ background: t.color }}>
                {t.icon}
              </span>
              {t.name}
            </button>
          ))}
        </div>
        <p className="sharesheet-note">Instagram and TikTok get your story image, ready to post.</p>
        <div className="row">
          <button className="btn small" onClick={copy}>
            🔗 Copy text
          </button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button className="btn small" onClick={more}>
              ⋯ More apps
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
