-- Create function to safely get user email
CREATE OR REPLACE FUNCTION get_user_email(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Try to get the email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;
  
  -- If email is null or not found, return a formatted user ID
  IF user_email IS NULL THEN
    RETURN 'user_' || substring(user_id::text, 1, 8);
  END IF;
  
  RETURN user_email;
END;
$$;
