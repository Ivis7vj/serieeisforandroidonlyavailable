import { createClient } from '@supabase/supabase-js';

// PRODUCTION CREDENTIALS FROM WEB APP .ENV
const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubWZwdHVtd3lqamd6bmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NjgwNTYsImV4cCI6MjA4MTU0NDA1Nn0.uQ8l2XPHfCumlwDmYimQRIqzDVVVUbAmRQMI0pIX9Zg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
