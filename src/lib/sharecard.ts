export async function shareAchievement(opts: { monthLabel: string; percent: number; commission: string }) {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1080;
  const g = c.getContext("2d");
  if (!g) return;
  g.fillStyle = "#fff4eb";
  g.fillRect(0, 0, 1080, 1080);
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.roundRect(60, 60, 960, 960, 48);
  g.fill();
  g.direction = "rtl";
  g.textAlign = "center";
  g.fillStyle = "#a17d65";
  g.font = "700 44px Mada, sans-serif";
  g.fillText(`إنجازي في ${opts.monthLabel}`, 540, 230);
  g.fillStyle = "#e96812";
  g.font = "900 300px Mada, sans-serif";
  g.fillText(`${opts.percent}%`, 540, 600);
  g.fillStyle = "#2d2119";
  g.font = "800 52px Mada, sans-serif";
  g.fillText(`العمولة المتوقعة ${opts.commission} جنيه`, 540, 740);
  g.fillStyle = "#a17d65";
  g.font = "700 38px Mada, sans-serif";
  g.fillText("Track Your Sales", 540, 940);
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/png"));
  if (!blob) return;
  const file = new File([blob], "my-achievement.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
    } catch {}
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "my-achievement.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
