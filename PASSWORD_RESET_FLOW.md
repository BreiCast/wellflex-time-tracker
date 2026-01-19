# Password Reset Flow Documentation

## Overview

The password reset functionality allows users to reset their password if they forget it. The flow consists of two main pages:

1. **Forgot Password Page** (`/forgot-password`) - User requests a password reset email
2. **Reset Password Page** (`/reset-password`) - User sets a new password using the link from the email

## Complete Flow

### Step 1: Request Password Reset

1. User navigates to `/forgot-password` (linked from login page)
2. User enters their email address
3. System sends password reset email via Supabase
4. User sees success message with instructions

### Step 2: Receive Email

1. User receives email with password reset link
2. Link format: `https://tracker.wellflex.co/reset-password?token_hash=...&type=recovery`
3. Link expires after 24 hours (Supabase default)

### Step 3: Reset Password

1. User clicks link in email
2. User is redirected to `/reset-password` page
3. System validates the token
4. User enters new password (twice for confirmation)
5. System updates password
6. User is redirected to login page

## Technical Implementation

### Files Involved

- `app/forgot-password/page.tsx` - Request reset email
- `app/reset-password/page.tsx` - Set new password
- `app/login/page.tsx` - Link to forgot password

### API Methods Used

**Forgot Password:**
```typescript
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${NEXT_PUBLIC_APP_URL}/reset-password`
})
```

**Reset Password:**
```typescript
// Verify token (OTP flow)
supabase.auth.verifyOtp({
  type: 'recovery',
  token_hash
})

// Or exchange code for session (PKCE flow)
supabase.auth.exchangeCodeForSession(token)

// Update password
supabase.auth.updateUser({
  password: newPassword
})
```

## Configuration Requirements

### Supabase Dashboard

1. **Site URL**: Set to `https://tracker.wellflex.co`
2. **Redirect URLs**: Must include:
   - `https://tracker.wellflex.co/reset-password`
   - `http://localhost:3000/reset-password` (for development)

### Environment Variables

- `NEXT_PUBLIC_APP_URL` - Must be set to production URL in Vercel

### Email Templates

The password reset email template in Supabase should use:
- `{{ .ConfirmationURL }}` - The reset link
- `{{ .Email }}` - User's email address

## Error Handling

The reset password page handles:
- Invalid or expired tokens
- Password mismatch
- Password too short (< 6 characters)
- Network errors
- Already used tokens

## Security Features

1. **Token Expiration**: Links expire after 24 hours
2. **One-time Use**: Tokens are invalidated after use
3. **Password Validation**: Minimum 6 characters, must match confirmation
4. **Secure Session**: User must be authenticated via token before updating password

## Testing

### Test the Flow

1. Go to `/forgot-password`
2. Enter a valid email address
3. Check email inbox (and spam folder)
4. Click the reset link
5. Enter new password twice
6. Verify redirect to login page
7. Test login with new password

### Common Issues

**Link doesn't work:**
- Check Supabase Dashboard → Redirect URLs includes `/reset-password`
- Verify `NEXT_PUBLIC_APP_URL` is set correctly
- Check email template uses correct URL format

**Token expired:**
- Request a new password reset
- Tokens expire after 24 hours

**Password update fails:**
- Ensure token is valid and not already used
- Check password meets requirements (min 6 characters)
- Verify passwords match

## User Experience

- Clear error messages for all failure cases
- Success confirmation before redirect
- Loading states during API calls
- Disabled form inputs during processing
- Automatic redirect to login after success

