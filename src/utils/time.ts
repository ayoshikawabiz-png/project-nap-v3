export function formatHms(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}時 ${String(m).padStart(2, '0')}分 ${String(s).padStart(2, '0')}秒`;
}
