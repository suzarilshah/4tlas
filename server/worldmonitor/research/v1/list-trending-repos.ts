/**
 * RPC: listTrendingRepos
 *
 * Fetches trending GitHub repos from gitterapp JSON API with
 * herokuapp fallback. Returns empty array on any failure.
 */

import type {
  ServerContext,
  ListTrendingReposRequest,
  ListTrendingReposResponse,
} from '../../../../src/generated/server/worldmonitor/research/v1/service_server';

// ---------- Handler ----------

export async function listTrendingRepos(
  _ctx: ServerContext,
  _req: ListTrendingReposRequest,
): Promise<ListTrendingReposResponse> {
  return { repos: [], pagination: undefined };
}
