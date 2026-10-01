import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  givenName: string | null;
  familyName: string | null;
  picture: string | null;
}

/** Verifies Google Identity Services ID tokens (signature, issuer, audience, expiry). */
@Injectable()
export class GoogleIdTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: ConfigService) {}

  clientId(): string | null {
    return this.config.get<string>('GOOGLE_CLIENT_ID')?.trim() || null;
  }

  /** Returns null for any token Google does not vouch for. */
  async verify(credential: string): Promise<GoogleIdentity | null> {
    const audience = this.clientId();
    if (!audience) {
      return null;
    }
    try {
      const ticket = await this.client.verifyIdToken({ idToken: credential, audience });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        return null;
      }
      return {
        sub: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
        givenName: payload.given_name ?? null,
        familyName: payload.family_name ?? null,
        picture: payload.picture ?? null,
      };
    } catch {
      return null;
    }
  }
}
