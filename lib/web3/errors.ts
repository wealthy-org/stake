/**
 * Wallet/contract libraries (viem, wagmi) throw errors meant for a
 * developer console — multi-line dumps with "Contract Call:", "Docs:
 * https://viem.sh/...", raw hex calldata, etc. Never show that to a user.
 * This maps the common cases to one plain sentence; anything unrecognized
 * falls back to a generic message instead of leaking the raw dump.
 */
export function friendlyWeb3Error(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/user rejected|user denied/i.test(raw)) {
    return "Transaction cancelled.";
  }
  if (/insufficient funds/i.test(raw)) {
    return "Not enough balance to cover this transaction (including network gas fee).";
  }
  if (/erc20insufficientbalance/i.test(raw)) {
    return "Not enough token balance for this amount — top up and try again.";
  }
  if (/insufficient allowance|erc20insufficientallowance/i.test(raw)) {
    return "Token approval didn't go through — please try again.";
  }
  if (/chain mismatch|does not match the target chain|unsupported chain/i.test(raw)) {
    return "Your wallet is connected to the wrong network — switch to Robinhood Chain Testnet and try again.";
  }

  // Pull the human-readable revert reason out of viem's dump, e.g.
  // `execution reverted: Market: betting is closed` -> "Market: betting is closed".
  const revertMatch = raw.match(/execution reverted:\s*([^\n]+)/i);
  if (revertMatch) {
    const reason = revertMatch[1].trim();
    // Skip generic/empty revert reasons that aren't useful to show as-is.
    if (reason && reason.toLowerCase() !== "no data present") {
      return reason;
    }
  }

  return "Something went wrong with the transaction. Please try again.";
}
