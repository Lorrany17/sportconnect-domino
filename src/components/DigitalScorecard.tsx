"use client";

import RefereePanel, { RefereePanelProps } from "./RefereePanel";

/**
 * DigitalScorecard Component (Súmula Digital)
 * Alias/Re-export do RefereePanel para suportar convenções de nomenclatura de súmula digital.
 */
export const DigitalScorecard = RefereePanel;
export type DigitalScorecardProps = RefereePanelProps;
export default DigitalScorecard;
