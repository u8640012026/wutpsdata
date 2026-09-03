import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual env parsing since dotenv might not be installed standalone
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(
  env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function run() {
  const { data, error } = await supabase.storage.createBucket('announcements', {
    public: true,
    fileSizeLimit: 10485760 // 10MB
  });
  
  if (error) {
    console.error('Error creating bucket:', error);
  } else {
    console.log('Bucket created successfully:', data);
  }
}
run();
