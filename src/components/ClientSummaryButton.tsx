"use client";

import { useRef, useState } from "react";
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
  const [html, setHtml] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  function openPreview() {
    const model = buildClientSummary({ clientName, answers, pick, portfolio });
    setHtml(clientSummaryHtml(model));
  }

  function printPreview() {
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }

  return (
    <div className="summary-box">
      <p className="summary-title">一頁客戶摘要</p>
      <p className="suitability-hint">
        答完四題後填姓名，預覽後用瀏覽器列印／另存 PDF。姓名只留在這次操作，不會上傳伺服器。
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
      <button type="button" className="summary-btn" onClick={openPreview}>
        產生一頁 A4 摘要
      </button>

      {html ? (
        <div className="summary-modal" role="dialog" aria-labelledby="summary-dialog-title">
          <div className="summary-modal-inner">
            <div className="summary-modal-bar">
              <p id="summary-dialog-title" className="summary-title">
                摘要預覽
              </p>
              <div className="review-actions">
                <button type="button" className="summary-btn" onClick={printPreview}>
                  列印／另存 PDF
                </button>
                <button type="button" className="expand-btn" onClick={() => setHtml(null)}>
                  關閉
                </button>
              </div>
            </div>
            <iframe
              ref={frameRef}
              className="summary-frame"
              title="客戶摘要 A4 預覽"
              srcDoc={html}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
