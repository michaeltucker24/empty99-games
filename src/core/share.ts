// Share results: native share sheet on phones, clipboard elsewhere,
// plus a downloadable image card sized for stories (1080x1920).

export async function shareText(text: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  const full = `${text}\n${url}`;
  try {
    if (navigator.share) {
      await navigator.share({ text: full });
      return 'shared';
    }
  } catch {
    /* user cancelled or share failed; fall back to clipboard */
  }
  try {
    await navigator.clipboard.writeText(full);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export interface CardSpec {
  title: string; // e.g. "Mental Math Sprint #3"
  big: string; // e.g. "4,200 m"
  sub: string; // e.g. "34 correct · 5-day streak"
  accent: string; // signature color
  footer: string; // URL
}

/** Draws a story-sized card and returns a PNG blob. */
export async function makeCard(spec: CardSpec): Promise<Blob | null> {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1920;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#16161A';
  g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = spec.accent;
  g.beginPath();
  g.arc(540, 820, 360, 0, Math.PI * 2);
  g.fill();
  g.textAlign = 'center';
  g.fillStyle = '#FFD23F';
  g.font = '800 64px "Archivo Variable", system-ui, sans-serif';
  g.fillText('EMPTY 99 STUDIOS', 540, 220);
  g.fillStyle = '#FFFFFF';
  g.font = '700 72px "Archivo Variable", system-ui, sans-serif';
  g.fillText(spec.title, 540, 360);
  g.font = '900 170px "Archivo Variable", system-ui, sans-serif';
  g.fillText(spec.big, 540, 880);
  g.font = '600 58px "Archivo Variable", system-ui, sans-serif';
  g.fillText(spec.sub, 540, 1340);
  g.fillStyle = '#FFD23F';
  g.font = '700 52px "Archivo Variable", system-ui, sans-serif';
  g.fillText('Can you beat it?', 540, 1560);
  g.fillStyle = '#B4B2A9';
  g.font = '500 44px "Archivo Variable", system-ui, sans-serif';
  g.fillText(spec.footer, 540, 1760);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

export async function downloadCard(spec: CardSpec, filename: string): Promise<void> {
  const blob = await makeCard(spec);
  if (!blob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
