import { Connection, PublicKey, Context, AccountInfo } from "@solana/web3.js";
import { PricefeedConfig, PriceData } from "./interfaces";
import {
  AggregatorState,
  SwitchboardAccountType,
} from "@switchboard-xyz/switchboard-api";
import { RedisConfig, RedisStore, createRedisStore } from "./redis";

export async function collectPricefeed(p: PricefeedConfig, r: RedisConfig) {
  // Create a new redis store for this pricefeed
  const store: RedisStore = await createRedisStore(r, p.pricefeedName);
  const pricefeedAddress: PublicKey = new PublicKey(p.pricefeedPk);
  const connection: Connection = new Connection(p.clusterUrl);

  // Callback that fetches pricefeed data and stores in Redis
  async function priceDataCallback(
    accountInfo: AccountInfo<Buffer>,
    context: Context
  ) {
    let data = accountInfo.data;
    if (data.length == 0 || data[0] != SwitchboardAccountType.TYPE_AGGREGATOR) {
      throw new Error(
        `Switchboard account parser was not provided with an aggregator account`
      );
    }
    const aggState: AggregatorState = AggregatorState.decodeDelimited(
      accountInfo.data.slice(1)
    );
    const price = aggState.lastRoundResult?.result;
    const confidence: number = 0;
    const status: number = 0;
    console.log(`${p.pricefeedName}: $${price} (${context.slot})`);
    const ts = Date.now();
    if (price) {
      store.storePrice({ price, confidence, ts, status });
    }
  }

  // Streaming approach: fetch price data on account change via ws
  connection.onAccountChange(pricefeedAddress, priceDataCallback);
}
