"use client";
import { useEffect } from "react";
export default function RootPage() {
  useEffect(() => { window.location.replace("/track-your-sales/home/"); }, []);
  return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#fffaf5] p-6"><a href="/track-your-sales/home/" className="rounded-2xl bg-[#c6530b] px-6 py-4 font-extrabold text-white">افتح Track Your Sales</a></main>;
}
