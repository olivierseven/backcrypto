"use client";

/**
 * Overlay de entrada de texto: máx. 48 caracteres por linha, máx. 4 linhas.
 * Limite aplicado durante a digitação (antes do OK). UTF-8, aceita acentuação.
 */
import { useState, useCallback, useEffect, useRef } from "react";

const MAX_BOX_WIDTH_PX = 300;
const MAX_CHARS_PER_LINE = 48;
const MAX_LINES = 4;

function enforceTextLimit(value: string): string {
  const lines = value.split("\n").slice(0, MAX_LINES);
  return lines.map((line) => line.slice(0, MAX_CHARS_PER_LINE)).join("\n");
}

export interface DrawTextInputOverlayProps {
  x: number;
  y: number;
  defaultColor: string;
  onSubmit: (textContent: string) => void;
  onCancel: () => void;
  tOk?: string;
  tCancel?: string;
}

export function DrawTextInputOverlay({
  x,
  y,
  defaultColor,
  onSubmit,
  onCancel,
  tOk = "OK",
  tCancel = "Cancel",
}: DrawTextInputOverlayProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = enforceTextLimit(e.target.value);
    setValue(next);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Enter") {
        const lineCount = valueRef.current.split("\n").length;
        if (lineCount >= MAX_LINES) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const text = valueRef.current;
        const lineStart = text.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = text.indexOf("\n", start);
        const currentLineLen = (lineEnd === -1 ? text.length : lineEnd) - lineStart;
        const insertLen = end - start;
        if (currentLineLen - insertLen + 1 > MAX_CHARS_PER_LINE) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    [onCancel]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  }, []);

  const handleCopy = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  }, []);

  const handleCut = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmit(value.trim() || " ");
    setValue("");
  }, [value, onSubmit]);

  return (
    <foreignObject x={x} y={y} width={320} height={140} style={{ overflow: "visible" }}>
      <div
        style={{
          width: MAX_BOX_WIDTH_PX,
          maxWidth: MAX_BOX_WIDTH_PX,
          padding: 8,
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          borderRadius: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          border: "1px solid rgba(0,0,0,0.1)",
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onPaste={handlePaste}
          onCopy={handleCopy}
          onCut={handleCut}
          onKeyDown={handleKeyDown}
          placeholder=""
          rows={4}
          maxLength={MAX_LINES * (MAX_CHARS_PER_LINE + 1) - 1}
          style={{
            width: "100%",
            maxWidth: MAX_BOX_WIDTH_PX - 16,
            boxSizing: "border-box",
            resize: "none",
            fontFamily: "inherit",
            fontSize: 13,
            color: defaultColor,
            border: "1px solid rgba(0,0,0,0.2)",
            borderRadius: 4,
            padding: 6,
            marginBottom: 6,
          }}
          data-max-lines={MAX_LINES}
          data-max-chars-per-line={MAX_CHARS_PER_LINE}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              cursor: "pointer",
              border: "1px solid #ccc",
              borderRadius: 4,
              background: "#f5f5f5",
            }}
          >
            {tCancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              cursor: "pointer",
              border: "none",
              borderRadius: 4,
              background: "#1a1a1a",
              color: "#fff",
            }}
          >
            {tOk}
          </button>
        </div>
      </div>
    </foreignObject>
  );
}
