import { useEffect, useState } from 'react';
import '../styles.css';
import { CHAPTERS, COPY, STEPS } from './copy';
import { PREVIEW } from './explain';
import { ProofStage } from './proof-stage';
import { StepDetail } from './step-detail';
import { runFoundationDemo, tryAsBusinessB, type BusinessBProof, type DemoStepResult } from './run-demo';

export function DemoApp() {
  const [results, setResults] = useState<DemoStepResult[]>([]);
  const [running, setRunning] = useState(false);
  const [asB, setAsB] = useState(false);
  const [proof, setProof] = useState<BusinessBProof | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function ping() {
      try {
        const response = await fetch('/health');
        const body = (await response.json()) as { ok?: boolean; database?: string };
        if (!cancelled) {
          setLive(response.ok && body.ok === true && body.database === 'up');
        }
      } catch {
        if (!cancelled) {
          setLive(false);
        }
      }
    }
    void ping();
    const timer = setInterval(() => void ping(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

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

  async function enterAsB() {
    setAsB(true);
    setError(null);
    try {
      setProof(await tryAsBusinessB());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : COPY.stopped);
    } finally {
      setAsB(false);
    }
  }

  const passed = results.filter((item) => item.ok).length;
  const done = !running && results.length > 0 && !error;
  const busy = running || asB;

  return (
    <main className="page">
      <header className="hero">
        <div className="hero-top">
          <p className="eyebrow">{COPY.brand}</p>
          <p className={`live ${live ? 'on' : live === false ? 'off' : ''}`}>
            <span />
            {live ? COPY.liveOn : live === false ? COPY.liveOff : '…'}
          </p>
        </div>
        <h1>{COPY.title}</h1>
        <p className="lede">{COPY.lede}</p>
        <div className="actions">
          <button type="button" onClick={() => void start()} disabled={busy}>
            {running ? COPY.running : COPY.run}
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={() => void enterAsB()}>
            {asB ? COPY.beBRunning : COPY.beB}
          </button>
          <a className="secondary" href={PREVIEW.editor} target="_blank" rel="noreferrer">
            {COPY.tables}
          </a>
          <a className="look" href={PREVIEW.look} target="_blank" rel="noreferrer">
            {COPY.look}
          </a>
          {done ? <p className="score">{COPY.score(passed, STEPS.length)}</p> : null}
        </div>
        {error ? <p className="error">{error}</p> : null}
      </header>

      <section className="layout">
        <ol className="chapters">
          {CHAPTERS.map((chapter) => (
            <li key={chapter.title} className="chapter">
              <h2>{chapter.title}</h2>
              <ol>
                {chapter.ids.map((id) => {
                  const step = STEPS.find((item) => item.id === id);
                  const result = results.find((item) => item.id === id);
                  const index = STEPS.findIndex((item) => item.id === id);
                  const active = running && results.length === index;
                  return (
                    <li key={id} className={tone(result, active)}>
                      <div>
                        <h3>{step?.title}</h3>
                        {result ? <p>{result.story}</p> : null}
                        <StepDetail
                          id={id}
                          {...(result ? { result } : {})}
                          {...(id === 'whatsapp' && result?.session
                            ? { extra: `מזהה מלא לחיפוש בטבלאות Docker: ${result.session.id}` }
                            : {})}
                        />
                      </div>
                      <strong>{label(result, active)}</strong>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
        <ProofStage results={results} proof={proof} />
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
