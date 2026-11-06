import { createWalletClient, http, publicActions, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/web3/chains";

const REWARD_VAULT_PILOT = "0xB558f06c3557f090a5Ae1C629D42cE90be422FA6" as const;
const TARGET_USER = "0x9178b573219c55586bbaf51ecb24acfb27bb7681" as const;
const PRIV_KEY = "0x894e48c9abb092618876899acc7b06deb94f2ae73fd3de97f7f62679974de075" as const;

const customAbi = parseAbi([
  "function setRole(bytes32 role, address account, bool enabled) external",
  "function accruePoints(address user, bytes32 marketId, uint256 pointsAdded) external",
  "function settleBatch(address[] calldata users, uint256 totalStakeForBatch, bytes32 metadata) external",
  "function pendingReward(address user) external view returns (uint256)",
  "function allocatedStake(address user) external view returns (uint256)",
  "function pendingPoints(address user) external view returns (uint256)",
]);

async function main() {
  const account = privateKeyToAccount(PRIV_KEY);
  const client = createWalletClient({
    account,
    chain: robinhoodTestnet,
    transport: http("https://rpc.testnet.chain.robinhood.com"),
  }).extend(publicActions);

  console.log("Admin wallet:", account.address);
  console.log("Crediting STAKE allocation to user:", TARGET_USER);

  // 1. Accrue points
  console.log("Calling accruePoints on RewardVault...");
  const pointsTx = await client.writeContract({
    address: REWARD_VAULT_PILOT,
    abi: customAbi,
    functionName: "accruePoints",
    args: [TARGET_USER, "0x1234567890123456789012345678901234567890123456789012345678901234", 500n * 10n ** 18n],
  });
  console.log("Points Tx:", pointsTx);
  await client.waitForTransactionReceipt({ hash: pointsTx });

  // 2. Settle batch so points become claimable STAKE
  console.log("Calling settleBatch on RewardVault...");
  const settleTx = await client.writeContract({
    address: REWARD_VAULT_PILOT,
    abi: customAbi,
    functionName: "settleBatch",
    args: [[TARGET_USER], 500n * 10n ** 6n, "0x0000000000000000000000000000000000000000000000000000000000000000"],
  });
  console.log("Settle Batch Tx:", settleTx);
  await client.waitForTransactionReceipt({ hash: settleTx });

  const allocated = await client.readContract({
    address: REWARD_VAULT_PILOT,
    abi: customAbi,
    functionName: "allocatedStake",
    args: [TARGET_USER],
  });

  console.log("SUCCESS! User", TARGET_USER, "has allocated STAKE:", allocated.toString());
}

main().catch(console.error);
