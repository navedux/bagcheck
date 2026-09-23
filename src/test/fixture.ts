import tokens from "../../data/snapshot/tokens.json";
import board from "../../data/snapshot/board.json";

/**
 * The public tree ships the sim fixtures empty. Tests that read them skip
 * until `pnpm refresh-snapshot` bakes them locally.
 */
export const HAS_SIM_FIXTURE =
  (tokens as unknown[]).length > 0 && (board as unknown[]).length > 0;
