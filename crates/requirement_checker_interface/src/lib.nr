//! Requirement checker interface for ZK certificates.
//!
//! Defines the standard interface that all requirement checkers must implement:
//!   fn check_requirements(
//!       content_type: Field,
//!       content_note_0: [Field; 8],
//!       content_note_1: [Field; 8]
//!   )
//!
//! Checker type constants are used to dispatch to the correct contract implementation.

/// Age check requirement - verifies user meets minimum age threshold from KYC birth date.
pub global CHECKER_TYPE_AGE: u32 = 1;
