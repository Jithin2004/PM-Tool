import { supabase } from '../lib/supabase';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: number | null;
  hasMore: boolean;
  totalCount?: number;
}

export interface PaginationParams {
  table: string;
  pageSize?: number;
  cursor?: number; // 0-indexed offset
  filters?: Record<string, any>;
  searchColumn?: string;
  searchQuery?: string;
  orderBy?: { column: string; ascending?: boolean };
  select?: string;
}

/**
 * Reusable utility to fetch paginated data from Supabase, removing arbitrary `.limit(50)` bounds.
 */
export async function fetchPaginated<T>(params: PaginationParams): Promise<PaginatedResult<T>> {
  const {
    table,
    pageSize = 20,
    cursor = 0,
    filters = {},
    searchColumn,
    searchQuery,
    orderBy,
    select = '*'
  } = params;

  let query = supabase.from(table).select(select, { count: 'exact' });

  // Apply filters
  for (const [key, value] of Object.entries(filters)) {
    if (value === null) {
      query = query.is(key, null);
    } else if (Array.isArray(value)) {
      query = query.in(key, value);
    } else if (typeof value === 'object' && value.neq !== undefined) {
      query = query.neq(key, value.neq);
    } else {
      query = query.eq(key, value);
    }
  }

  // Apply search
  if (searchColumn && searchQuery) {
    query = query.ilike(searchColumn, `%${searchQuery}%`);
  }

  // Apply ordering
  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Apply pagination range
  const from = cursor;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error(`[fetchPaginated] Error fetching from ${table}:`, error);
    return { data: [], nextCursor: null, hasMore: false, totalCount: 0 };
  }

  const resultData = (data as unknown as T[]) || [];
  const hasMore = resultData.length === pageSize && (count === null || to + 1 < count);
  const nextCursor = hasMore ? to + 1 : null;

  return {
    data: resultData,
    nextCursor,
    hasMore,
    totalCount: count || undefined
  };
}
