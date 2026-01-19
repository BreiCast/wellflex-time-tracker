#!/bin/bash

# Generate Supabase TypeScript types
# You'll need to set your SUPABASE_ACCESS_TOKEN environment variable
# Get it from: https://supabase.com/dashboard/account/tokens

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "Error: SUPABASE_ACCESS_TOKEN environment variable is not set"
  echo "Get your token from: https://supabase.com/dashboard/account/tokens"
  echo ""
  echo "Then run:"
  echo "  export SUPABASE_ACCESS_TOKEN=your_token_here"
  echo "  ./generate-types.sh"
  exit 1
fi

echo "Generating Supabase types..."
npx supabase gen types typescript \
  --project-id lgtzybhqelmbgovlhvqc \
  --schema public \
  > types/database.ts

echo "✅ Types generated successfully!"
echo "Run 'npm run build' to verify everything works."

