import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function isAllowedDomain(email: string, targetDomain: string = 'rishihood.edu.in'): boolean {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1].toLowerCase().trim();
  const allowed = targetDomain.toLowerCase().trim();
  return domain === allowed || domain.endsWith('.' + allowed);
}

function extractEmailHints(email: string) {
  try {
    const [localPart, domainPart] = email.toLowerCase().split('@');
    const hasNumbers = /\d/.test(localPart);
    const userType: "student" | "faculty" = hasNumbers ? "student" : "faculty";

    let department = '';
    if (userType === 'faculty') {
      department = 'FACULTY';
    } else {
      const match = (domainPart || '').match(/^([^.]+)\.rishihood/);
      if (match && match[1]) {
        department = match[1].toUpperCase();
        if (department === 'NEWTON') department = 'NST';
      }
    }

    const dotMatch = localPart.match(/\.[a-z]?(\d+)$/i);
    const shortRoll = dotMatch ? dotMatch[1] : '';
    return { department, shortRoll, userType };
  } catch {
    return { department: '', shortRoll: '', userType: 'student' as const };
  }
}

const PERMANENT_ADMIN_EMAILS = [
  'satvik.k25110@csds.rishihood.edu.in',
  'satvikkesarwani49@gmail.com',
  'admin@rishihood.edu.in',
  'libraryservices@rishihood.edu.in',
];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { credential, roleRequired, demoEmail, demoName } = body;

    const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || 'rishihood.edu.in';
    const envAdminEmails = (process.env.ADMIN_EMAILS || '')
      .toLowerCase()
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    const adminEmails = Array.from(
      new Set([...PERMANENT_ADMIN_EMAILS.map((e) => e.toLowerCase().trim()), ...envAdminEmails])
    );

    let email = '';
    let name = '';
    let picture = '';

    if (credential) {
      // Verify Google ID Token with Google's public endpoint
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
        cache: 'no-store'
      });

      if (!googleRes.ok) {
        return NextResponse.json({ error: 'Invalid or expired Google token' }, { status: 401 });
      }

      const googlePayload = await googleRes.json();

      if (!googlePayload.email || (googlePayload.email_verified !== true && googlePayload.email_verified !== 'true')) {
        return NextResponse.json({ error: 'Google email is not verified' }, { status: 400 });
      }

      email = googlePayload.email.toLowerCase().trim();
      name = googlePayload.name || email.split('@')[0];
      picture = googlePayload.picture || '';
    } else if (demoEmail) {
      // Demo / development fallback when Google Client ID is not yet configured
      email = demoEmail.toLowerCase().trim();
      name = demoName || email.split('@')[0];
    } else {
      return NextResponse.json({ error: 'Missing authentication credential' }, { status: 400 });
    }

    const { department, shortRoll, userType } = extractEmailHints(email);
    
    // Strict check: only explicitly configured admin emails are granted admin access
    const isAdmin = adminEmails.includes(email);

    console.log('[Auth] Google sign-in check:', { email, roleRequired, isAdmin });

    // 1. Admin Privileges Check (if requested for Admin Portal)
    if (roleRequired === 'admin') {
      if (!isAdmin) {
        return NextResponse.json(
          {
            error: `Access Denied: ${email} is not listed as an administrator. Please contact IT or sign in with your admin master password.`
          },
          { status: 403 }
        );
      }
    } else {
      // 2. Student / Faculty flow: require official university domain or admin
      if (!isAllowedDomain(email, allowedDomain) && !isAdmin) {
        return NextResponse.json(
          {
            error: `Access Restricted: ${email} is not authorized. Please use your official university account ending in @${allowedDomain}.`
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        name,
        email,
        picture,
        isAdmin,
        department,
        shortRoll,
        userType,
      },
      // If admin, supply master bearer token for admin API calls
      adminToken: isAdmin ? (process.env.ADMIN_PASSWORD || 'ruprint2026') : null
    });
  } catch (error: any) {
    console.error('Google Auth verification error:', error);
    return NextResponse.json({ error: 'Authentication service error' }, { status: 500 });
  }
}
