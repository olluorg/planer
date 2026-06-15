interface ShareData {
  streak: number;
  level: number;
  title: string;
  totalXp: number;
  weekXp: number;
  league: string;
  leagueColor: string;
}

export function renderShareCard(d: ShareData): string {
  const W = 1200, H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // bg
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);
  // border accent
  ctx.strokeStyle = d.leagueColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  // brand
  ctx.fillStyle = '#737373';
  ctx.font = '700 28px Inter, sans-serif';
  ctx.fillText('THEDAD', 60, 80);

  // streak
  ctx.fillStyle = '#f97316';
  ctx.font = '900 200px Inter, sans-serif';
  ctx.fillText(`🔥 ${d.streak}`, 60, 280);
  ctx.fillStyle = '#a3a3a3';
  ctx.font = '400 32px Inter, sans-serif';
  ctx.fillText('дней подряд', 60, 330);

  // level
  ctx.fillStyle = '#fafafa';
  ctx.font = '700 56px Inter, sans-serif';
  ctx.fillText(`L${d.level} · ${d.title}`, 60, 430);

  // xp stats
  ctx.fillStyle = '#a3a3a3';
  ctx.font = '400 28px Inter, sans-serif';
  ctx.fillText(`${d.totalXp} XP всего · ${d.weekXp} XP за неделю`, 60, 480);

  // league badge
  ctx.fillStyle = d.leagueColor;
  ctx.font = '900 44px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(d.league, W - 60, 540);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
