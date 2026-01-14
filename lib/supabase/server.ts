import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Debug: verify env vars are loaded
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[supabaseServer] Missing env vars:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseServiceKey,
    url: supabaseUrl?.substring(0, 30) + '...',
  });
}

export const supabaseServer = createClient<Database>(supabaseUrl, supabaseServiceKey);
