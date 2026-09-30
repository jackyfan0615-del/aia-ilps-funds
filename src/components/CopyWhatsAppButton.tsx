"use client";

import { useState } from "react";

type Props = {
  text: string;
};

export function CopyWhatsAppButton({ text }: Props) {
  const [note, setNote] = useState<string | null>(null);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      setNote("已複製，可直接貼到 WhatsApp。");
    } catch {
      setNote("複製失敗，請手動反白文字。");
    }
  }

  return (
    <div className="copy-wa">
      <button type="button" className="summary-btn" onClick={() => void copy()}>
        複製 WhatsApp 文字
      </button>
      {note ? <p className="suitability-hint">{note}</p> : null}
    </div>
  );
}
