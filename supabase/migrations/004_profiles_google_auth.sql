-- Add Google Auth / onboarding fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS org_name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN (
    'PWD Engineer',
    'Municipal Corporation',
    'College Infrastructure Team',
    'Private Contractor',
    'Other'
  )),
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Backfill user_id from id for any existing rows
UPDATE profiles SET user_id = id WHERE user_id IS NULL;

-- Unique constraint so one user_id maps to exactly one profile
ALTER TABLE profiles
  ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile" ON profiles
  FOR ALL USING (id = auth.uid());
