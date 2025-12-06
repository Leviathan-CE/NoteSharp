import React, { useMemo, useState } from "react";
import { SafeMarkdown } from "../lib/markdown";

export type Note = {
  id?: string;
  title?: string;
  content: string; // raw markdown or lateX
  updatedAt?: number;
};

type NoteCardProps = {
  value: Note;
  onChange: (next: Note) => void;
  readOnly?: boolean;
  preview?: boolean; // if true, show preview; otherwise show editor
};

export default function NoteCard({ value, onChange, readOnly, preview }: NoteCardProps) {
  const [local, setLocal] = useState(value.content ?? "");

  // simple debounce to avoid spam updates
  useMemo(() => {
    const id = setTimeout(() => {
      if (local !== value.content) {
        onChange({ ...value, content: local, updatedAt: Date.now() });
      }
    }, 250);
    return () => clearTimeout(id);
  }, [local]); // eslint-disable-line

  if (preview || readOnly) {
    return (
      <div className="note-card preview">
        <SafeMarkdown markdown={value.content || ""} />
      </div>
    );
  }

  return (
    <div className="note-card editor">
      <textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Write Markdown here. Use $...$ or $$...$$ for LaTeX."
        spellCheck={false}
        rows={10}
        style={{ width: "100%", resize: "vertical" }}
      />
      <div className="note-card preview" style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid #ddd" }}>
        <SafeMarkdown markdown={local} />
      </div>
    </div>
  );
}