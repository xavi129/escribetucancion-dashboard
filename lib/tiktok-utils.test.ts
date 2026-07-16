// Property-Based Tests for TikTok Metric Calculations
// **Feature: tiktok-ads-integration**

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { convertCurrencyToMXN, getCurrencyToMXNRate } from './currency-utils'
import {
  calculateROI,
  calculateROAS,
  calculateCTR,
  calculateCPC,
  calculateCPM,
  calculateCPA,
  calculateProfit,
  calculateNetProfit,
  calculateBreakEvenROAS,
  calculateMaxProfitableCPA,
  calculateCostBreakdown,
  calculateROIData,
  buildCampaignDecisions,
  buildTikTokDecisionAlerts,
  DEFAULT_COST_CONFIG,
  sortCampaignsBySpend,
} from './tiktok-utils'

describe('TikTok Metric Calculations - Property Based Tests', () => {
  it('Converts supported order currencies to MXN before revenue aggregation', () => {
    expect(getCurrencyToMXNRate('MXN')).toBe(1)
    expect(convertCurrencyToMXN(100, 'USD')).toBeCloseTo(1720, 5)
    expect(convertCurrencyToMXN(50000, 'COP')).toBeCloseTo(220, 5)
    expect(convertCurrencyToMXN(1820, 'DOP')).toBeCloseTo(527.8, 5)
    expect(convertCurrencyToMXN(100, null)).toBe(100)
  })

  /**
   * **Feature: tiktok-ads-integration, Property 1: ROI Calculation Correctness**
   * For any revenue and ad spend values where ad spend > 0,
   * ROI SHALL equal ((revenue - adSpend) / adSpend) * 100.
   * **Validates: Requirements 2.2**
   */
  it('Property 1: ROI calculation is correct for any valid inputs', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: 1000000, noNaN: true }), // adSpend > 0
        (revenue, adSpend) => {
          const roi = calculateROI(revenue, adSpend)
          const expected = ((revenue - adSpend) / adSpend) * 100
          expect(roi).toBeCloseTo(expected, 5)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 1: ROI returns null when adSpend is 0', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        (revenue) => {
          const roi = calculateROI(revenue, 0)
          expect(roi).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: tiktok-ads-integration, Property 2: ROAS Calculation Correctness**
   * For any revenue and ad spend values where ad spend > 0,
   * ROAS SHALL equal revenue / adSpend.
   * **Validates: Requirements 2.3**
   */
  it('Property 2: ROAS calculation is correct for any valid inputs', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: 1000000, noNaN: true }), // adSpend > 0
        (revenue, adSpend) => {
          const roas = calculateROAS(revenue, adSpend)
          const expected = revenue / adSpend
          expect(roas).toBeCloseTo(expected, 5)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: tiktok-ads-integration, Property 3: CTR Calculation Correctness**
   * For any impressions and clicks values where impressions > 0,
   * CTR SHALL equal (clicks / impressions) * 100.
   * **Validates: Requirements 3.2**
   */
  it('Property 3: CTR calculation is correct for any valid inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        fc.integer({ min: 1, max: 10000000 }), // impressions > 0
        (clicks, impressions) => {
          const ctr = calculateCTR(clicks, impressions)
          const expected = (clicks / impressions) * 100
          expect(ctr).toBeCloseTo(expected, 5)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 3: CTR returns 0 when impressions is 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        (clicks) => {
          const ctr = calculateCTR(clicks, 0)
          expect(ctr).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: tiktok-ads-integration, Property 4: CPC Calculation Correctness**
   * For any spend and clicks values where clicks > 0,
   * CPC SHALL equal spend / clicks.
   * **Validates: Requirements 3.2**
   */
  it('Property 4: CPC calculation is correct for any valid inputs', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        fc.integer({ min: 1, max: 1000000 }), // clicks > 0
        (spend, clicks) => {
          const cpc = calculateCPC(spend, clicks)
          const expected = spend / clicks
          expect(cpc).toBeCloseTo(expected, 5)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: tiktok-ads-integration, Property 5: CPM Calculation Correctness**
   * For any spend and impressions values where impressions > 0,
   * CPM SHALL equal (spend / impressions) * 1000.
   * **Validates: Requirements 3.2**
   */
  it('Property 5: CPM calculation is correct for any valid inputs', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        fc.integer({ min: 1, max: 10000000 }), // impressions > 0
        (spend, impressions) => {
          const cpm = calculateCPM(spend, impressions)
          const expected = (spend / impressions) * 1000
          expect(cpm).toBeCloseTo(expected, 5)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: tiktok-ads-integration, Property 6: CPA Calculation Correctness**
   * For any spend and conversions values where conversions > 0,
   * CPA SHALL equal spend / conversions.
   * **Validates: Requirements 3.3**
   */
  it('Property 6: CPA calculation is correct for any valid inputs', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        fc.integer({ min: 1, max: 100000 }), // conversions > 0
        (spend, conversions) => {
          const cpa = calculateCPA(spend, conversions)
          const expected = spend / conversions
          expect(cpa).toBeCloseTo(expected, 5)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: tiktok-ads-integration, Property 10: Profit Calculation Correctness**
   * For any revenue and ad spend values, profit SHALL equal revenue - adSpend.
   * **Validates: Requirements 7.5**
   */
  it('Property 10: Profit calculation is correct for any inputs', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1000000, max: 1000000, noNaN: true }),
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        (revenue, adSpend) => {
          const profit = calculateProfit(revenue, adSpend)
          const expected = revenue - adSpend
          expect(profit).toBeCloseTo(expected, 5)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Net profitability subtracts ads and non-ad costs', () => {
    expect(calculateNetProfit(1000, 300, 250)).toBe(450)
    expect(calculateBreakEvenROAS(1000, 250)).toBeCloseTo(1.333333, 5)
    expect(calculateBreakEvenROAS(1000, 250, 16)).toBeCloseTo(1.546667, 5)
    expect(calculateBreakEvenROAS(0, 0)).toBeNull()
    expect(calculateBreakEvenROAS(1000, 1000)).toBeNull()
    expect(calculateMaxProfitableCPA(1000, 250, 5)).toBe(150)
    expect(calculateMaxProfitableCPA(1000, 250, 5, 16)).toBeCloseTo(129.310345, 5)
  })

  it('ROI thresholds exclude current ad tax and apply the ad tax rate proportionally', () => {
    const costConfig = {
      ...DEFAULT_COST_CONFIG,
      adTaxPercent: 16,
      otherCostPerOrder: 50,
    }
    const costs = calculateCostBreakdown(1000, 100, 5, 0, 0, costConfig)
    const roi = calculateROIData(1000, 100, undefined, undefined, 5, costs, costConfig)

    expect(costs.adTaxes).toBe(16)
    expect(costs.nonAdCosts).toBe(266)
    expect(roi.breakEvenRoas).toBeCloseTo(1.546667, 5)
    expect(roi.maxProfitableCpa).toBeCloseTo(129.310345, 5)
  })

  it('Keeps impossible break-even ROAS JSON-safe and preserves it in campaign decisions', () => {
    const costConfig = {
      ...DEFAULT_COST_CONFIG,
      productionCostPerOrder: 600,
    }
    const costs = calculateCostBreakdown(1000, 200, 2, 0, 0, costConfig)
    const roi = calculateROIData(1000, 200, undefined, undefined, 2, costs, costConfig)
    const serializedRoi = JSON.parse(JSON.stringify(roi))

    expect(roi.breakEvenRoas).toBeNull()
    expect(serializedRoi.breakEvenRoas).toBeNull()

    const decisions = buildCampaignDecisions([
      {
        campaignId: 'no-margin',
        campaignName: 'No margin campaign',
        status: 'ACTIVE',
        spend: 100,
        impressions: 1000,
        clicks: 100,
        ctr: 10,
        conversions: 2,
      },
    ], serializedRoi)

    expect(decisions[0].breakEvenRoas).toBeNull()
    expect(decisions[0].decision).not.toBe('scale')
  })

  it('Cost breakdown includes Stripe, production, video, fixed costs, and ad tax', () => {
    const costs = calculateCostBreakdown(
      1000,
      500,
      2,
      1,
      0,
      {
        ...DEFAULT_COST_CONFIG,
        paymentFeePercent: 4,
        paymentFixedFee: 3,
        productionCostPerOrder: 1.04,
        videoCostPerOrder: 0.18,
        fixedMonthlyCost: 240,
        adTaxPercent: 16,
      },
      60
    )

    expect(costs.paymentFees).toBeCloseTo(46, 5)
    expect(costs.productionCosts).toBeCloseTo(2.08, 5)
    expect(costs.videoCosts).toBeCloseTo(0.18, 5)
    expect(costs.fixedMonthlyCosts).toBe(60)
    expect(costs.adTaxes).toBe(80)
    expect(costs.nonAdCosts).toBeCloseTo(188.26, 5)
    expect(costs.totalCosts).toBeCloseTo(688.26, 5)
  })

  it('Campaign decisions flag scalable and pause candidates', () => {
    const costConfig = {
      ...DEFAULT_COST_CONFIG,
      productionCostPerOrder: 100,
    }
    const costs = calculateCostBreakdown(3000, 700, 3, 0, 0, costConfig)
    const roi = calculateROIData(3000, 700, undefined, undefined, 3, costs, costConfig)
    const decisions = buildCampaignDecisions([
      {
        campaignId: 'scale',
        campaignName: 'Winner',
        status: 'ACTIVE',
        spend: 500,
        impressions: 1000,
        clicks: 100,
        ctr: 10,
        conversions: 3,
      },
      {
        campaignId: 'pause',
        campaignName: 'No sales',
        status: 'ACTIVE',
        spend: 1000,
        impressions: 1000,
        clicks: 80,
        ctr: 8,
        conversions: 0,
      },
    ], roi)

    expect(decisions.find(campaign => campaign.campaignId === 'scale')?.decision).toBe('scale')
    expect(decisions.find(campaign => campaign.campaignId === 'pause')?.decision).toBe('pause')
  })

  it('Decision alerts include net loss warnings', () => {
    const costs = calculateCostBreakdown(500, 700, 1, 0, 0, DEFAULT_COST_CONFIG)
    const roi = calculateROIData(500, 700, undefined, undefined, 1, costs, DEFAULT_COST_CONFIG)
    const alerts = buildTikTokDecisionAlerts(
      {
        spend: 700,
        impressions: 1000,
        clicks: 50,
        ctr: 5,
        cpc: 14,
        cpm: 700,
        conversions: 1,
        cpa: 700,
      },
      roi,
      []
    )

    expect(alerts.some(alert => alert.id === 'net-loss')).toBe(true)
  })

  /**
   * **Feature: tiktok-ads-integration, Property 8: Campaign Sort Order Correctness**
   * For any list of campaigns, the default display order SHALL be sorted by spend in descending order.
   * **Validates: Requirements 6.3**
   */
  it('Property 8: Campaigns are sorted by spend in descending order', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            campaignId: fc.string(),
            campaignName: fc.string(),
            spend: fc.float({ min: 0, max: 1000000, noNaN: true }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (campaigns) => {
          const sorted = sortCampaignsBySpend(campaigns)
          
          // Verify descending order
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].spend).toBeGreaterThanOrEqual(sorted[i + 1].spend)
          }
          
          // Verify same length (no items lost)
          expect(sorted.length).toBe(campaigns.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})
