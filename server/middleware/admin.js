function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function requireAdmin(req, res, next) {
  const userEmail = String(req.user?.email || '').trim().toLowerCase();
  const adminEmails = getAdminEmails();

  if (!userEmail) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  if (adminEmails.length === 0) {
    return res.status(500).json({ error: 'Admin access list is not configured on server.' });
  }

  if (!adminEmails.includes(userEmail)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  return next();
}

export default requireAdmin;
