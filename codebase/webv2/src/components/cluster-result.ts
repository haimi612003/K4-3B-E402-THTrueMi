import type { Result } from './ClusterResultView'

export function isClusterResult(value: unknown): value is Result {
  return !!value && typeof value === 'object' && 'clusters' in value &&
    Array.isArray(value.clusters) && value.clusters.every((cluster: unknown) =>
      !!cluster && typeof cluster === 'object' && 'name' in cluster &&
      typeof cluster.name === 'string' && 'turn_ids' in cluster &&
      Array.isArray(cluster.turn_ids))
}
