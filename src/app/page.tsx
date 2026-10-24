"use client";

import { useEffect } from "react";

export default function RootPage() {
  useEffect(() => {
    window.location.replace("/track-your-sales/home/");
  }, []);
  return <div className="p-10 text-center text-neutral-500">بيحمّل Track Your Sales...</div>;
}
