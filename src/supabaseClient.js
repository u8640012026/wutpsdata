import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kxedexdzlnyqkeemepyu.supabase.co';
const supabaseAnonKey = 'sb_publishable_wDxB3SDN4I5F5_XImtCQXQ_-tX8K_pY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
