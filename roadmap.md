# Accounts payable update
- [x] Require a unit in manual and AI payable entry; list all units within the company.
- [x] Add payment and confirmed deletion actions to payable rows.
- [x] Run three unit-selection tests; compilation passes and unauthenticated finance access redirects to auth without page errors.
- [ ] Verify saving, payment and deletion signed in; external Supabase provides no authenticated test session.

# Subscription correction
- [x] Move entitlement and legacy paid data to existing companies.
- [x] Make gates and banners use company status and shared trial.
- [x] Associate Efí charges and confirmed payments with company.
- [x] Verify inheritance and payment isolation with nine tests; database inheritance checked with zero mismatches.
- [ ] Register the deployed Vercel `/api/efi-webhook` callback with Efí; provider configuration requires the user's Vercel deployment URL.
- [ ] Verify a paid invited member in the UI; external Supabase does not provide an authenticated test session.