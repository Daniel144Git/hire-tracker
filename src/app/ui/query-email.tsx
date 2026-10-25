"use client";

import { useId, useState } from "react";

/**
 * A query email to check, edit, copy or open in the person's own email app. The app never
 * sends it: the person does, from their own mailbox.
 */
export function QueryEmail({
  title,
  subject: initialSubject,
  body: initialBody,
}: {
  title: string;
  subject: string;
  body: string;
}) {
  const id = useId();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [copied, setCopied] = useState(false);
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <details className="rounded border border-gray-300 p-3">
      <summary className="cursor-pointer font-medium">{title}</summary>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-subject`} className="text-sm font-medium">
            Subject
          </label>
          <input
            id={`${id}-subject`}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="rounded border border-gray-400 bg-background px-2 py-1"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-body`} className="text-sm font-medium">
            Message
          </label>
          <textarea
            id={`${id}-body`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={Math.min(20, body.split("\n").length + 1)}
            className="rounded border border-gray-400 bg-background px-2 py-1 font-mono text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded border border-gray-500 px-3 py-1 font-medium"
            onClick={async () => {
              await navigator.clipboard.writeText(`${subject}\n\n${body}`);
              setCopied(true);
            }}
          >
            Copy
          </button>
          <a href={mailto} className="text-blue-700 underline dark:text-blue-400">
            Open in your email app
          </a>
          {copied && (
            <span role="status" className="text-sm text-green-800 dark:text-green-400">
              Copied
            </span>
          )}
        </div>
      </div>
    </details>
  );
}
