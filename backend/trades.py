"""Derived Trade figures (see GLOSSARY.md: Total, Fee, Net, Profit). Fee is
computed on read, never stored, and kept exact (no rounding) until the game's
rounding is known."""

from models import Trade, TradeSide

SELL_FEE_RATE = 0.01


def build_trade(id: int, side: TradeSide, amount_100m: int, price: int, traded_at: str, note: str) -> Trade:
    total = price * amount_100m
    fee = total * SELL_FEE_RATE if side is TradeSide.SELL else None
    net = total - fee if fee is not None else None
    return Trade(
        id=id,
        side=side,
        amount_100m=amount_100m,
        price=price,
        traded_at=traded_at,
        note=note,
        total=total,
        fee=fee,
        net=net,
    )


def compute_profit(trades: list[Trade], latest_average: float) -> float:
    """Net of every sell, minus Total of every buy, plus the meso bought minus
    sold valued at the latest Average (which is per 100M, like amount_100m)."""
    sell_net = sum(t.net for t in trades if t.side is TradeSide.SELL)
    buy_total = sum(t.total for t in trades if t.side is TradeSide.BUY)
    held_100m = sum(t.amount_100m if t.side is TradeSide.BUY else -t.amount_100m for t in trades)
    return sell_net - buy_total + held_100m * latest_average
