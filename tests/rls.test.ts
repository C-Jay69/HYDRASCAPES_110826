import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  asUser,
  anonClient,
  serviceClient,
  IDS,
} from './helpers/supabase';

let cleanup: (() => Promise<void>) | null = null;

beforeAll(async () => {
  const service = serviceClient();
  const { error } = await service
    .from('disputes')
    .insert({
      id: '50000000-0000-0000-0000-000000000001',
      booking_id: IDS.booking1,
      claimant_id: IDS.sarah,
      respondent_id: IDS.elena,
      amount_claimed_minor: 5000,
      description: 'RLS test dispute between booking parties',
    });
  if (error) throw new Error(`setup dispute: ${error.message}`);

  cleanup = async () => {
    await service.from('disputes').delete().eq('id', '50000000-0000-0000-0000-000000000001');
  };
});

afterAll(async () => {
  await cleanup?.();
});

describe('RLS: properties', () => {
  it('Alice can read Alice\'s private property', async () => {
    const alice = await asUser('alice');
    const { data, error } = await alice
      .from('properties')
      .select('id, title')
      .eq('id', IDS.aliceCottage);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(IDS.aliceCottage);
  });

  it('Bob cannot read Alice\'s draft property', async () => {
    const bob = await asUser('bob');
    const { data } = await bob
      .from('properties')
      .select('id')
      .eq('id', IDS.aliceCottage);
    expect(data).toHaveLength(0);
  });

  it('Anonymous can read Alice\'s listed property', async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .from('properties')
      .select('id')
      .eq('id', IDS.grandBay);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('Anonymous cannot read Alice\'s draft property', async () => {
    const anon = anonClient();
    const { data } = await anon
      .from('properties')
      .select('id')
      .eq('id', IDS.aliceCottage);
    expect(data).toHaveLength(0);
  });
});

describe('RLS: bookings', () => {
  it('George can read George\'s booking', async () => {
    const george = await asUser('george');
    const { data, error } = await george
      .from('bookings')
      .select('id, total_amount_minor')
      .eq('id', IDS.booking1);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('Grace cannot read George\'s booking', async () => {
    const grace = await asUser('grace');
    const { data } = await grace
      .from('bookings')
      .select('id')
      .eq('id', IDS.booking1);
    expect(data).toHaveLength(0);
  });

  it('George cannot alter booking total_amount_minor', async () => {
    const george = await asUser('george');
    const { error } = await george
      .from('bookings')
      .update({ total_amount_minor: 1 })
      .eq('id', IDS.booking1);
    expect(error).not.toBeNull();
  });

  it('George cannot alter booking status', async () => {
    const george = await asUser('george');
    const { error } = await george
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', IDS.booking1);
    expect(error).not.toBeNull();
  });

  it('Alice cannot alter booking total_amount_minor directly', async () => {
    const alice = await asUser('alice');
    const { error } = await alice
      .from('bookings')
      .update({ total_amount_minor: 1 })
      .eq('id', IDS.booking1);
    expect(error).not.toBeNull();
  });
});

describe('RLS: profiles / self-elevation', () => {
  it('Hannah cannot change her own kyc_status', async () => {
    const hannah = await asUser('hannah');
    const { error } = await hannah
      .from('profiles')
      .update({ kyc_status: 'verified' })
      .eq('id', IDS.hannah);
    expect(error).not.toBeNull();
  });

  it('Hannah cannot change her role', async () => {
    const hannah = await asUser('hannah');
    const { error } = await hannah
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', IDS.hannah);
    expect(error).not.toBeNull();
  });

  it('Hannah cannot make herself admin', async () => {
    const hannah = await asUser('hannah');
    const { error } = await hannah
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', IDS.hannah);
    expect(error).not.toBeNull();
  });
});

describe('RLS: property sensitive fields', () => {
  it('Alice cannot modify vision_analysis directly', async () => {
    const alice = await asUser('alice');
    const { error } = await alice
      .from('properties')
      .update({ vision_analysis: { hacker: true } })
      .eq('id', IDS.aliceCottage);
    expect(error).not.toBeNull();
  });

  it('Alice cannot assign an arbitrary host directly', async () => {
    const alice = await asUser('alice');
    const { error } = await alice
      .from('properties')
      .update({ assigned_host_id: IDS.hannah })
      .eq('id', IDS.aliceCottage);
    expect(error).not.toBeNull();
  });
});

describe('RLS: host applications', () => {
  const APP_ID = '40000000-0000-0000-0000-0000000000aa';

  afterAll(async () => {
    await serviceClient().from('host_applications').delete().eq('id', APP_ID);
  });

  it('Hannah cannot insert an application before KYC verification', async () => {
    const service = serviceClient();
    const { error: demoteErr } = await service
      .from('profiles')
      .update({ kyc_status: 'none', kyc_verified_at: null })
      .eq('id', IDS.hannah);
    expect(demoteErr).toBeNull();

    const hannah = await asUser('hannah');
    const { error } = await hannah.from('host_applications').insert({
      property_id: IDS.grandBay,
      host_id: IDS.hannah,
      proposed_fee_pct: 12,
      pitch_text: 'Before-KYC attempt',
    });
    expect(error).not.toBeNull();

    const { error: restoreErr } = await service
      .from('profiles')
      .update({ kyc_status: 'verified', kyc_verified_at: '2026-01-01T00:00:00Z' })
      .eq('id', IDS.hannah);
    expect(restoreErr).toBeNull();
  });

  it('Hannah can insert an application after verification', async () => {
    const hannah = await asUser('hannah');
    const { data, error } = await hannah
      .from('host_applications')
      .insert({
        id: APP_ID,
        property_id: IDS.aliceCottage,
        host_id: IDS.hannah,
        proposed_fee_pct: 12,
        pitch_text: 'Verified host application',
      })
      .select('id');

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('Hannah cannot set ai_match_score herself', async () => {
    const hannah = await asUser('hannah');
    const { error } = await hannah.from('host_applications').insert({
      property_id: IDS.grandBay,
      host_id: IDS.hannah,
      proposed_fee_pct: 12,
      pitch_text: 'Attempt to inject AI score',
      ai_match_score: 99,
    });
    expect(error).not.toBeNull();
  });

  it('Alice can see applications to her property', async () => {
    const alice = await asUser('alice');
    const { data, error } = await alice
      .from('host_applications')
      .select('id')
      .eq('property_id', IDS.aliceCottage);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it('Bob cannot see applications to Alice\'s private property', async () => {
    const bob = await asUser('bob');
    const { data } = await bob
      .from('host_applications')
      .select('id')
      .eq('property_id', IDS.aliceCottage);
    expect(data).toHaveLength(0);
  });
});

describe('RLS: payouts', () => {
  it('Guest cannot read payout', async () => {
    const george = await asUser('george');
    const { data } = await george
      .from('payouts')
      .select('id')
      .eq('id', '30000000-0000-0000-0000-000000000001');
    expect(data).toHaveLength(0);
  });

  it('Owner can read their payout', async () => {
    const sarah = await asUser('sarah');
    const { data, error } = await sarah
      .from('payouts')
      .select('id')
      .eq('id', '30000000-0000-0000-0000-000000000001');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('Host can read their payout', async () => {
    const elena = await asUser('elena');
    const { data, error } = await elena
      .from('payouts')
      .select('id')
      .eq('id', '30000000-0000-0000-0000-000000000001');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('Neither can alter payout values', async () => {
    const sarah = await asUser('sarah');
    const { error } = await sarah
      .from('payouts')
      .update({ owner_amount_minor: 1 })
      .eq('id', '30000000-0000-0000-0000-000000000001');
    expect(error).not.toBeNull();
  });
});

describe('RLS: disputes', () => {
  it('Dispute party can see dispute', async () => {
    const sarah = await asUser('sarah');
    const { data, error } = await sarah
      .from('disputes')
      .select('id')
      .eq('id', '50000000-0000-0000-0000-000000000001');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('Unrelated user cannot see dispute', async () => {
    const alice = await asUser('alice');
    const { data } = await alice
      .from('disputes')
      .select('id')
      .eq('id', '50000000-0000-0000-0000-000000000001');
    expect(data).toHaveLength(0);
  });

  it('Claimant cannot alter ai_assessment', async () => {
    const sarah = await asUser('sarah');
    const { error } = await sarah
      .from('disputes')
      .update({ ai_assessment: { hacked: true } })
      .eq('id', '50000000-0000-0000-0000-000000000001');
    expect(error).not.toBeNull();
  });

  it('Respondent cannot set admin_award_claimant_minor', async () => {
    const elena = await asUser('elena');
    const { error } = await elena
      .from('disputes')
      .update({ admin_award_claimant_minor: 999 })
      .eq('id', '50000000-0000-0000-0000-000000000001');
    expect(error).not.toBeNull();
  });
});

describe('RLS: privileged / machine-only tables', () => {
  it('Ordinary users cannot read processed_webhook_events', async () => {
    const alice = await asUser('alice');
    const { data, error } = await alice
      .from('processed_webhook_events')
      .select('*')
      .limit(1);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('Ordinary users cannot write audit_logs', async () => {
    const alice = await asUser('alice');
    const { error } = await alice
      .from('audit_logs')
      .insert({
        actor_id: IDS.alice,
        action: 'HACKER',
        entity_type: 'profile',
        entity_id: IDS.alice,
        metadata: {},
      });
    expect(error).not.toBeNull();
  });

  it('Ordinary users cannot alter platform_settings', async () => {
    const alice = await asUser('alice');
    const { data } = await alice
      .from('platform_settings')
      .select('*');
    expect(data).toHaveLength(0);

    const { error } = await alice
      .from('platform_settings')
      .update({ value: '{}' })
      .eq('key', 'test');
    expect(error).not.toBeNull();
  });
});