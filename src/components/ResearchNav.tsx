"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "研究台", match: (path: string) => path === "/" || path.startsWith("/funds/") },
  { href: "/insights/market", label: "市場短評", match: (path: string) => path.startsWith("/insights/market") },
  { href: "/insights/spotlight", label: "基金焦點", match: (path: string) => path.startsWith("/insights/spotlight") },
] as const;

export function ResearchNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="research-nav" aria-label="研究台分頁">
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link key={link.href} href={link.href} className={active ? "is-on" : undefined} aria-current={active ? "page" : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
