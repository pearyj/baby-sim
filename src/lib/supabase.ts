import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjrzbtzbdvyirtnupraz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqcnpidHpiZHZ5aXJ0bnVwcmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1OTExNjAsImV4cCI6MjA2NDE2NzE2MH0.lqa4YXSRy1wdboSJEBv9NjEmF62cW5OR9f90Qiic-fA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 