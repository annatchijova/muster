// Enum member order matters — this is the exact uint8 encoding from
// src/CapacityMarket.sol and src/CapacityPool.sol. Do not reorder without
// re-checking the Solidity source.

export const POSITION_STATUS = [
  "Listed",
  "Reserved",
  "Activated",
  "Accepted",
  "DeliveryClaimed",
  "Disputed",
  "Settled",
  "Expired",
  "Defaulted",
  "Refunded",
] as const;
export type PositionStatus = (typeof POSITION_STATUS)[number];

export const ASSIGNMENT_STATUS = [
  "Pending",
  "Accepted",
  "DeliveryClaimed",
  "Disputed",
  "Defaulted",
  "Settled",
  "Refunded",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS)[number];

// Different ordering/members than AssignmentStatus — a Reservation's own
// status, not any one assignment's.
export const RESERVATION_STATUS = ["Reserved", "Activated", "Expired"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUS)[number];

export const DISPUTE_VOTE = ["None", "ProviderWins", "BuyerWins"] as const;
export type DisputeVote = (typeof DISPUTE_VOTE)[number];

/** Color family for a status label, matching proof's traffic-light convention. */
export function statusColorClass(label: string): "green" | "red" | "yellow" | "muted" | "blue" {
  switch (label) {
    case "Settled":
      return "green";
    case "Disputed":
    case "Defaulted":
      return "red";
    case "Activated":
    case "Accepted":
    case "DeliveryClaimed":
    case "Pending":
      return "yellow";
    case "Expired":
    case "Refunded":
      return "muted";
    default:
      // Listed, Reserved
      return "blue";
  }
}
