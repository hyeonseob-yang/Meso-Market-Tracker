"use client";

import { useState, type FormEvent } from "react";

import {
  createAlertSubscription,
  deleteAlertSubscription,
  updateAlertSubscription,
  type AlertSubscription,
} from "../alertActions";

export default function AlertSubscriptionsList({
  initialSubscriptions,
}: {
  initialSubscriptions: AlertSubscription[];
}) {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [name, setName] = useState("");
  const [high, setHigh] = useState("");
  const [low, setLow] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);
    const { subscription, error } = await createAlertSubscription(
      webhookUrl,
      name,
      high ? Number(high) : null,
      low ? Number(low) : null,
    );
    setIsCreating(false);
    if (error) {
      setCreateError(error);
      return;
    }
    if (subscription) {
      setSubscriptions((prev) => [...prev, subscription]);
      setWebhookUrl("");
      setName("");
      setHigh("");
      setLow("");
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    const ok = await deleteAlertSubscription(id);
    setDeletingId(null);
    if (ok) {
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-gray-900">Price Alerts</h2>

      <form onSubmit={handleCreate} className="mb-6 flex flex-col gap-2 rounded border border-gray-200 bg-white p-4">
        <input
          type="url"
          required
          placeholder="Discord webhook URL"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <input
          type="text"
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="High threshold (optional)"
            value={high}
            onChange={(e) => setHigh(e.target.value)}
            className="w-1/2 rounded border border-gray-300 px-3 py-2"
          />
          <input
            type="number"
            placeholder="Low threshold (optional)"
            value={low}
            onChange={(e) => setLow(e.target.value)}
            className="w-1/2 rounded border border-gray-300 px-3 py-2"
          />
        </div>
        {createError && <p className="text-sm text-red-600">{createError}</p>}
        <button
          type="submit"
          disabled={isCreating}
          className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isCreating ? "Creating…" : "Create Alert"}
        </button>
      </form>

      {subscriptions.length === 0 ? (
        <p className="text-gray-600">No alerts yet.</p>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) =>
            editingId === sub.id ? (
              <EditForm
                key={sub.id}
                subscription={sub}
                onCancel={() => setEditingId(null)}
                onSaved={(updated) => {
                  setSubscriptions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
                  setEditingId(null);
                }}
              />
            ) : (
              <div key={sub.id} className="rounded border border-gray-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{sub.name}</p>
                    <p className="truncate text-sm text-gray-600">{sub.webhookUrl}</p>
                    <p className="text-sm text-gray-600">
                      {sub.high !== null && `high: ${sub.high}`}
                      {sub.high !== null && sub.low !== null && " · "}
                      {sub.low !== null && `low: ${sub.low}`}
                      {sub.high === null && sub.low === null && "no thresholds set"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(sub.id)}
                      className="rounded px-3 py-1 text-sm font-medium bg-white text-gray-700 hover:bg-gray-200"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(sub.id)}
                      disabled={deletingId === sub.id}
                      className="rounded px-3 py-1 text-sm font-medium bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === sub.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function EditForm({
  subscription,
  onCancel,
  onSaved,
}: {
  subscription: AlertSubscription;
  onCancel: () => void;
  onSaved: (updated: AlertSubscription) => void;
}) {
  const [name, setName] = useState(subscription.name);
  const [high, setHigh] = useState(subscription.high?.toString() ?? "");
  const [low, setLow] = useState(subscription.low?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    const { subscription: updated, error } = await updateAlertSubscription(
      subscription.id,
      name,
      high ? Number(high) : null,
      low ? Number(low) : null,
    );
    setIsSaving(false);
    if (error) {
      setError(error);
      return;
    }
    if (updated) {
      onSaved(updated);
    }
  }

  return (
    <form onSubmit={handleSave} className="rounded border border-gray-200 bg-white p-4">
      <p className="mb-2 truncate text-sm text-gray-600">{subscription.webhookUrl}</p>
      <div className="flex flex-col gap-2">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="High threshold (optional)"
            value={high}
            onChange={(e) => setHigh(e.target.value)}
            className="w-1/2 rounded border border-gray-300 px-3 py-2"
          />
          <input
            type="number"
            placeholder="Low threshold (optional)"
            value={low}
            onChange={(e) => setLow(e.target.value)}
            className="w-1/2 rounded border border-gray-300 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-2 text-sm font-medium bg-white text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
