// Janela de tempo (em dias) que uma ocorrência aparece como "recente".
// Ocorrências mais antigas que isso somem das listagens, sem apagar o registro.
export const OCCURRENCE_RECENT_DAYS = 7;

/** ISO timestamp do início da janela de ocorrências recentes. */
export function occurrencesRecentCutoffIso(now: Date = new Date()): string {
  const cutoff = new Date(now.getTime() - OCCURRENCE_RECENT_DAYS * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}
