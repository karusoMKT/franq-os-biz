# Subscription correction
# Accounts payable update
- [ ] Require a unit in manual and AI payable entry.
- [ ] Add payment and confirmed deletion actions to payable rows.
- [ ] Run unit-selection tests and verify available UI flows.

- [x] Move entitlement and legacy paid data to existing companies.
- [x] Make gates and banners use company status and shared trial.
- [x] Associate Efí charges and confirmed payments with company.
- [x] Verify inheritance and payment isolation with nine tests; database inheritance checked with zero mismatches.
- [ ] Register the deployed Vercel `/api/efi-webhook` callback with Efí; provider configuration requires the user's Vercel deployment URL.
- [ ] Verify a paid invited member in the UI; external Supabase does not provide an authenticated test session.