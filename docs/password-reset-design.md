# Password Reset Architecture (Multi-Module)

## Architecture Overview
- Shared core logic in service and repository layers:
  - `services/passwordResetService.js`
  - `repositories/passwordResetRepository.js`
- Module-specific routes use a shared controller factory:
  - `controllers/auth/passwordResetController.js`
- Security and validation shared utilities:
  - `utils/passwordResetValidation.js`
  - `utils/passwordResetSecurity.js`
  - `utils/passwordResetModules.js`
- Persistence:
  - `models/PasswordResetToken.js`
  - `models/PasswordResetRequestLog.js`

## Route Table Per Module
All modules expose:
- `POST /<module-base>/forgot-password`
- `POST /<module-base>/reset-password`

| Module | Forgot Password URL | Reset Password URL | Purpose |
|---|---|---|---|
| Admin | `/api/admin/forgot-password` | `/api/admin/reset-password` | Admin password recovery |
| User | `/api/auth/forgot-password` | `/api/auth/reset-password` | User password recovery |
| Doctor | `/api/doctors/forgot-password` | `/api/doctors/reset-password` | Doctor password recovery |
| Pharmacy | `/api/pharmacies/forgot-password` | `/api/pharmacies/reset-password` | Pharmacy password recovery |
| Patient | `/api/patients/forgot-password` | `/api/patients/reset-password` | Patient password recovery |
| Hospital | `/api/hospitals/forgot-password` | `/api/hospitals/reset-password` | Hospital password recovery |
| Diagnostics Center | `/api/diagnostics-centers/forgot-password` | `/api/diagnostics-centers/reset-password` | Diagnostics center password recovery |
| Partner Organization | `/api/partner-organizations/forgot-password` | `/api/partner-organizations/reset-password` | Partner organization password recovery |
| Job Seeker | `/api/job-seekers/forgot-password` | `/api/job-seekers/reset-password` | Job seeker password recovery |
| Employer | `/api/employers/forgot-password` | `/api/employers/reset-password` | Employer password recovery |

## Request/Response DTOs
### Forgot Password Request
```json
{
  "identifier": "doctor@example.com"
}
```

### Forgot Password Response (Always Generic)
```json
{
  "success": true,
  "message": "If the account exists, reset instructions have been sent",
  "data": {},
  "errorCode": null
}
```

### Reset Password Request
```json
{
  "token": "98f66b205c26cf95a4630f7661c4a2d322ea36781dc1168be6f7f15e2e8af6a7",
  "newPassword": "StrongP@ssword123",
  "confirmPassword": "StrongP@ssword123"
}
```

### Reset Password Response
```json
{
  "success": true,
  "message": "Password reset successful",
  "data": {},
  "errorCode": null
}
```

### Error Response
```json
{
  "success": false,
  "message": "Invalid reset token format",
  "data": {},
  "errorCode": "INVALID_RESET_TOKEN_FORMAT"
}
```

## Validation Rules
- Identifier:
  - Email regex: `^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$`
  - Phone regex (E.164): `^\\+?[1-9]\\d{7,14}$`
- Password policy:
  - Min length: 8
  - At least one uppercase, one lowercase, one number, one special character
- Token format:
  - 64-char lowercase hex string
  - Regex: `^[a-f0-9]{64}$`
- Token expiry:
  - Default: 15 minutes (configurable via env)

## Service Flow
### Forgot Password Flow
1. Validate module and identifier format.
2. Apply module+identifier+IP rate limiting.
3. Always return generic success message (no account existence leakage).
4. If account exists:
   - Delete previous active reset tokens.
   - Generate random token.
   - Store only token hash.
   - Send token via email/SMS provider.

### Reset Password Flow
1. Validate module, token format, and password policy.
2. Look up active token by token hash.
3. Reject invalid, expired, or used token.
4. Hash new password with bcrypt.
5. Increment `tokenVersion` to invalidate older JWTs.
6. Mark token used and invalidate other active reset tokens for user.

## Database Design
### Collection: `passwordresettokens`
- `moduleKey` (string)
- `userId` (ObjectId)
- `identifierHash` (string)
- `tokenHash` (string, unique)
- `expiresAt` (date, TTL index)
- `usedAt` (date, nullable)
- `createdAt`, `updatedAt`

Indexes:
- TTL on `expiresAt`
- `{ moduleKey, userId, createdAt: -1 }`
- `{ moduleKey, identifierHash, createdAt: -1 }`
- Unique on `tokenHash`

### Collection: `passwordresetrequestlogs`
- `moduleKey` (string)
- `identifierHash` (string)
- `ipHash` (string)
- `expiresAt` (date, TTL index)
- `createdAt`, `updatedAt`

Indexes:
- TTL on `expiresAt`
- `{ moduleKey, identifierHash, ipHash, createdAt: -1 }`

Cleanup strategy:
- TTL indexes automatically purge expired reset tokens and old request logs.

## Security Checklist
- [x] Never reveal whether account exists.
- [x] Rate limit forgot-password attempts.
- [x] One-time short-lived reset token.
- [x] Token hashing in DB (HMAC-SHA256 with pepper/secret).
- [x] Password hashing with bcrypt (cost 12 on reset).
- [x] Invalidate old JWT sessions with `tokenVersion` increment.
- [x] Standardized error format with `errorCode`.

## Standard Error Codes
- `MISSING_IDENTIFIER`
- `INVALID_IDENTIFIER_FORMAT`
- `INVALID_MODULE`
- `RATE_LIMITED_FORGOT_PASSWORD`
- `INVALID_RESET_TOKEN_FORMAT`
- `INVALID_OR_USED_RESET_TOKEN`
- `EXPIRED_RESET_TOKEN`
- `INVALID_RESET_TOKEN`
- `WEAK_PASSWORD`
- `PASSWORD_MISMATCH`
- `UNAUTHORIZED_INVALID_TOKEN`
- `SESSION_INVALIDATED`

## Pseudocode
```text
forgotPassword(module, identifier, ip):
  assert module valid
  assert identifier valid email/phone
  if requests in window for module+identifier+ip >= limit: throw 429
  log request
  user = find user by identifier
  if user exists:
    delete existing active tokens for user
    rawToken = random(32 bytes hex)
    tokenHash = HMAC_SHA256(rawToken, pepper)
    save tokenHash with ttl and usedAt=null
    send email/sms with rawToken
  return generic success

resetPassword(module, token, newPassword, confirmPassword):
  assert module valid
  assert token format valid
  assert password policy valid
  assert confirmPassword == newPassword
  tokenHash = HMAC_SHA256(token, pepper)
  resetRecord = find active token by module+tokenHash
  if not found: throw invalid token
  if expired: throw expired token
  user = find user by resetRecord.userId
  if not found: throw invalid token
  user.password = bcrypt(newPassword, cost=12)
  user.tokenVersion += 1
  save user
  mark reset token used
  delete other active reset tokens for user
  return success
```

## Test Cases
### Unit
- Identifier validation (valid/invalid email and phone)
- Password policy acceptance/rejection
- Reset token format validation

### Integration
- Forgot password happy path
- Reset password with valid token
- Reset password with invalid token
- Reset password with expired token
- Reset password with reused token
- Forgot password brute-force/rate-limit case

## Notes
- Current implementation logs reset token in non-production only. Integrate a real email/SMS provider in `sendResetInstructions`.
- No `staff` module currently exists in this repository. Add a staff model and route mapping to include it in the same pattern.

## Notification Provider Integration
- Email provider: SMTP via `nodemailer`.
- SMS provider: Twilio via `twilio` package.
- Channel selection is automatic:
  - Email identifier -> SMTP delivery.
  - Phone identifier -> Twilio delivery.
- Non-production fallback:
  - If SMTP/Twilio is not configured, reset message content is logged to console.
- Production fallback:
  - If provider config is missing, delivery failure is logged while API response remains generic.

## Startup Validation
- `validateStartupConfig` runs during server startup.
- Strict mode is enabled by default in production.
- Strict mode can be controlled with `PASSWORD_RESET_REQUIRE_DELIVERY`.
- Behavior in strict mode:
  - Fails startup if both SMTP and Twilio are missing.
  - Fails startup if a provider is partially configured.
