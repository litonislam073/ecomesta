import type { PublicPlan } from '@ecomesta/types';
import { publicGet } from '@/lib/public-api';

/** Active plans for the marketing pages; null when the API has none or is unreachable. */
export async function loadPublicPlans(): Promise<PublicPlan[] | null> {
  try {
    const result = await publicGet<{ success: true; data: PublicPlan[] }>('/public/plans');
    return result.data.length > 0 ? result.data : null;
  } catch {
    return null;
  }
}
