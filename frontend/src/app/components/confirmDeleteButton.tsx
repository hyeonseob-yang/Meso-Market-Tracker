"use client";

import { useState } from "react";

const DELETE_BUTTON_CLASS =
  "rounded px-3 py-1 text-sm font-medium bg-white text-red-600 hover:bg-red-50 disabled:opacity-50";

// Delete button that asks "Delete this <itemName>?" inline before calling onConfirm.
export default function ConfirmDeleteButton({
  itemName,
  isDeleting,
  onConfirm,
}: {
  itemName: string;
  isDeleting: boolean;
  onConfirm: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isDeleting) {
    return (
      <button type="button" disabled className={DELETE_BUTTON_CLASS}>
        Deleting…
      </button>
    );
  }

  if (!isConfirming) {
    return (
      <button type="button" onClick={() => setIsConfirming(true)} className={DELETE_BUTTON_CLASS}>
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span className="text-sm text-gray-700">Delete this {itemName}?</span>
      <button
        type="button"
        onClick={() => {
          setIsConfirming(false);
          onConfirm();
        }}
        className="rounded px-3 py-1 text-sm font-medium bg-red-600 text-white hover:bg-red-700"
      >
        Delete
      </button>
      <button
        type="button"
        onClick={() => setIsConfirming(false)}
        className="rounded px-3 py-1 text-sm font-medium bg-white text-gray-700 hover:bg-gray-200"
      >
        Cancel
      </button>
    </span>
  );
}
