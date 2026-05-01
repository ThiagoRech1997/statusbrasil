"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import { useTheme } from "next-themes";

export function ScalarReference({ specUrl }: { specUrl: string }) {
  const { resolvedTheme } = useTheme();
  return (
    <ApiReferenceReact
      configuration={{
        url: specUrl,
        theme: "default",
        darkMode: resolvedTheme === "dark",
        hideClientButton: false,
      }}
    />
  );
}
