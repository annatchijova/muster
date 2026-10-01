// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @title CapacityMarket
/// @notice Onchain market for future specialist response capacity.
///
/// A CapacityPosition represents a provider's commitment to deliver `quantity`
/// units of work in a given `domain`, usable within [validFrom, validUntil],
/// with a bounded acknowledgement time (`activationSLA`) if the buyer activates it.
///
/// What this contract guarantees onchain (the load-bearing invariants):
///   1. No double reservation: a position has exactly one buyer at a time, and
///      `reserve` only succeeds from `Listed`.
///   2. No double consumption: `activate`/`acceptActivation`/`settle` each
///      require the exact prior state; a position cannot be consumed twice.
///   3. Transfer preserves the asset: `validUntil`, `activationSLA`, and
///      `collateral` are immutable after listing. Transfer changes `buyer`
///      only.
///   4. Collateral and price are each locked once and released exactly
///      once: to the provider at `settle`/`finalizeDelivery`, to the buyer
///      at `claimDefault` (both amounts — no service, no charge) or
///      `resolveDisputeByTimeout`, or split by `expire` depending on
///      whether the position was ever reserved.
///   5. State transitions are one-way. There is no path back to an earlier
///      state, so a stale reference to a position's status is never wrong
///      about what remains possible from here.
///
/// Level 3 addition: delivery is no longer a single buyer-honesty call.
/// `settle` requires the provider to have first `claimDelivery`'d with an
/// evidence hash and the buyer's dispute window to have not been used to
/// `dispute` it. If the buyer never responds, `finalizeDelivery` lets
/// anyone pay the provider once the window passes — closing the matching
/// liveness gap this introduces (an unresponsive buyer could otherwise
/// lock the provider's price and collateral in `DeliveryClaimed` forever).
///
/// What this contract does NOT and cannot guarantee, even with Level 3:
/// that the evidence hash corresponds to work that actually met the
/// buyer's bar, or how a genuine dispute gets resolved on its merits once
/// raised — `dispute` only records that one was raised. What it does
/// guarantee is that a dispute cannot lock funds forever: absent an actual
/// resolution mechanism (not built at this level), `resolveDisputeByTimeout`
/// refunds the buyer after a second window passes, so `Disputed` always has
/// a payout path even though it has no adjudication. See
/// docs/TECHNICAL_README.md "Trust boundary" and "Level 3: delivery claims
/// and disputes".
contract CapacityMarket {
    enum Status {
        Listed,
        Reserved,
        Activated,
        Accepted,
        DeliveryClaimed,
        Disputed,
        Settled,
        Expired,
        Defaulted,
        Refunded
    }

    struct CapacityPosition {
        bytes32 domain;
        uint256 quantity;
        uint64 validFrom;
        uint64 validUntil;
        uint64 activationSLA;
        uint64 disputeWindow;
        address provider;
        address buyer;
        uint256 price;
        uint256 collateral;
        uint64 activationDeadline;
        uint64 disputeDeadline;
        bytes32 deliveryEvidenceHash;
        Status status;
    }

    uint256 public nextPositionId;
    mapping(uint256 => CapacityPosition) public positions;

    event Listed(
        uint256 indexed positionId,
        address indexed provider,
        bytes32 domain,
        uint256 quantity,
        uint64 validFrom,
        uint64 validUntil,
        uint64 activationSLA,
        uint256 price,
        uint256 collateral
    );
    event Reserved(uint256 indexed positionId, address indexed buyer);
    event Transferred(uint256 indexed positionId, address indexed from, address indexed to);
    event Activated(uint256 indexed positionId, uint64 activationDeadline);
    event Accepted(uint256 indexed positionId);
    event DeliveryClaimed(uint256 indexed positionId, bytes32 evidenceHash, uint64 disputeDeadline);
    event Disputed(uint256 indexed positionId, bytes32 reasonHash, uint64 resolutionDeadline);
    event Settled(uint256 indexed positionId);
    event Refunded(uint256 indexed positionId);
    event Expired(uint256 indexed positionId);
    event Defaulted(uint256 indexed positionId);

    error NotProvider();
    error NotBuyer();
    error WrongStatus(Status expected, Status actual);
    error WrongValue();
    error WindowNotOpen();
    error WindowClosed();
    error WindowNotYetClosed();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error InvalidWindow();
    error DisputeWindowOpen();
    error DisputeWindowClosed();
    error DurationTooLong();

    /// @notice Upper bound on `activationSLA` and `disputeWindow`, enforced
    /// at `listCapacity`. Exists solely so `uint64(block.timestamp) +
    /// duration` in `activate`/`claimDelivery`/`dispute` can never overflow
    /// uint64 regardless of how far block.timestamp has grown by the time
    /// those run — 365 days leaves comfortable room under the ~5.8e11-year
    /// overflow horizon from any realistic timestamp. See
    /// docs/SECURITY_AUDIT_2026-10-01.md findings F2/F3: before this bound
    /// existed, a provider could choose a near-`type(uint64).max` duration
    /// to force those additions to revert forever, either profitably
    /// (F2) or destructively (F3).
    uint64 public constant MAX_DURATION = 365 days;

    modifier inStatus(uint256 positionId, Status expected) {
        Status actual = positions[positionId].status;
        if (actual != expected) revert WrongStatus(expected, actual);
        _;
    }

    /// @notice Provider lists capacity, posting `collateral` as a bond against
    /// default. `disputeWindow` is how long the buyer has, after the provider
    /// claims delivery, to dispute it before `finalizeDelivery` can pay the
    /// provider unilaterally.
    function listCapacity(
        bytes32 domain,
        uint256 quantity,
        uint64 validFrom,
        uint64 validUntil,
        uint64 activationSLA,
        uint64 disputeWindow,
        uint256 price
    ) external payable returns (uint256 positionId) {
        if (validUntil <= validFrom) revert InvalidWindow();
        if (quantity == 0) revert WrongValue();
        if (activationSLA > MAX_DURATION || disputeWindow > MAX_DURATION) revert DurationTooLong();

        positionId = nextPositionId++;
        positions[positionId] = CapacityPosition({
            domain: domain,
            quantity: quantity,
            validFrom: validFrom,
            validUntil: validUntil,
            activationSLA: activationSLA,
            disputeWindow: disputeWindow,
            provider: msg.sender,
            buyer: address(0),
            price: price,
            collateral: msg.value,
            activationDeadline: 0,
            disputeDeadline: 0,
            deliveryEvidenceHash: bytes32(0),
            status: Status.Listed
        });

        emit Listed(positionId, msg.sender, domain, quantity, validFrom, validUntil, activationSLA, price, msg.value);
    }

    /// @notice Buyer reserves a listed position, paying exactly `price`.
    function reserve(uint256 positionId) external payable inStatus(positionId, Status.Listed) {
        CapacityPosition storage p = positions[positionId];
        if (block.timestamp >= p.validUntil) revert WindowClosed();
        if (msg.value != p.price) revert WrongValue();

        p.buyer = msg.sender;
        p.status = Status.Reserved;

        emit Reserved(positionId, msg.sender);
    }

    /// @notice Current buyer transfers the reservation to `to`. The underlying
    /// asset (window, SLA, collateral) does not change — only ownership of the
    /// right to activate it.
    function transfer(uint256 positionId, address to) external inStatus(positionId, Status.Reserved) {
        CapacityPosition storage p = positions[positionId];
        if (msg.sender != p.buyer) revert NotBuyer();
        if (block.timestamp >= p.validUntil) revert WindowClosed();

        p.buyer = to;
        emit Transferred(positionId, msg.sender, to);
    }

    /// @notice Anyone may close out a position that was never activated
    /// before its window closed — whether or not it was ever reserved.
    /// Capacity is not consumed; it just lapses. Collateral always returns
    /// to the provider. If the position had been reserved, `price` goes to
    /// the provider too: the same way an unexercised option's premium
    /// compensates the writer for having blocked that capacity, a buyer who
    /// reserved and let the window lapse does not get `price` back — it is
    /// the provider's compensation for capacity nobody else could buy
    /// during that window. This is a stated economic rule, not a missing
    /// refund path: see docs/TECHNICAL_README.md "Price on expiry".
    function expire(uint256 positionId) external {
        CapacityPosition storage p = positions[positionId];
        Status prior = p.status;
        if (prior != Status.Listed && prior != Status.Reserved) {
            revert WrongStatus(Status.Reserved, prior);
        }
        if (block.timestamp < p.validUntil) revert WindowNotYetClosed();

        p.status = Status.Expired;
        emit Expired(positionId);

        uint256 amount = p.collateral + (prior == Status.Reserved ? p.price : 0);
        _payout(p.provider, amount);
    }

    /// @notice Buyer activates the position, starting the provider's
    /// acknowledgement clock.
    function activate(uint256 positionId) external inStatus(positionId, Status.Reserved) {
        CapacityPosition storage p = positions[positionId];
        if (msg.sender != p.buyer) revert NotBuyer();
        if (block.timestamp < p.validFrom || block.timestamp >= p.validUntil) revert WindowNotOpen();

        p.activationDeadline = uint64(block.timestamp) + p.activationSLA;
        p.status = Status.Activated;

        emit Activated(positionId, p.activationDeadline);
    }

    /// @notice Provider acknowledges the activation within the SLA.
    function acceptActivation(uint256 positionId) external inStatus(positionId, Status.Activated) {
        CapacityPosition storage p = positions[positionId];
        if (msg.sender != p.provider) revert NotProvider();
        if (block.timestamp > p.activationDeadline) revert DeadlinePassed();

        p.status = Status.Accepted;
        emit Accepted(positionId);
    }

    /// @notice Anyone may trigger default once the provider missed the
    /// acknowledgement deadline. Both `collateral` (the penalty) and
    /// `price` (refunded — no service was rendered) return to the buyer.
    /// Earlier drafts paid `collateral` only, leaving `price` permanently
    /// stuck with no other function able to move it — see
    /// docs/SECURITY_AUDIT_2026-10-01.md finding F1.
    function claimDefault(uint256 positionId) external inStatus(positionId, Status.Activated) {
        CapacityPosition storage p = positions[positionId];
        if (block.timestamp <= p.activationDeadline) revert DeadlineNotPassed();

        p.status = Status.Defaulted;
        emit Defaulted(positionId);

        _payout(p.buyer, p.price + p.collateral);
    }

    /// @notice Provider claims delivery is complete, committing to
    /// `evidenceHash` (a hash of whatever offchain evidence backs the claim
    /// — a report, logs, a signed timesheet; the contract does not interpret
    /// it) and starting the buyer's dispute window.
    function claimDelivery(uint256 positionId, bytes32 evidenceHash) external inStatus(positionId, Status.Accepted) {
        CapacityPosition storage p = positions[positionId];
        if (msg.sender != p.provider) revert NotProvider();

        p.deliveryEvidenceHash = evidenceHash;
        p.disputeDeadline = uint64(block.timestamp) + p.disputeWindow;
        p.status = Status.DeliveryClaimed;

        emit DeliveryClaimed(positionId, evidenceHash, p.disputeDeadline);
    }

    /// @notice Buyer disputes a claimed delivery before the window closes.
    /// `reasonHash` is committed the same way `evidenceHash` is — this
    /// records that a dispute exists and why, in the buyer's own words; it
    /// does not adjudicate it. This contract has no arbitrator and does not
    /// invent one: `disputeDeadline` is reused as a second, equally long
    /// window (restarted from the dispute itself) during which an actual
    /// resolution mechanism — not built at this level — could settle the
    /// claim on its merits. If nothing resolves it before that window
    /// passes, `resolveDisputeByTimeout` pays the **buyer**, not the
    /// provider: a disputed claim does not get the silent-party benefit of
    /// the doubt `finalizeDelivery` gives an un-disputed one. This is a
    /// conservative, declared default, not a verdict on the merits — see
    /// docs/TECHNICAL_README.md "Level 3: delivery claims and disputes".
    function dispute(uint256 positionId, bytes32 reasonHash) external inStatus(positionId, Status.DeliveryClaimed) {
        CapacityPosition storage p = positions[positionId];
        if (msg.sender != p.buyer) revert NotBuyer();
        if (block.timestamp > p.disputeDeadline) revert DisputeWindowClosed();

        p.disputeDeadline = uint64(block.timestamp) + p.disputeWindow;
        p.status = Status.Disputed;
        emit Disputed(positionId, reasonHash, p.disputeDeadline);
    }

    /// @notice Anyone may close out an unresolved dispute once its
    /// resolution window has passed, refunding the buyer. Without this,
    /// `Disputed` would be a terminal state with no payout path at all —
    /// the exact fund-lock class this project already fixed once on
    /// `expire()` (see AGENTS.md's construction-method notes) — just
    /// reached by a different route.
    function resolveDisputeByTimeout(uint256 positionId) external inStatus(positionId, Status.Disputed) {
        CapacityPosition storage p = positions[positionId];
        if (block.timestamp <= p.disputeDeadline) revert DisputeWindowOpen();

        p.status = Status.Refunded;
        emit Refunded(positionId);

        _payout(p.buyer, p.price + p.collateral);
    }

    /// @notice Buyer confirms delivery before disputing it (or before the
    /// window even requires a decision). Price and collateral both release
    /// to the provider; this and `finalizeDelivery` are the only paths that
    /// pay the provider the price.
    function settle(uint256 positionId) external inStatus(positionId, Status.DeliveryClaimed) {
        CapacityPosition storage p = positions[positionId];
        if (msg.sender != p.buyer) revert NotBuyer();

        p.status = Status.Settled;
        emit Settled(positionId);

        _payout(p.provider, p.price + p.collateral);
    }

    /// @notice Anyone may pay the provider once the dispute window has
    /// passed without the buyer disputing or settling. Without this, an
    /// unresponsive or bad-faith buyer could leave a provider's price and
    /// collateral locked in `DeliveryClaimed` indefinitely — the same
    /// class of liveness gap `claimDefault` already closes on the
    /// provider's side of `Activated`, mirrored here for the buyer's side
    /// of `DeliveryClaimed`.
    function finalizeDelivery(uint256 positionId) external inStatus(positionId, Status.DeliveryClaimed) {
        CapacityPosition storage p = positions[positionId];
        if (block.timestamp <= p.disputeDeadline) revert DisputeWindowOpen();

        p.status = Status.Settled;
        emit Settled(positionId);

        _payout(p.provider, p.price + p.collateral);
    }

    // `to` is always `p.provider` or `p.buyer` read from storage at the call
    // site, never an address passed directly by the caller of the public
    // function — so this is not an arbitrary-send-eth sink despite the lint.
    function _payout(address to, uint256 amount) private {
        if (amount == 0) return;
        // forge-lint: disable-next-line(arbitrary-send-eth)
        (bool ok,) = to.call{value: amount}("");
        require(ok, "payout failed");
    }
}
