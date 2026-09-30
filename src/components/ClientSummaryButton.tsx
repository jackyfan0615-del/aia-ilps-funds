"use client";

import { useState } from "react";
import { buildClientSummary, clientSummaryHtml } from "@/lib/client-summary";
import type { ResolvedPortfolio } from "@/lib/portfolios";
import type { SuitabilityAnswers, SuitabilityResult } from "@/lib/suitability";

type Props = {
  answers: SuitabilityAnswers;
  pick: SuitabilityResult;
  portfolio: ResolvedPortfolio;
};

export function ClientSummaryButton({ answers, pick, portfolio }: Props) {
  const [clientName, setClientName] = useState("");

  function printSummary() {
    const model = buildClientSummary({ clientName, answers, pick, portfolio });
    const html = clientSummaryHtml(model);
    const popup = window.open("", "_blank", "noopener,noreferrer,width=820,height=1100");
    if (!popup) {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <div className="summary-box">
      <p className="summary-title">一頁客戶摘要</p>
      <p className="suitability-hint">
        答完四題後填姓名，以瀏覽器列印／另存 PDF。姓名只留在這次操作，不會上傳伺服器。
      </p>
      <label className="sim-field">
        <span>客戶姓名（只用於這頁摘要）</span>
        <input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          autoComplete="off"
          placeholder="例如：陳大文"
        />
      </label>
      <button type="button" className="summary-btn" onClick={printSummary}>
        產生一頁 A4 摘要
      </button>
    </div>
  );
}
