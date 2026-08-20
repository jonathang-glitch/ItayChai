import { useEffect, useState } from 'react';

type Health = { ok: boolean; database?: string };

export function StatusPanel(props: { title: string; healthUrl?: string }) {
  const healthUrl = props.healthUrl ?? '/health';
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(healthUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return (await response.json()) as Health;
      })
      .then(setHealth)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'health check failed');
      });
  }, [healthUrl]);

  return (
    <main>
      <h1>{props.title}</h1>
      {error ? <p>API unreachable: {error}</p> : null}
      {health ? (
        <p>
          API {health.ok ? 'up' : 'down'}; database {health.database ?? 'unknown'}
        </p>
      ) : null}
      {!health && !error ? <p>Checking API…</p> : null}
    </main>
  );
}
