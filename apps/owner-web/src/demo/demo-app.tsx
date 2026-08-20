import { useState } from 'react';
import { COPY, STEPS } from './copy';
import { runFoundationDemo, type DemoStepResult } from './run-demo';

export function DemoApp() {
  const [results, setResults] = useState<DemoStepResult[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const whatsapp = results.find((item) => item.id === 'whatsapp' && item.ok);
  const eventOk = results.find((item) => item.id === 'event' && item.ok);
  const dlqOk = results.find((item) => item.id === 'dlq' && item.ok);
  const replayOk = results.find((item) => item.id === 'replay' && item.ok);

  async function start() {
    setRunning(true);
    setError(null);
    setResults([]);
    try {
      await runFoundationDemo((result) => {
        setResults((current) => [...current.filter((item) => item.id !== result.id), result]);
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : COPY.stopped);
    } finally {
      setRunning(false);
    }
  }

  const passed = results.filter((item) => item.ok).length;
  const done = !running && results.length > 0 && !error;

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">איתי חי</p>
        <h1>{COPY.title}</h1>
        <p className="lede">{COPY.lede}</p>
        <div className="actions">
          <button type="button" onClick={() => void start()} disabled={running}>
            {running ? COPY.running : COPY.run}
          </button>
          {done ? <p className="score">{COPY.score(passed, STEPS.length)}</p> : null}
        </div>
        {error ? <p className="error">{error}</p> : null}
      </header>

      <section className="layout">
        <ol className="steps">
          {STEPS.map((step, index) => {
            const result = results.find((item) => item.id === step.id);
            return (
              <li key={step.id} className={tone(result, running && results.length === index)}>
                <span className="index">{index + 1}</span>
                <div>
                  <h2>{step.title}</h2>
                  {result ? <p>{result.story}</p> : null}
                  {result ? <p className="evidence">{result.evidence}</p> : null}
                </div>
                <strong>{label(result, running && results.length === index)}</strong>
              </li>
            );
          })}
        </ol>

        <aside className="stage">
          <h2>{COPY.customerSees}</h2>
          {whatsapp ? (
            <div className="chat">
              <p className="bubble in">{COPY.inbound}</p>
              <p className="bubble out">{COPY.outbound}</p>
              <p className="caption">
                {COPY.job(whatsapp.session?.id.slice(0, 8) ?? '', COPY.completed)}
              </p>
            </div>
          ) : (
            <p className="caption">{COPY.chatWaiting}</p>
          )}
          <div className="tenants">
            <article>
              <h3>{COPY.businessA}</h3>
              <p>{tenantLine(results, 'A')}</p>
            </article>
            <article>
              <h3>{COPY.businessB}</h3>
              <p>{tenantLine(results, 'B')}</p>
            </article>
          </div>
          <div className="tenants reliability">
            <article>
              <h3>אמינות</h3>
              <p>
                {eventOk ? COPY.eventOne : COPY.reliabilityWaiting}
                {dlqOk ? ` · ${COPY.failureVisible}` : ''}
                {replayOk ? ` · ${COPY.replayed}` : ''}
              </p>
            </article>
          </div>
        </aside>
      </section>
    </main>
  );
}

function tone(result: DemoStepResult | undefined, active: boolean) {
  if (result?.ok) {
    return 'step pass';
  }
  if (result && !result.ok) {
    return 'step fail';
  }
  return active ? 'step active' : 'step';
}

function label(result: DemoStepResult | undefined, active: boolean) {
  if (result?.ok) {
    return COPY.passed;
  }
  if (result && !result.ok) {
    return COPY.failed;
  }
  return active ? COPY.runningStep : COPY.waiting;
}

function tenantLine(results: DemoStepResult[], side: 'A' | 'B') {
  const read = results.find((item) => item.id === 'isolation-read');
  if (!read) {
    return COPY.tenantWaiting;
  }
  return side === 'A' ? COPY.tenantA : COPY.tenantB;
}
