"use client";

import { useRef } from "react";

// Delete button that opens a modal "Delete <itemName>?" dialog before calling onConfirm.
// Native <dialog> + showModal(): dims the page, traps focus, and closes on Esc.
export default function ConfirmDeleteButton({
  itemName,
  isDeleting,
  onConfirm,
}: {
  itemName: string;
  isDeleting: boolean;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        disabled={isDeleting}
        className="rounded px-3 py-1 text-sm font-medium bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isDeleting ? "Deleting…" : "Delete"}
      </button>
      {/* m-auto: Tailwind's base styles zero the margin that centres a modal dialog. */}
      <dialog ref={dialogRef} className="m-auto w-full max-w-sm rounded-lg p-6 shadow-xl backdrop:bg-black/40">
        <h3 className="text-lg font-medium text-gray-900">Delete {itemName}?</h3>
        <p className="mt-2 text-sm text-gray-600">This can&apos;t be undone.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded px-3 py-1 text-sm font-medium bg-white text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              dialogRef.current?.close();
              onConfirm();
            }}
            className="rounded px-3 py-1 text-sm font-medium bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </dialog>
    </>
  );
}
