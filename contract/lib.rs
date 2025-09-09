#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod otc {
    // Import necessary types from ink's prelude and standard library for no_std compatibility.
    use ink::prelude::{string::String, vec::Vec};
    use ink::storage::Mapping;
    // Use `BTreeMap` for efficient in-memory tallying during finalization.
    use ink::prelude::collections::BTreeMap;
    use ink::H160;

    // -------- Types --------
    pub type StationId = u64;
    pub type ProposalId = u64;

    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    #[derive(Clone, Debug, PartialEq, Eq)]
    #[cfg_attr(feature = "std", derive(ink::storage::traits::StorageLayout))]
    pub struct Voter {
        pub voter_id: H160,
        pub voted: bool,
    }

    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    #[derive(Clone, Debug, PartialEq, Eq)]
    #[cfg_attr(feature = "std", derive(ink::storage::traits::StorageLayout))]
    pub enum StationStatus {
        Open,
        Finalized,
    }

    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    #[derive(Clone, Debug, PartialEq, Eq)]
    #[cfg_attr(feature = "std", derive(ink::storage::traits::StorageLayout))]
    pub struct PollingStation {
        pub station_name: String,
        pub status: StationStatus,
        pub submit_end: u64,
        pub vote_end: u64,
        pub next_proposal_id: ProposalId,
        pub final_result_hash: Option<Hash>,
        pub final_proposal_id: Option<ProposalId>,
    }

    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    #[derive(Clone, Debug, PartialEq, Eq)]
    #[cfg_attr(feature = "std", derive(ink::storage::traits::StorageLayout))]
    pub struct Proposal {
        pub cid: Vec<u8>,        // IPFS CID (bytes)
        pub result_hash: Hash,   // Hash of canonical tally JSON
        pub submitter: H160,
        pub submitted_at: u64,
        pub nominations: u32,
    }

    // -------- Storage --------
    #[ink(storage)]
    pub struct ElectionTally {
        admin: H160,
        stations: Mapping<StationId, PollingStation>,
        name_to_station: Mapping<String, StationId>,
        proposals: Mapping<(StationId, ProposalId), Proposal>,
        voter_station: Mapping<H160, StationId>,
        nominated_once: Mapping<(StationId, H160), ()>,
    }

    // -------- Events --------
    #[ink(event)]
    pub struct StationRegistered {
        #[ink(topic)] station: StationId,
        name: String,
        submit_end: u64,
        vote_end: u64,
    }

    #[ink(event)]
    pub struct VoterRegistered {
        #[ink(topic)] voter: H160,
        #[ink(topic)] station: StationId,
    }

    #[ink(event)]
    pub struct TallySubmitted {
        #[ink(topic)] station: StationId,
        #[ink(topic)] proposal: ProposalId,
        submitter: H160,
        result_hash: Hash,
        cid: Vec<u8>,
    }

    #[ink(event)]
    pub struct Nominated {
        #[ink(topic)] station: StationId,
        #[ink(topic)] proposal: ProposalId,
        #[ink(topic)] voter: H160,
        total_nominations: u32,
    }

    #[ink(event)]
    pub struct Finalized {
        #[ink(topic)] station: StationId,
        winning_result_hash: Hash,
        representative_proposal: ProposalId,
        total_nominations_for_hash: u32,
    }

    // -------- Impl --------
    impl ElectionTally {
        /// Constructor that initializes the contract with the caller as the admin.
        #[ink(constructor)]
        pub fn new(admin: H160) -> Self {
            Self {
                admin,
                stations: Default::default(),
                name_to_station: Default::default(),
                proposals: Default::default(),
                voter_station: Default::default(),
                nominated_once: Default::default(),
            }
        }

        /// ADMIN: registers a station with unique name and time windows.
        #[ink(message)]
        pub fn register_station(
            &mut self,
            station: StationId,
            name: String,
            submit_end: u64,
            vote_end: u64,
        ) {
            self.ensure_admin();
            assert!(submit_end < vote_end, "submit_end must be < vote_end");
            assert!(self.stations.get(station).is_none(), "station already exists");
            assert!(self.name_to_station.get(&name).is_none(), "name already used");

            let gate = PollingStation {
                station_name: name.clone(),
                status: StationStatus::Open,
                submit_end,
                vote_end,
                next_proposal_id: 1,
                final_result_hash: None,
                final_proposal_id: None,
            };
            self.stations.insert(station, &gate);
            self.name_to_station.insert(&name, &station);

            self.env().emit_event(StationRegistered {
                station,
                name,
                submit_end,
                vote_end,
            });
        }

        /// VOTER: self-registers to exactly one station (cannot change later).
        #[ink(message)]
        pub fn register_voter(&mut self, station: StationId) {
            let caller = self.env().caller();
            assert!(self.stations.get(station).is_some(), "station not found");
            assert!(self.voter_station.get(caller).is_none(), "already registered");
            self.voter_station.insert(caller, &station);
            self.env().emit_event(VoterRegistered { voter: caller, station });
        }

        /// SUBMIT: add a tally proposal (CID + result_hash) during submission window.
        #[ink(message)]
        pub fn submit_tally(
            &mut self,
            station: StationId,
            cid: Vec<u8>,
            result_hash: Hash,
        ) -> ProposalId {
            let caller = self.env().caller();
            let now = self.env().block_timestamp();

            let mut gate = self.stations.get(station).expect("station not found");
            assert!(matches!(gate.status, StationStatus::Open), "station finalized");
            assert!(now <= gate.submit_end, "submission window closed");

            let pid = gate.next_proposal_id;
            gate.next_proposal_id = pid.checked_add(1).expect("proposal id overflow");
            self.stations.insert(station, &gate);

            let p = Proposal {
                cid: cid.clone(),
                result_hash,
                submitter: caller,
                submitted_at: now,
                nominations: 0,
            };
            self.proposals.insert((station, pid), &p);

            self.env().emit_event(TallySubmitted {
                station,
                proposal: pid,
                submitter: p.submitter,
                result_hash: p.result_hash,
                cid,
            });

            pid
        }

        /// NOMINATE: a registered voter nominates ONE proposal for THEIR station during vote window.
        #[ink(message)]
        pub fn nominate_tally(&mut self, station: StationId, proposal: ProposalId) {
            let voter = self.env().caller();
            let now = self.env().block_timestamp();

            // Must be registered and mapped to this station
            let voter_station = self.voter_station.get(voter).expect("voter not registered");
            assert_eq!(voter_station, station, "wrong station");

            let gate = self.stations.get(station).expect("station not found");
            assert!(matches!(gate.status, StationStatus::Open), "station finalized");
            assert!(now > gate.submit_end, "nominations start after submit_end");
            assert!(now <= gate.vote_end, "nomination window closed");

            // One nomination per voter per station
            assert!(self.nominated_once.get((station, voter)).is_none(), "already nominated");

            // Proposal must exist
            let mut p = self.proposals.get((station, proposal)).expect("proposal not found");

            // Register nomination
            self.nominated_once.insert((station, voter), &());
            p.nominations = p.nominations.saturating_add(1);
            self.proposals.insert((station, proposal), &p);

            self.env().emit_event(Nominated {
                station,
                proposal,
                voter,
                total_nominations: p.nominations,
            });
        }

        /// FINALIZE: after vote_end, pick the `result_hash` with the most total nominations.
        /// Tie-breakers: lowest `result_hash` (lexicographically), then lowest `proposal_id`.
        #[ink(message)]
        pub fn finalize_tally(&mut self, station: StationId) {
            let now = self.env().block_timestamp();

            let mut gate = self.stations.get(station).expect("station not found");
            assert!(matches!(gate.status, StationStatus::Open), "already finalized");
            assert!(now > gate.vote_end, "vote window still open");

            // Use a BTreeMap to efficiently count nominations for each unique hash
            let mut hash_tallies: BTreeMap<Hash, u32> = BTreeMap::new();
            let mut proposal_map = BTreeMap::new();

            for pid in 1..gate.next_proposal_id {
                if let Some(p) = self.proposals.get((station, pid)) {
                    // Update the tally for this hash
                    let entry = hash_tallies.entry(p.result_hash).or_insert(0);
                    *entry = (*entry).saturating_add(p.nominations);

                    // Keep track of the lowest proposal ID for each hash group
                    let rep_entry = proposal_map.entry(p.result_hash).or_insert(pid);
                    if pid < *rep_entry {
                        *rep_entry = pid;
                    }
                }
            }

            // Find the winner
            let mut best_hash: Option<Hash> = None;
            let mut best_votes: u32 = 0;

            for (hash, votes) in hash_tallies.iter() {
                if *votes > best_votes {
                    best_votes = *votes;
                    best_hash = Some(*hash);
                } else if *votes == best_votes {
                    if let Some(current_best_hash) = best_hash {
                        // Tie-breaker: lowest hash
                        if *hash < current_best_hash {
                            best_hash = Some(*hash);
                        }
                    } else {
                        // This case should not be reachable if best_votes > 0
                        best_hash = Some(*hash);
                    }
                }
            }
            
            // Extract the final results
            let winning_hash = best_hash.expect("no proposals submitted");
            let rep_pid = proposal_map.get(&winning_hash).copied().expect("no representative proposal");

            // Update and store the station state
            gate.status = StationStatus::Finalized;
            gate.final_result_hash = Some(winning_hash);
            gate.final_proposal_id = Some(rep_pid);
            self.stations.insert(station, &gate);

            // Emit the Finalized event
            self.env().emit_event(Finalized {
                station,
                winning_result_hash: winning_hash,
                representative_proposal: rep_pid,
                total_nominations_for_hash: best_votes,
            });
        }

        /// View: get station info.
        #[ink(message)]
        pub fn get_station(&self, station: StationId) -> Option<PollingStation> {
            self.stations.get(station)
        }

        /// View: get a proposal.
        #[ink(message)]
        pub fn get_proposal(&self, station: StationId, proposal: ProposalId) -> Option<Proposal> {
            self.proposals.get((station, proposal))
        }

        /// View: which station is a voter mapped to?
        #[ink(message)]
        pub fn get_voter_station(&self, voter: H160) -> Option<StationId> {
            self.voter_station.get(voter)
        }

        // ---------- internal helpers ----------
        fn ensure_admin(&self) {
            assert_eq!(self.env().caller(), self.admin, "only admin");
        }
    }
}