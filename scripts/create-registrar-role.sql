-- Create Registrar role
INSERT INTO "Role" (id, name, description, permissions, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Registrar',
  'Authorized to register members and confirm attendance',
  '["create_members", "edit_members", "view_members", "check_in_members", "check_out_members", "verify_attendance", "view_events"]'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;
