/**
 * HandTile — wraps a server TileDTO with a stable client-side UUID.
 *
 * @dnd-kit/sortable needs stable IDs across renders to track items
 * through reorders. Tile color+number isn't unique (a hand can hold two
 * red 5s) so we mint a UUID per tile when the hand is loaded.
 */
import { type TileDTO } from "./api";

export interface HandTile {
  id: string;
  tile: TileDTO;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tile-${Math.random().toString(36).slice(2, 11)}-${Date.now()}`;
}

export function wrapHand(tiles: TileDTO[]): HandTile[] {
  return tiles.map((t) => ({ id: newId(), tile: t }));
}

export function unwrapHand(hand: HandTile[]): TileDTO[] {
  return hand.map((h) => h.tile);
}
