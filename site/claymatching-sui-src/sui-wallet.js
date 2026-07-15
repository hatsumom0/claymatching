import "@mysten/dapp-kit-core/web";
import { createDAppKit } from "@mysten/dapp-kit-core";
import { SuiGraphQLClient } from "@mysten/sui/graphql";

const SUI_MAINNET_GRAPHQL = "https://graphql.mainnet.sui.io/graphql";

const dAppKit = createDAppKit({
  networks: ["mainnet"],
  defaultNetwork: "mainnet",
  createClient: () => new SuiGraphQLClient({
    network: "mainnet",
    url: SUI_MAINNET_GRAPHQL,
  }),
  storageKey: "claymatching.sui-wallet.v1",
});

function connectionState() {
  const connection = dAppKit.stores.$connection.get();
  return {
    address: connection.account?.address || "",
    connected: Boolean(connection.isConnected && connection.account),
    connecting: Boolean(connection.isConnecting || connection.isReconnecting),
    status: connection.status,
    walletName: connection.wallet?.name || "Sui wallet",
  };
}

function announceConnection() {
  window.dispatchEvent(new CustomEvent("claymatching:sui-wallet", {
    detail: connectionState(),
  }));
}

const connectButton = document.querySelector("[data-sui-connect]");
if (connectButton) {
  connectButton.instance = dAppKit;
}

dAppKit.stores.$connection.subscribe(announceConnection);

window.claySui = Object.freeze({
  disconnect: () => dAppKit.disconnectWallet(),
  getState: connectionState,
  async signPersonalMessage(message) {
    const state = connectionState();
    if (!state.connected) throw new Error("Connect a Sui wallet first.");
    return dAppKit.signPersonalMessage({
      message: new TextEncoder().encode(String(message || "")),
      network: "mainnet",
    });
  },
});

announceConnection();
