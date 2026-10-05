import { parseAbi } from "viem";

// Hand-written against src/CapacityMarket.sol (Level 5) — mirrors the
// human-readable parseAbi convention already used in
// muster-cre/contracts/abi/KeeperConsumer.ts. Enum params/returns use their
// ABI-encoded underlying type (uint8) since parseAbi has no enum alias.
export const CapacityMarketAbi = parseAbi([
  // --- list / reserve / transfer ---
  "function listCapacity(bytes32 domain, uint256 quantity, uint64 validFrom, uint64 validUntil, uint64 activationSLA, uint64 disputeWindow, address[] panelMembers, uint256 panelThreshold, uint256 price) payable returns (uint256 positionId)",
  "function reserve(uint256 positionId) payable",
  "function transfer(uint256 positionId, address to)",

  // --- activate / accept ---
  "function activate(uint256 positionId)",
  "function acceptActivation(uint256 positionId)",

  // --- delivery / settle ---
  "function claimDelivery(uint256 positionId, bytes32 evidenceHash)",
  "function settle(uint256 positionId)",
  "function finalizeDelivery(uint256 positionId)",

  // --- dispute / arbitration vote ---
  "function dispute(uint256 positionId, bytes32 reasonHash)",
  "function resolveDisputeByTimeout(uint256 positionId)",
  "function voteDispute(uint256 positionId, bool providerWins)",
  "function arbitrationPanel(uint256 positionId) view returns (address[] members, uint256 threshold)",

  // --- default / expire ---
  "function claimDefault(uint256 positionId)",
  "function expire(uint256 positionId)",

  // --- views ---
  "function nextPositionId() view returns (uint256)",
  "function positions(uint256) view returns (bytes32 domain, uint256 quantity, uint64 validFrom, uint64 validUntil, uint64 activationSLA, uint64 disputeWindow, address provider, address buyer, uint256 price, uint256 collateral, uint64 activationDeadline, uint64 disputeDeadline, bytes32 deliveryEvidenceHash, uint8 status)",
  "function providerStats(address) view returns (uint256 settledCount, uint256 defaultedCount, uint256 disputesLostCount, uint256 disputesTimedOutCount)",
  "function MAX_DURATION() view returns (uint64)",
  "function MAX_PANEL_SIZE() view returns (uint256)",

  // --- events ---
  "event Listed(uint256 indexed positionId, address indexed provider, bytes32 domain, uint256 quantity, uint64 validFrom, uint64 validUntil, uint64 activationSLA, uint256 price, uint256 collateral)",
  "event Reserved(uint256 indexed positionId, address indexed buyer)",
  "event Transferred(uint256 indexed positionId, address indexed from, address indexed to)",
  "event Activated(uint256 indexed positionId, uint64 activationDeadline)",
  "event Accepted(uint256 indexed positionId)",
  "event DeliveryClaimed(uint256 indexed positionId, bytes32 evidenceHash, uint64 disputeDeadline)",
  "event Disputed(uint256 indexed positionId, bytes32 reasonHash, uint64 resolutionDeadline)",
  "event Settled(uint256 indexed positionId)",
  "event Refunded(uint256 indexed positionId)",
  "event DisputeVoteCast(uint256 indexed positionId, address indexed voter, bool providerWins, uint256 providerVotes, uint256 buyerVotes)",
  "event DisputeResolved(uint256 indexed positionId, bool providerWon)",
  "event Expired(uint256 indexed positionId)",
  "event Defaulted(uint256 indexed positionId)",
  "event ProviderStatsUpdated(address indexed provider, uint256 settledCount, uint256 defaultedCount, uint256 disputesLostCount, uint256 disputesTimedOutCount)",

  // --- custom errors (for decoding reverts) ---
  "error NotProvider()",
  "error NotBuyer()",
  "error NotArbitrator()",
  "error InvalidPanel()",
  "error AlreadyVoted()",
  "error WrongStatus(uint8 expected, uint8 actual)",
  "error WrongValue()",
  "error WindowNotOpen()",
  "error WindowClosed()",
  "error WindowNotYetClosed()",
  "error DeadlineNotPassed()",
  "error DeadlinePassed()",
  "error InvalidWindow()",
  "error DisputeWindowOpen()",
  "error DisputeWindowClosed()",
  "error DurationTooLong()",
]);
