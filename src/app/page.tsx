"use client";

import { useEffect } from "react";

export default function RootPage() {
  useEffect(() => {
    // GitHub Pages is hosted below /track-your-sales; keep a real link in the
    // exported HTML as a fallback if client-side navigation cannot hydrate.
    window.location.replace("/track-your-sales/home/");
  }, []);

  return (
    <main
      dir="rtl"
      className="tys-landing flex min-h-[100svh] items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_#fff7ed_0%,_#fff_42%,_#fff1e6_100%)] px-5 py-10"
    >
      <section className="w-full max-w-sm rounded-[30px] border border-orange-100 bg-white/90 p-7 text-center shadow-[0_24px_70px_rgba(157,65,10,0.12)] backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#ff9d38] to-[#d95b00] text-3xl text-white shadow-lg shadow-orange-200">
          ↗
        </div>
        <p className="mt-5 text-xs font-extrabold tracking-[0.18em] text-[#c45a16]">TRACK YOUR SALES</p>
        <h1 className="mt-2 text-xl font-black text-[#25201c]">تراك يور سيلز</h1>
        <p className="mt-2 text-sm leading-7 text-[#76675c]">مساحتك لمتابعة إنجازك وتنظيم مبيعاتك</p>
        <a
          href="/track-your-sales/home/"
          className="mt-6 flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-l from-[#bd4b0a] to-[#ed741d] px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(217,91,0,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(217,91,0,0.3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#bd4b0a]"
        >
          افتح التطبيق
        </a>
        <p className="mt-4 text-[11px] font-medium text-[#a18d7d]">لو التحميل التلقائي متأخر، اضغط هنا للمتابعة</p>
      </section>
    </main>
  );
}
