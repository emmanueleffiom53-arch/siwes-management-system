import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
    "https://pfxkebrgpxlzwmekcpse.supabase.co";

const supabaseKey =
    "sb_publishable_e7B3guEPAWQDmKtVRvnOaw_DhtBlnIK";

export const supabase = createClient(
    supabaseUrl,
    supabaseKey
);