"use client";

import { useEffect, useState, type FormEvent } from "react";
import { format } from "date-fns";

import {
  deleteTrade,
  fetchMyTrades,
  fetchTradeProfit,
  recordTrade,
  type Trade,
  type TradeProfit,
  type TradeSide,
} from "../tradeActions";
import { formatAmount, formatSigned, parseAmount100m } from "../tradeFormat";
import ConfirmDeleteButton from "./confirmDeleteButton";
import LocalTime from "./localTime";

// The value format <input type="datetime-local"> uses, in the viewer's timezone.
const LOCAL_INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm";
const SIDE_LABEL: Record<TradeSide, string> = { BUY: "Buy", SELL: "Sell" };

function localNow(): string {
  return format(new Date(), LOCAL_INPUT_FORMAT);
}

function formatPoints(value: number): string {
  return value.toLocaleString("en-US");
}

function describeTrade(trade: Trade): string {
  return `${SIDE_LABEL[trade.side]} ${formatAmount(trade.amount100m)} at ${formatPoints(trade.price)}`;
}

export default function TradeLog({
  initialTrades,
  initialProfit,
}: {
  initialTrades: Trade[];
  initialProfit: TradeProfit | null;
}) {
  const [trades, setTrades] = useState(initialTrades);
  const [profit, setProfit] = useState(initialProfit);
  const [side, setSide] = useState<TradeSide>("BUY");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  // Filled in after mount: "now" in the viewer's timezone isn't known on the server.
  const [tradedAt, setTradedAt] = useState("");
  const [maxTradedAt, setMaxTradedAt] = useState<string | undefined>(undefined);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: number; message: string | null } | null>(null);

  useEffect(() => {
    const now = localNow();
    setTradedAt(now);
    setMaxTradedAt(now);
  }, []);

  async function refresh() {
    const [latestTrades, latestProfit] = await Promise.all([fetchMyTrades(), fetchTradeProfit()]);
    setTrades(latestTrades);
    setProfit(latestProfit);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const amount100m = parseAmount100m(amount);
    if (amount100m === null) {
      setFormError("Amount must be a whole number of 100M units above zero.");
      return;
    }
    const priceValue = Number(price);
    if (!Number.isInteger(priceValue) || priceValue < 1) {
      setFormError("Price must be a whole number of Maple Points above zero.");
      return;
    }
    const when = new Date(tradedAt);
    if (Number.isNaN(when.getTime())) {
      setFormError("Enter when the Trade happened.");
      return;
    }

    setIsSaving(true);
    const { trade, error } = await recordTrade(side, amount100m, priceValue, when.toISOString(), note);
    setIsSaving(false);
    if (!trade) {
      setFormError(error);
      return;
    }

    setAmount("");
    setPrice("");
    setNote("");
    const now = localNow();
    setTradedAt(now);
    setMaxTradedAt(now);
    await refresh();
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    setDeleteError(null);
    const { ok, error } = await deleteTrade(id);
    setDeletingId(null);
    if (ok) {
      await refresh();
    } else {
      setDeleteError({ id, message: error });
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-gray-900">Trades</h2>

      <div className="mb-6 rounded border border-gray-200 bg-white p-4">
        {profit ? (
          <>
            <p className="text-lg font-medium text-gray-900">
              Profit:{" "}
              <span className={profit.profit < 0 ? "text-red-600" : "text-green-700"}>
                {formatSigned(profit.profit)} Maple Points
              </span>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Meso still held is valued at the latest Average, {formatPoints(profit.average)} per 100M (recorded{" "}
              <LocalTime iso={profit.averageAt} />
              ).
            </p>
          </>
        ) : (
          <p className="text-gray-600">Profit unavailable - no Average has been recorded yet.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-2 rounded border border-gray-200 bg-white p-4">
        <div className="flex gap-2">
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as TradeSide)}
            aria-label="Side"
            className="rounded border border-gray-300 px-3 py-2"
          >
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
          <input
            type="number"
            required
            min="1"
            step="1"
            placeholder="Amount (× 100M)"
            aria-label="Amount in units of 100M meso"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-1/2 rounded border border-gray-300 px-3 py-2"
          />
          <input
            type="number"
            required
            min="1"
            step="1"
            placeholder="Price per 100M"
            aria-label="Price in Maple Points per 100M meso, before fees"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-1/2 rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <input
          type="datetime-local"
          required
          max={maxTradedAt}
          aria-label="When the Trade happened"
          value={tradedAt}
          onChange={(e) => setTradedAt(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <button
          type="submit"
          disabled={isSaving}
          className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSaving ? "Logging…" : "Log Trade"}
        </button>
      </form>

      {trades.length === 0 ? (
        <p className="text-gray-600">No Trades yet.</p>
      ) : (
        <div className="space-y-3">
          {trades.map((trade) => (
            <div key={trade.id} className="rounded border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{describeTrade(trade)} per 100M</p>
                  <p className="text-sm text-gray-600">
                    <LocalTime iso={trade.tradedAt} /> · Total {formatPoints(trade.total)}
                    {trade.fee !== null && trade.net !== null && (
                      <>
                        {" "}
                        · Fee {formatPoints(trade.fee)} · Net {formatPoints(trade.net)}
                      </>
                    )}
                  </p>
                  {trade.note && <p className="mt-1 truncate text-sm text-gray-600">{trade.note}</p>}
                </div>
                <ConfirmDeleteButton
                  itemName="Trade"
                  itemLabel={describeTrade(trade)}
                  isDeleting={deletingId === trade.id}
                  onConfirm={() => handleDelete(trade.id)}
                />
              </div>
              {deleteError?.id === trade.id && <p className="mt-2 text-sm text-red-600">{deleteError.message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
