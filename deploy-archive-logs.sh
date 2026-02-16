#!/bin/bash

# Deploy archive-logs function
# This script deploys the function to update log formatting

echo "🚀 Deploying archive-logs function..."
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing via npx..."
    npx supabase functions deploy archive-logs
else
    echo "✅ Supabase CLI found"
    supabase functions deploy archive-logs
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Verify the 'user-logs' bucket contains files with the new format."
echo "2. Check function logs if issues persist:"
echo "   npx supabase functions logs archive-logs --tail"
echo ""
