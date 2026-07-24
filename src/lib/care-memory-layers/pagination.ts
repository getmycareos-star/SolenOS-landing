import { DEFAULT_PAGE_SIZE } from "./contract-constants";
import type { PaginatedResult } from "./types";

export function paginate<T>(
  items: T[],
  offset = 0,
  limit = DEFAULT_PAGE_SIZE,
): PaginatedResult<T> {
  const safeLimit = Math.max(1, limit);
  const safeOffset = Math.max(0, offset);
  const slice = items.slice(safeOffset, safeOffset + safeLimit);
  return {
    items: slice,
    total: items.length,
    offset: safeOffset,
    limit: safeLimit,
    has_more: safeOffset + slice.length < items.length,
  };
}

export function paginateByTimestamp<T extends { timestamp: string }>(
  items: T[],
  offset = 0,
  limit = DEFAULT_PAGE_SIZE,
): PaginatedResult<T> {
  const sorted = [...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return paginate(sorted, offset, limit);
}
