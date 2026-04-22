# Security Specification for Debate Fantasy League

## 1. Data Invariants
- A team must have exactly 3 debaters.
- Total price of 3 debaters must not exceed the current budget (initial 50 + appreciation).
- Users cannot edit their teams after the round deadline has passed.
- Only admins can create/update debaters and rounds.
- Users can only read/write their own team data.

## 2. The Dirty Dozen Payloads
1. **Ghost Debater**: Adding an ID to `debaterIds` that doesn't exist in `/debaters`.
2. **Budget Overflow**: Creating a team with total price of 60 when budget is 50.
3. **Draft After Deadline**: Updating `debaterIds` when `rounds` status is 'active'.
4. **Self-Admin Escalation**: Setting `isAdmin: true` on own user profile.
5. **Over-Sized Team**: Sending an array of 4 debaters.
6. **Price Manipulation**: Attempting to update a debater's price as a regular user.
7. **Round Forgery**: Creating a round as a regular user.
8. **Point Theft**: Updating own `totalPoints` directly.
9. **Team Hijack**: Updating another user's team by spoofing `userId`.
10. **Identity Poisoning**: Using a 2KB string as a debater ID.
11. **Negative Price**: Creating a debater with a price of -5.
12. **Future Round Status**: Setting an upcoming round to 'completed' without admin rights.

## 3. Test Runner
(I will implement the rules now based on these specs)
