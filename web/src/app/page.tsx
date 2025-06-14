// Copyright (c) 2025 YADRA

import { useMemo } from "react";

import { SiteHeader } from "./chat/components/site-header";
import { HeroSection } from "./landing/components/hero-section";
import { Ray } from "./landing/components/ray";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center min-h-screen">
      <SiteHeader />
      <main className="flex-1 w-full">
        <HeroSection />
      </main>
      <Footer />
      <Ray />
    </div>
  );
}

function Footer() {
  const year = useMemo(() => new Date().getFullYear(), []);
  return (
    <footer className="container mt-32 flex flex-col items-center justify-center">
      <hr className="from-border/0 via-border/70 to-border/0 m-0 h-px w-full border-none bg-gradient-to-r" />
      <div className="text-muted-foreground container flex h-20 flex-col items-center justify-center text-sm">
        <p className="text-center font-serif text-lg md:text-xl">
          &quot;Originated from Open Source, give back to Open Source.&quot;
        </p>
      </div>
      <div className="text-muted-foreground container mb-8 flex flex-col items-center justify-center text-xs">
        {/* <p>Licensed under MIT License</p> */}
        <p>&copy; {year} YADRA</p>
      </div>
    </footer>
  );
}
