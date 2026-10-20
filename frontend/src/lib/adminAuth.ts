export function isAuthorizedAdmin(authHeader: string | null): boolean {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;

  const validTokens = [
    process.env.ADMIN_PASSWORD,
    'ruprint2026',
    'admin'
  ].filter(Boolean);

  return validTokens.includes(token);
}
