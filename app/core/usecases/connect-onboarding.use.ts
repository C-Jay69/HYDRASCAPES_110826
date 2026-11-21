import type { ProfileGateway } from '@/infrastructure/db/profile.gateway';
import type { ConnectPort } from '@/app/lib/payments/connect';
import { HttpError } from '@/app/lib/http-error';

export interface ConnectOnboardingInput {
  profileId: string;
  returnUrl: string;
  refreshUrl: string;
}

export interface ConnectOnboardingOutput {
  accountId: string;
  url: string;
  created: boolean;
}

/**
 * Creates (once) a Connect account for an owner or host and returns a fresh
 * onboarding link (spec §15).
 *
 * The account id is persisted on the profile. Links expire, so this is safe
 * and expected to be called repeatedly — only account creation is one-off.
 */
export class ConnectOnboardingUseCase {
  constructor(
    private readonly profiles: ProfileGateway,
    private readonly connect: ConnectPort,
  ) {}

  async execute(input: ConnectOnboardingInput): Promise<ConnectOnboardingOutput> {
    if (!this.connect.isConfigured()) {
      throw new HttpError(503, 'Stripe is not configured; payouts cannot be set up yet');
    }

    const profile = await this.profiles.getById(input.profileId);
    if (!profile) throw new HttpError(404, 'Profile not found');

    let accountId = profile.stripe_connect_id;
    let created = false;

    if (!accountId) {
      const account = await this.connect.createAccount({ email: profile.email });
      accountId = account.id;
      created = true;

      const saved = await this.profiles.update(profile.id, { stripe_connect_id: accountId });
      if (!saved) throw new HttpError(500, 'Could not save the payout account');
    }

    const link = await this.connect.createAccountLink(accountId, {
      returnUrl: input.returnUrl,
      refreshUrl: input.refreshUrl,
    });

    return { accountId, url: link.url, created };
  }
}
