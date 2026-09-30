import { ResearchNav } from "@/components/ResearchNav";

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ResearchNav />
      {children}
      <footer className="site-footer">本工具僅供內部銷售參考，並非投資建議。過往表現不代表將來表現。</footer>
    </>
  );
}
