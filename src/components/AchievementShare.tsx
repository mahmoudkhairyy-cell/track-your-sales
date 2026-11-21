"use client";

import { useState } from "react";
import { formatPercent, formatQty } from "@/lib/calculations";

type Kpi = {
  kpiKey: string; nameEn: string; unitAr: string; target: number;
  achieved: number; percent: number; remaining: number; weight: number;
};
type Props = {
  name: string; branch: string; monthLabel: string; overall: number; kpis: Kpi[];
};

const ORANGE = "#f07818";
const DEEP = "#a9470c";
const INK = "#2b1b12";

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
function drawText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, weight = 700) {
  ctx.font = `${weight} ${size}px Cairo, Tahoma, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = "right"; ctx.direction = "rtl"; ctx.fillText(value, x, y);
}

export default function AchievementShare({ name, branch, monthLabel, overall, kpis }: Props) {
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      canvas.width = 1080; canvas.height = 1350;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("تعذر تجهيز الصورة");

      const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
      bg.addColorStop(0, "#fffaf5"); bg.addColorStop(.55, "#fff1e3"); bg.addColorStop(1, "#ffe1c5");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1350);
      ctx.fillStyle = ORANGE; ctx.fillRect(0, 0, 1080, 18);
      ctx.globalAlpha = .09; ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(1000, 70, 250, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;

      drawText(ctx, "TRACK YOUR SALES", 1000, 92, 36, DEEP, 900);
      drawText(ctx, "تقرير الإنجاز الشهري", 1000, 145, 30, INK, 800);
      ctx.fillStyle = "#edc7a7"; ctx.fillRect(80, 178, 920, 2);
      drawText(ctx, name, 1000, 238, 38, INK, 900);
      drawText(ctx, `الفرع: ${branch}`, 1000, 286, 25, "#80634f", 700);
      drawText(ctx, monthLabel, 1000, 330, 24, "#80634f", 700);

      rounded(ctx, 80, 375, 920, 245, 34);
      const hero = ctx.createLinearGradient(80, 375, 1000, 620);
      hero.addColorStop(0, "#ff9b48"); hero.addColorStop(1, "#bd4e0a");
      ctx.fillStyle = hero; ctx.fill();
      ctx.textAlign = "center"; ctx.direction = "rtl";
      ctx.fillStyle = "#fff"; ctx.font = "800 30px Cairo, Tahoma"; ctx.fillText("إجمالي تحقيق التارجت", 540, 440);
      ctx.font = "900 104px Cairo, Tahoma"; ctx.fillText(`${formatPercent(overall)}%`, 540, 555);
      ctx.font = "600 22px Cairo, Tahoma"; ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fillText(overall >= 100 ? "تم تحقيق التارجت بالكامل 🎉" : `المتبقي ${formatPercent(Math.max(0, 100 - overall))}% للوصول إلى 100%`, 540, 595);

      drawText(ctx, "تفاصيل مؤشرات الأداء", 1000, 690, 32, INK, 900);
      const rows = kpis.filter(k => k.weight > 0);
      const gap = 10, rowH = Math.min(104, Math.floor((540 - gap * Math.max(0, rows.length - 1)) / Math.max(1, rows.length)));
      const compactRows = rowH < 96;
      rows.forEach((k, i) => {
        const y = 720 + i * (rowH + gap);
        rounded(ctx, 80, y, 920, rowH, 22);
        ctx.fillStyle = "#fff"; ctx.fill();
        drawText(ctx, k.nameEn, 960, y + (compactRows ? 23 : 34), compactRows ? 21 : 25, INK, 800);
        drawText(ctx, `${formatQty(k.achieved)} / ${formatQty(k.target)} ${k.unitAr}`, 960, y + (compactRows ? 44 : 70), compactRows ? 16 : 21, "#80634f", 700);
        ctx.textAlign = "left"; ctx.direction = "ltr"; ctx.font = `800 ${compactRows ? 21 : 25}px Cairo, Tahoma`; ctx.fillStyle = DEEP;
        ctx.fillText(`${formatPercent(k.percent)}%`, 120, y + (compactRows ? 26 : 43));
        ctx.font = `600 ${compactRows ? 14 : 18}px Cairo, Tahoma`; ctx.fillStyle = "#80634f";
        ctx.fillText(`متبقي ${formatQty(k.remaining)}`, 120, y + (compactRows ? 45 : 73));
        const barX = 120, barY = y + rowH - (compactRows ? 8 : 16), barW = 840;
        rounded(ctx, barX, barY, barW, 7, 4); ctx.fillStyle = "#f4e5d8"; ctx.fill();
        rounded(ctx, barX, barY, barW * Math.min(1, Math.max(0, k.percent / 100)), 7, 4);
        ctx.fillStyle = k.percent >= 100 ? "#15966b" : k.percent >= 70 ? ORANGE : "#dc654f"; ctx.fill();
      });

      drawText(ctx, "إنجازك يستاهل يتشاف", 1000, 1290, 25, DEEP, 900);
      ctx.textAlign = "left"; ctx.direction = "ltr"; ctx.font = "600 17px Cairo, Tahoma"; ctx.fillStyle = "#987d69";
      ctx.fillText("Independent tool · Not affiliated with Orange", 80, 1290);

      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("فشل إنشاء الصورة")), "image/png"));
      const file = new File([blob], "track-your-sales-achievement.png", { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: "إنجازي - Track Your Sales", text: "تقرير إنجازي الشهري", files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        alert(error instanceof Error ? error.message : "حصلت مشكلة أثناء تجهيز الصورة");
      }
    } finally { setBusy(false); }
  }

  return (
    <button type="button" onClick={share} disabled={busy}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#c6530b] to-[#f07818] px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-900/15 transition hover:brightness-105 disabled:opacity-60">
      <span aria-hidden="true">↗</span>{busy ? "بنجهّز صورة إنجازك..." : "شارك إنجازك في صورة"}
    </button>
  );
}
