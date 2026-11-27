"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

// The viewer's timezone is only known in the browser, so this fills in after mount.
export default function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(format(new Date(iso), "MMM d, yyyy HH:mm"));
  }, [iso]);

  return <time dateTime={iso}>{text ?? ""}</time>;
}
