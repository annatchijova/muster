// SPDX-License-Identifier: Apache-2.0
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
///      `resolveDisputeByTimeout`, to either party via the arbitration
///      panel's verdict in `voteDispute`, or split by `expire` depending on
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
/// Level 4/5 addition: a position may name an arbitration panel at listing
/// time — a list of `members` and a `threshold`, visible to the buyer
/// before they ever reserve, the same way `price` and `activationSLA` are.
/// Once `Disputed`, any panel member may `voteDispute` for the buyer or the
/// provider; once either side's vote count reaches `threshold`, that
/// verdict executes automatically. A single trusted arbitrator (Level 4) is
/// just the `members.length == 1, threshold == 1` case of this — the panel
/// mechanism is a strict generalization, not a parallel feature. If the
/// panel never reaches threshold (or `threshold == 0`, meaning the position
/// opted out of arbitration entirely), `resolveDisputeByTimeout` still
/// fires afterward exactly as in Level 3 — arbitration is additive, never a
/// new way for funds to get stuck.
///
/// What this contract does NOT and cannot guarantee, even with a panel: that
/// its members are honest, competent, or mutually independent — M members
/// are M trust assumptions the buyer accepts by reserving a position that
/// names them, not a decentralized or trustless adjudication mechanism on
/// their own (no stake, no slashing for a bad-faith vote, no identity
/// verification that members aren't the same party under different
/// addresses). See docs/TECHNICAL_README.md "Trust boundary" and "Level 5:
/// M-of-N arbitration panels".
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

    enum DisputeVote {
        None,
        ProviderWins,
        BuyerWins
    }

    struct ArbitrationPanel {
        address[] members;
        uint256 threshold;
    }

    /// @notice Pure aggregation of outcomes already visible one at a time in
    /// `Settled`/`Defaulted`/`Refunded`/`DisputeResolved` events — no new
    /// trust assumption, no offchain oracle. `disputesTimedOutCount` is kept
    /// separate from `disputesLostCount` on purpose: `resolveDisputeByTimeout`
    /// is a declared conservative default, not an adjudicated verdict (see
    /// that function's NatSpec), so it must never be counted as a proven
    /// fault against the provider. This struct does not feed `activate`'s
    /// routing anywhere in this contract (Level 1 has nothing to route — one
    /// provider, one position) and exists as a read surface for a future
    /// reputation-aware pool, not a decision input here.
    struct ProviderStats {
        uint256 settledCount;
        uint256 defaultedCount;
        uint256 disputesLostCount;
        uint256 disputesTimedOutCount;
    }

    enum ReputationEvent {
        Settled,
        Defaulted,
        DisputeLost,
        DisputeTimedOut
    }

    uint256 public nextPositionId;
    mapping(uint256 => CapacityPosition) public positions;
    mapping(address => ProviderStats) public providerStats;

    mapping(uint256 => ArbitrationPanel) private panels;
    mapping(uint256 => mapping(address => DisputeVote)) private disputeVotes;
    mapping(uint256 => uint256) private providerVoteCount;
    mapping(uint256 => uint256) private buyerVoteCount;

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
    event DisputeVoteCast(
        uint256 indexed positionId, address indexed voter, bool providerWins, uint256 providerVotes, uint256 buyerVotes
    );
    event DisputeResolved(uint256 indexed positionId, bool providerWon);
    event Expired(uint256 indexed positionId);
    event Defaulted(uint256 indexed positionId);
    event ProviderStatsUpdated(
        address indexed provider,
        uint256 settledCount,
        uint256 defaultedCount,
        uint256 disputesLostCount,
        uint256 disputesTimedOutCount
    );

    error NotProvider();
    error NotBuyer();
    error NotArbitrator();
    error InvalidPanel();
    error AlreadyVoted();
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

    /// @notice Upper bound on an arbitration panel's member count, enforced
    /// at `listCapacity`. `voteDispute` scans `panel.members` linearly to
    /// check membership; without a bound, a provider could list a
    /// pathologically large panel and make every vote on that position cost
    /// unbounded gas — the same class of self-inflicted-but-still-worth-
    /// bounding risk `MAX_DURATION` closes for durations. 9 is generous for
    /// any realistic panel (a odd panel size is a reasonable default to
    /// avoid ties, not a requirement this contract enforces).
    uint256 public constant MAX_PANEL_SIZE = 9;

    modifier inStatus(uint256 positionId, Status expected) {
        Status actual = positions[positionId].status;
        if (actual != expected) revert WrongStatus(expected, actual);
        _;
    }

    /// @notice Provider lists capacity, posting `collateral` as a bond against
    /// default. `disputeWindow` is how long the buyer has, after the provider
    /// claims delivery, to dispute it before `finalizeDelivery` can pay the
    /// provider unilaterally. `panelMembers`/`panelThreshold` define who can
    /// vote on a dispute and how many matching votes execute a verdict —
    /// pass an empty `panelMembers` array and `panelThreshold == 0` to opt
    /// out of arbitration entirely (a single trusted arbitrator is just
    /// `panelMembers.length == 1, panelThreshold == 1`). Visible to the
    /// buyer before they ever reserve, same as every other term here.
    function listCapacity(
        bytes32 domain,
        uint256 quantity,
        uint64 validFrom,
        uint64 validUntil,
        uint64 activationSLA,
        uint64 disputeWindow,
        address[] calldata panelMembers,
        uint256 panelThreshold,
        uint256 price
    ) external payable returns (uint256 positionId) {
        if (validUntil <= validFrom) revert InvalidWindow();
        if (quantity == 0) revert WrongValue();
        if (activationSLA > MAX_DURATION || disputeWindow > MAX_DURATION) revert DurationTooLong();
        if (panelMembers.length > MAX_PANEL_SIZE) revert InvalidPanel();
        if (panelMembers.length == 0) {
            if (panelThreshold != 0) revert InvalidPanel();
        } else if (panelThreshold == 0 || panelThreshold > panelMembers.length) {
            revert InvalidPanel();
        }

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
        panels[positionId] = ArbitrationPanel({members: panelMembers, threshold: panelThreshold});

        emit Listed(positionId, msg.sender, domain, quantity, validFrom, validUntil, activationSLA, price, msg.value);
    }

    /// @notice View into a position's arbitration panel — a separate
    /// function because a dynamic array inside a struct can't be returned by
    /// `positions`'s auto-generated public getter.
    function arbitrationPanel(uint256 positionId) external view returns (address[] memory members, uint256 threshold) {
        ArbitrationPanel storage panel = panels[positionId];
        return (panel.members, panel.threshold);
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
        _recordOutcome(p.provider, ReputationEvent.Defaulted);

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
        _recordOutcome(p.provider, ReputationEvent.DisputeTimedOut);

        _payout(p.buyer, p.price + p.collateral);
    }

    /// @notice A member of the position's arbitration panel casts one vote,
    /// on whatever offchain basis they choose — this contract records the
    /// vote and, once either side reaches `threshold`, pays out the verdict;
    /// it does not and cannot evaluate the dispute's merits itself. No
    /// deadline on voting deliberately: the panel may act at any point while
    /// `Disputed`, racing `resolveDisputeByTimeout`'s permissionless
    /// fallback the same way `acceptActivation` races `claimDefault`
    /// elsewhere in this contract — whichever happens first wins, enforced
    /// by the same `inStatus` guard, not an explicit priority rule. Reverts
    /// for every caller, unconditionally, if the position was listed with an
    /// empty panel (opted out of arbitration): an empty `members` array has
    /// no possible member for `msg.sender` to match.
    function voteDispute(uint256 positionId, bool providerWins) external inStatus(positionId, Status.Disputed) {
        ArbitrationPanel storage panel = panels[positionId];
        bool isMember = false;
        for (uint256 i = 0; i < panel.members.length; i++) {
            if (panel.members[i] == msg.sender) {
                isMember = true;
                break;
            }
        }
        if (!isMember) revert NotArbitrator();
        if (disputeVotes[positionId][msg.sender] != DisputeVote.None) revert AlreadyVoted();

        disputeVotes[positionId][msg.sender] = providerWins ? DisputeVote.ProviderWins : DisputeVote.BuyerWins;
        uint256 pVotes = providerWins ? ++providerVoteCount[positionId] : providerVoteCount[positionId];
        uint256 bVotes = providerWins ? buyerVoteCount[positionId] : ++buyerVoteCount[positionId];

        emit DisputeVoteCast(positionId, msg.sender, providerWins, pVotes, bVotes);

        if (pVotes >= panel.threshold) {
            _executeDisputeVerdict(positionId, true);
        } else if (bVotes >= panel.threshold) {
            _executeDisputeVerdict(positionId, false);
        }
    }

    function _executeDisputeVerdict(uint256 positionId, bool providerWins) private {
        CapacityPosition storage p = positions[positionId];
        uint256 amount = p.price + p.collateral;
        if (providerWins) {
            p.status = Status.Settled;
            emit DisputeResolved(positionId, true);
            emit Settled(positionId);
            _recordOutcome(p.provider, ReputationEvent.Settled);
            _payout(p.provider, amount);
        } else {
            p.status = Status.Refunded;
            emit DisputeResolved(positionId, false);
            emit Refunded(positionId);
            _recordOutcome(p.provider, ReputationEvent.DisputeLost);
            _payout(p.buyer, amount);
        }
    }

    /// @notice Aggregates an outcome already visible in the event just
    /// emitted at the call site into `providerStats`. Private and called
    /// exactly once per terminal transition that reflects on the provider's
    /// track record — never on `expire()` (reflects the buyer's inaction,
    /// not the provider's) and never twice for the same position, since each
    /// call site is itself reachable only once per position (`inStatus`
    /// guards + one-way transitions, invariant 5).
    function _recordOutcome(address provider, ReputationEvent outcome) private {
        ProviderStats storage stats = providerStats[provider];
        if (outcome == ReputationEvent.Settled) {
            stats.settledCount++;
        } else if (outcome == ReputationEvent.Defaulted) {
            stats.defaultedCount++;
        } else if (outcome == ReputationEvent.DisputeLost) {
            stats.disputesLostCount++;
        } else {
            stats.disputesTimedOutCount++;
        }
        emit ProviderStatsUpdated(
            provider, stats.settledCount, stats.defaultedCount, stats.disputesLostCount, stats.disputesTimedOutCount
        );
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
        _recordOutcome(p.provider, ReputationEvent.Settled);

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
        _recordOutcome(p.provider, ReputationEvent.Settled);

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
