import { parseAbi } from "viem";

// Hand-written against src/CapacityPool.sol (Level 5). Same conventions as
// CapacityMarket.ts. TermsClass is passed/returned as an inline tuple since
// parseAbi has no named-struct-reuse syntax — field order must match the
// Solidity struct exactly.
const TERMS_CLASS_TUPLE =
  "(bytes32 domain, uint64 validFrom, uint64 validUntil, uint64 activationSLA, uint64 disputeWindow, address[] panelMembers, uint256 panelThreshold, uint256 pricePerUnit, uint256 collateralPerUnit)";

export const CapacityPoolAbi = parseAbi([
  // --- contribute (= list) ---
  `function contribute(${TERMS_CLASS_TUPLE} terms, uint256 quantity) payable returns (bytes32 id)`,
  `function classId(${TERMS_CLASS_TUPLE} terms) pure returns (bytes32)`,

  // --- reserve / transfer ---
  "function reserve(bytes32 id, uint256 quantity) payable returns (uint256 reservationId)",
  "function transferReservation(uint256 reservationId, address to)",
  "function expireReservation(uint256 reservationId)",

  // --- activate ---
  "function activate(uint256 reservationId)",

  // --- accept (per assignment) ---
  "function acceptAssignment(uint256 reservationId, uint256 assignmentIndex)",

  // --- delivery / settle (per assignment) ---
  "function claimAssignmentDelivery(uint256 reservationId, uint256 assignmentIndex, bytes32 evidenceHash)",
  "function settleAssignment(uint256 reservationId, uint256 assignmentIndex)",
  "function finalizeAssignmentDelivery(uint256 reservationId, uint256 assignmentIndex)",

  // --- dispute / arbitration vote (per assignment) ---
  "function disputeAssignment(uint256 reservationId, uint256 assignmentIndex, bytes32 reasonHash)",
  "function resolveAssignmentDisputeByTimeout(uint256 reservationId, uint256 assignmentIndex)",
  "function voteAssignmentDispute(uint256 reservationId, uint256 assignmentIndex, bool providerWins)",

  // --- default (per assignment) ---
  "function claimAssignmentDefault(uint256 reservationId, uint256 assignmentIndex)",

  // --- contribution withdrawal ---
  "function withdrawContribution(bytes32 id, uint256 index)",

  // --- views ---
  `function poolInfo(bytes32 id) view returns (${TERMS_CLASS_TUPLE} terms, uint256 totalCommitted, uint256 available, uint256 contributionsCount)`,
  "function contributionInfo(bytes32 id, uint256 index) view returns (address provider, uint256 remaining)",
  "function reservationInfo(uint256 reservationId) view returns (bytes32 classId_, address buyer, uint256 quantity, uint64 activationDeadline, uint8 status, uint256 assignmentCount)",
  "function assignmentInfo(uint256 reservationId, uint256 index) view returns (address provider, uint256 quantity, uint256 price, uint256 collateral, bytes32 deliveryEvidenceHash, uint64 disputeDeadline, uint8 status)",
  "function nextReservationId() view returns (uint256)",
  "function providerStats(address) view returns (uint256 settledCount, uint256 defaultedCount, uint256 disputesLostCount, uint256 disputesTimedOutCount)",
  "function MAX_DURATION() view returns (uint64)",
  "function MAX_PANEL_SIZE() view returns (uint256)",

  // --- events ---
  "event Contributed(bytes32 indexed classId, address indexed provider, uint256 quantity, uint256 collateral)",
  "event Reserved(uint256 indexed reservationId, bytes32 indexed classId, address indexed buyer, uint256 quantity)",
  "event ReservationTransferred(uint256 indexed reservationId, address indexed from, address indexed to)",
  "event ReservationExpired(uint256 indexed reservationId)",
  "event ReservationActivated(uint256 indexed reservationId, uint64 activationDeadline, uint256 assignmentCount)",
  "event AssignmentAccepted(uint256 indexed reservationId, uint256 indexed assignmentIndex, address indexed provider)",
  "event AssignmentDeliveryClaimed(uint256 indexed reservationId, uint256 indexed assignmentIndex, bytes32 evidenceHash, uint64 disputeDeadline)",
  "event AssignmentDisputed(uint256 indexed reservationId, uint256 indexed assignmentIndex, bytes32 reasonHash, uint64 resolutionDeadline)",
  "event AssignmentDefaulted(uint256 indexed reservationId, uint256 indexed assignmentIndex, address indexed provider)",
  "event AssignmentSettled(uint256 indexed reservationId, uint256 indexed assignmentIndex, address indexed provider)",
  "event AssignmentRefunded(uint256 indexed reservationId, uint256 indexed assignmentIndex, address indexed buyer)",
  "event AssignmentDisputeVoteCast(uint256 indexed reservationId, uint256 indexed assignmentIndex, address indexed voter, bool providerWins, uint256 providerVotes, uint256 buyerVotes)",
  "event AssignmentDisputeResolved(uint256 indexed reservationId, uint256 indexed assignmentIndex, bool providerWon)",
  "event ContributionWithdrawn(bytes32 indexed classId, uint256 indexed index, address indexed provider, uint256 amount)",
  "event ProviderStatsUpdated(address indexed provider, uint256 settledCount, uint256 defaultedCount, uint256 disputesLostCount, uint256 disputesTimedOutCount)",

  // --- custom errors ---
  "error InvalidWindow()",
  "error WrongValue()",
  "error InsufficientAvailableCapacity()",
  "error NotBuyer()",
  "error NotProvider()",
  "error NotArbitrator()",
  "error InvalidPanel()",
  "error AlreadyVoted()",
  "error WrongReservationStatus(uint8 expected, uint8 actual)",
  "error WrongAssignmentStatus(uint8 expected, uint8 actual)",
  "error WindowNotOpen()",
  "error WindowClosed()",
  "error WindowNotYetClosed()",
  "error DeadlineNotPassed()",
  "error DeadlinePassed()",
  "error DisputeWindowOpen()",
  "error DisputeWindowClosed()",
  "error DurationTooLong()",
]);
