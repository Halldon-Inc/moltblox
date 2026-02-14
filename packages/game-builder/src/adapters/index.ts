/**
 * Adapters
 *
 * Bridge wrappers that let external engines (OpenBOR WASM, etc.)
 * participate in the Moltblox BaseGame lifecycle.
 */

export { OpenBORAdapter, INPUT_MAP } from './OpenBORAdapter.js';
export type {
  OpenBORAdapterConfig,
  OpenBORBridgeLike,
  TickSnapshot,
  FighterSnapshot,
  MatchStateSnapshot,
} from './OpenBORAdapter.js';
