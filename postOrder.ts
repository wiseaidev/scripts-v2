import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { authority } from "./utils";
import { RPC, programId } from "./utils";
import {
  OpenBookV2Client,
  PlaceOrderArgs,
  Side,
  Market,
} from "@openbook-dex/openbook-v2";
import { MintUtils } from "./mint_utils";

async function main() {
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(new Connection(RPC), wallet, {
    commitment: "confirmed",
  });
  const client = new OpenBookV2Client(provider);

  const openOrdersPublicKey = new PublicKey(
    "EuaUfzypbyh5xtKD2nfHEfpQiTr8QSqu4VeRtLrfTF1c"
  );
  const marketPublicKey = new PublicKey(
    "CwHc9CZ9UCZFayz4eBekuhhKsHapLDPYfX4tGFJrnTRt"
  );
  const market = await Market.load(client, marketPublicKey);
  if (!market) {
    throw "No market";
  }

  let mintUtils = new MintUtils(provider.connection, authority);
  const userQuoteAcc = await mintUtils.getOrCreateTokenAccount(
    market?.account.quoteMint,
    authority,
    client.walletPk
  );
  const userBaseAcc = await mintUtils.getOrCreateTokenAccount(
    market?.account.baseMint,
    authority,
    client.walletPk
  );
  mintUtils.mintTo(market?.account.quoteMint, userQuoteAcc.address);
  mintUtils.mintTo(market?.account.baseMint, userBaseAcc.address);

  const nbOrders: number = 10;
  for (let i = 0; i < nbOrders; ++i) {
    // @ts-ignore
    let side = Side.Bid;
    let placeOrder = { limit: {} };
    let selfTradeBehavior = { decrementTake: {} };

    let args: PlaceOrderArgs = {
      side,
      priceLots: new BN(1000 - 1 - i),
      maxBaseLots: new BN(10),
      maxQuoteLotsIncludingFees: new BN(1000000),
      clientOrderId: new BN(i),
      orderType: placeOrder,
      expiryTimestamp: new BN(0),
      selfTradeBehavior: selfTradeBehavior,
      limit: 255,
    };

    const [ix, signers] = await client.placeOrderIx(
      openOrdersPublicKey,
      marketPublicKey,
      market.account,
      userQuoteAcc.address,
      null,
      args,
      // @ts-ignore
      []
    );
    const tx = await client.sendAndConfirmTransaction([ix], {
      additionalSigners: [signers],
    });
    console.log("Placed order ", tx);
  }

  for (let i = 0; i < nbOrders; ++i) {
    // @ts-ignore
    let side = Side.Ask;
    let placeOrder = { limit: {} };
    let selfTradeBehavior = { decrementTake: {} };

    let args: PlaceOrderArgs = {
      side,
      priceLots: new BN(1000 + 1 + i),
      maxBaseLots: new BN(10000),
      maxQuoteLotsIncludingFees: new BN(1000000),
      clientOrderId: new BN(i + nbOrders + 1),
      orderType: placeOrder,
      expiryTimestamp: new BN(0),
      selfTradeBehavior: selfTradeBehavior,
      limit: 255,
    };
    // @ts-ignore
    let remainings = new Array<PublicKey>();

    const [ix, signers] = await client.placeOrderIx(
      openOrdersPublicKey,
      marketPublicKey,
      market.account,
      userBaseAcc.address,
      null,
      args,
      // @ts-ignore
      remainings
    );
    const tx = await client.sendAndConfirmTransaction([ix], {
      additionalSigners: [signers],
    });
    console.log("Placed order ", tx);
  }
}

main().catch((err) => console.error(err));
