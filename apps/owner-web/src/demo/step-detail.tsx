import { B_EXPLAIN, EXPLAIN, type StepExplain } from './explain';
import type { DemoStepResult } from './run-demo';

export function StepDetail(props: {
  id: string;
  result?: DemoStepResult;
  extra?: string;
  explain?: StepExplain;
}) {
  const explain = props.explain ?? EXPLAIN[props.id];
  if (!explain) {
    return null;
  }
  return (
    <details className="explain" open={Boolean(props.result)}>
      <summary>מה בדיוק קרה, איפה זה נשמר, ואיך בודקים</summary>
      <p>
        <strong>מה השלב עשה. </strong>
        {explain.did}
      </p>
      <p>
        <strong>איפה זה נשמר במחשב. </strong>
        {explain.saved}
      </p>
      <p>
        <strong>איך מוכיחים לספקן. </strong>
        {explain.verify}
      </p>
      {props.result?.evidence ? (
        <p className="fact">
          <strong>מה יצא עכשיו. </strong>
          {props.result.evidence}
          {props.extra ? ` ${props.extra}` : ''}
        </p>
      ) : null}
      <p className="links">
        {explain.links.map((link) => (
          <a key={link.href + link.label} href={link.href} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
      </p>
    </details>
  );
}

export function BusinessBDetail() {
  return <StepDetail id="business-b" explain={B_EXPLAIN} />;
}
