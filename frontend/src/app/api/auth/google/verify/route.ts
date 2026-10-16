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
    const [localPart, domainPart] = email.split('@');
    const domainSegments = (domainPart || '').split('.');
    let department = '';
    if (domainSegments.length >= 4) {
      department = domainSegments[0].toUpperCase();
    }
    const hasNumbers = /\d/.test(localPart);
    const userType: "student" | "faculty" = hasNumbers ? "student" : "faculty";
    const dotMatch = localPart.match(/\.(\d+)$/);
    const shortRoll = dotMatch ? dotMatch[1] : '';
    return { department, shortRoll, userType };
  } catch {
    return { department: '', shortRoll: '', userType: 'student' as const };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { credential, roleRequired, demoEmail, demoName } = body;

    const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || 'rishihood.edu.in';
    const adminEmails = (process.env.ADMIN_EMAILS || 'satvik.25110@csds.rishihood.edu.in,admin@rishihood.edu.in')
      .toLowerCase()
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

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

    // 1. Strict Domain Restriction Check
    if (!isAllowedDomain(email, allowedDomain)) {
      return NextResponse.json(
        {
          error: `Access Restricted: ${email} is not authorized. Please use your official university account ending in @${allowedDomain}.`
        },
        { status: 403 }
      );
    }

    const { department, shortRoll, userType } = extractEmailHints(email);
    const isAdmin = adminEmails.includes(email);

    // 2. Admin Privileges Check (if requested for Admin Portal)
    if (roleRequired === 'admin' && !isAdmin) {
      return NextResponse.json(
        {
          error: `Access Denied: ${email} is not listed as an administrator. Please contact IT or sign in with your admin master password.`
        },
        { status: 403 }
      );
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
