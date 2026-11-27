import pytest

from models import TradeSide
from trades import SELL_FEE_RATE, build_trade, compute_profit

TRADED_AT = "2026-11-20T12:00:00+00:00"
ONE_B_IN_100M = 10
FIVE_B_IN_100M = 50
TEN_B_IN_100M = 100


def _trade(side, amount_100m, price):
    return build_trade(1, side, amount_100m, price, TRADED_AT, "")


def test_buy_total_is_price_times_amount_and_has_no_fee():
    trade = _trade(TradeSide.BUY, TEN_B_IN_100M, 50)
    assert trade.total == 5000
    assert trade.fee is None
    assert trade.net is None


def test_sell_fee_is_one_percent_of_total_and_net_is_the_rest():
    trade = _trade(TradeSide.SELL, ONE_B_IN_100M, 60)
    assert trade.total == 600
    assert trade.fee == pytest.approx(600 * SELL_FEE_RATE)
    assert trade.net == pytest.approx(594)


def test_fee_keeps_decimals():
    # 1% of 1,250 is 12.5 - not rounded until the game's rounding is known.
    trade = _trade(TradeSide.SELL, 1, 1250)
    assert trade.fee == pytest.approx(12.5)
    assert trade.net == pytest.approx(1237.5)


def test_profit_values_held_meso_at_the_latest_average():
    trades = [_trade(TradeSide.BUY, TEN_B_IN_100M, 50), _trade(TradeSide.SELL, ONE_B_IN_100M, 60)]
    assert compute_profit(trades, latest_average=55) == pytest.approx(544)


@pytest.mark.parametrize("latest_average, expected", [(55, 220), (70, -530), (50, 470)])
def test_profit_counts_meso_sold_beyond_what_was_bought_at_the_latest_average(latest_average, expected):
    trades = [_trade(TradeSide.SELL, FIVE_B_IN_100M, 60)]
    assert compute_profit(trades, latest_average) == pytest.approx(expected)


def test_profit_with_no_trades_is_zero():
    assert compute_profit([], latest_average=55) == 0
