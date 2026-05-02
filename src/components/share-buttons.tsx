"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// twitter.com/intent/tweet still 301-redirects to x.com/intent/post; kept on
// the legacy host to match the ticket spec verbatim and stay link-stable for
// shares already in the wild.
const TWITTER_INTENT = "https://twitter.com/intent/tweet";
const BLUESKY_INTENT = "https://bsky.app/intent/compose";
const FEEDBACK_TIMEOUT_MS = 2500;

export interface ShareButtonsProps {
  /** Canonical URL to share. Required so Twitter/Bluesky intents and copy all reference the same target. */
  url: string;
  /** Pre-composed text for the post. Falls back to a generic localized string when omitted. */
  text?: string;
  /** Service display name, used to build the default text when `text` is omitted. */
  serviceName?: string;
  className?: string;
}

type FeedbackState = "idle" | "copied" | "failed";

export function ShareButtons({ url, text, serviceName, className }: ShareButtonsProps) {
  const t = useTranslations("ShareButtons");
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current);
    };
  }, []);

  const composedText =
    text ?? (serviceName != null ? t("shareTextDefault", { service: serviceName }) : "");

  const twitterHref = `${TWITTER_INTENT}?text=${encodeURIComponent(composedText)}&url=${encodeURIComponent(url)}`;
  // Bluesky's compose intent only accepts a `text` param — embed the URL inline so it ends up in the post body.
  const blueskyText = composedText ? `${composedText} ${url}` : url;
  const blueskyHref = `${BLUESKY_INTENT}?text=${encodeURIComponent(blueskyText)}`;

  const showFeedback = useCallback((next: FeedbackState) => {
    setFeedback(next);
    if (timerRef.current != null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFeedback("idle"), FEEDBACK_TIMEOUT_MS);
  }, []);

  const handleCopy = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        showFeedback("copied");
        return;
      } catch {
        // fall through to legacy path
      }
    }
    if (legacyCopy(url)) {
      showFeedback("copied");
    } else {
      showFeedback("failed");
    }
  }, [url, showFeedback]);

  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> is for form controls; for an action-button group, role="group" with aria-label is the WAI-ARIA pattern.
    <div
      role="group"
      aria-label={t("groupLabel")}
      data-slot="share-buttons"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <a
        href={twitterHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("ariaTwitter")}
        data-share-target="twitter"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <TwitterIcon />
        {t("twitter")}
      </a>
      <a
        href={blueskyHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("ariaBluesky")}
        data-share-target="bluesky"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BlueskyIcon />
        {t("bluesky")}
      </a>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t("ariaCopy")}
        data-share-target="copy"
        data-feedback={feedback}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {feedback === "copied" ? (
          <Check aria-hidden className="size-3.5 text-operational-foreground" />
        ) : (
          <Copy aria-hidden className="size-3.5" />
        )}
        {feedback === "copied" ? t("copied") : t("copyLink")}
      </button>
      <span role="status" aria-live="polite" data-slot="share-feedback" className="sr-only">
        {feedback === "copied" ? t("copied") : feedback === "failed" ? t("copyFailed") : ""}
      </span>
    </div>
  );
}

function legacyCopy(value: string): boolean {
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    // Deprecated but still the only synchronous path on legacy browsers / non-HTTPS.
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

function TwitterIcon() {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon next to text label; the parent <a> already carries an aria-label.
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-3.5"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231ZM17.083 19.77h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function BlueskyIcon() {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon next to text label; the parent <a> already carries an aria-label.
    <svg
      aria-hidden
      viewBox="0 0 64 57"
      fill="currentColor"
      className="size-3.5"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M13.873 3.804C21.21 9.295 29.103 20.43 32 26.405c2.897-5.974 10.79-17.11 18.127-22.601C53.396 1.328 58.788-.598 61.014.31c2.226.908 2.84 4.84 2.84 7.137 0 2.298-1.162 16.85-1.92 19.213-2.628 8.205-10.74 10.376-17.95 9.045 12.61 2.327 15.815 9.534 8.882 16.74-13.16 13.681-18.911-3.435-20.385-7.821-.27-.804-.396-1.18-.398-.86-.002-.32-.13.057-.4.86-1.476 4.386-7.225 21.502-20.387 7.82-6.93-7.205-3.726-14.412 8.882-16.74-7.21 1.331-15.32-.84-17.95-9.045C1.475 24.295.31 9.745.31 7.448c0-2.298.616-6.23 2.84-7.137C5.378-.6 10.766 1.328 13.873 3.804Z" />
    </svg>
  );
}
