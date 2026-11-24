"use client";

import { useEffect } from "react";

export default function WelcomeRedirectPage() {
  useEffect(() => {
    window.location.replace("/track-your-sales/home/");
  }, []);
  return null;
}
