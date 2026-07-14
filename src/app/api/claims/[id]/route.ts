import QRCode from 'qrcode';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { getClaim } from '@/services/reward/reward.service';

/**
 * GET /api/claims/:id — one claim, plus a rendered QR data URL.
 *
 * The QR is generated server-side and delivered as a data URI. The signed token
 * never has to be reconstructed in the browser, and the page has no reason to know
 * how a claim token is built.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApi(async () => {
    const user = await requireUser();
    const { id } = await params;

    // `getClaim` scopes by userId, so an id belonging to someone else 404s rather
    // than leaking another player's reward.
    const claim = await getClaim(user.id, id);

    const qrDataUrl = await QRCode.toDataURL(claim.qrToken, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#1e1b4b', light: '#ffffff' },
    });

    return ok({ claim, qrDataUrl });
  });
}
