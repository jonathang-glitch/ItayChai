import { COPY } from './copy';
import { BusinessBDetail } from './step-detail';
import type { BusinessBProof, DemoStepResult } from './run-demo';

type Props = {
  results: DemoStepResult[];
  proof: BusinessBProof | null;
};

export function ProofStage({ results, proof }: Props) {
  const whatsapp = results.find((item) => item.id === 'whatsapp' && item.ok);
  const isolation = results.find((item) => item.id === 'isolation-read' && item.ok);
  const eventOk = results.find((item) => item.id === 'event' && item.ok);
  const dlqOk = results.find((item) => item.id === 'dlq' && item.ok);
  const replayOk = results.find((item) => item.id === 'replay' && item.ok);

  return (
    <aside className="stage">
      <p className="stage-kicker">{COPY.customerSees}</p>
      <div className="phone">
        <p className="phone-label">{COPY.phoneLabel}</p>
        {whatsapp ? (
          <div className="chat">
            <p className="bubble in">{COPY.inbound}</p>
            <p className="bubble out">{COPY.outbound}</p>
            <p className="caption">{COPY.job(whatsapp.session?.id.slice(0, 8) ?? '', COPY.completed)}</p>
          </div>
        ) : (
          <p className="caption muted">{COPY.chatWaiting}</p>
        )}
      </div>

      <div className="desks">
        <article className="desk">
          <h3>{COPY.deskA}</h3>
          <p>
            {proof
              ? COPY.aHasJobs(proof.aJobCount, proof.aJobId)
              : isolation
                ? COPY.tenantA
                : COPY.tenantWaiting}
          </p>
        </article>
        <article className={`desk ${proof?.blocked ? 'locked' : ''}`}>
          <h3>{COPY.deskB}</h3>
          {proof ? (
            <div className="lock-card">
              <strong className="stamp">{COPY.beBStamp}</strong>
              <p>{COPY.beBLocked}</p>
              <p>{COPY.beBOwnEmpty}</p>
              <p>{COPY.beBWrite}</p>
              <BusinessBDetail />
            </div>
          ) : (
            <p>{isolation ? COPY.tenantB : COPY.beBWaiting}</p>
          )}
        </article>
      </div>

      <div className="trust">
        <h3>אמינות</h3>
        <p>
          {eventOk ? COPY.eventOne : COPY.reliabilityWaiting}
          {dlqOk ? ` · ${COPY.failureVisible}` : ''}
          {replayOk ? ` · ${COPY.replayed}` : ''}
        </p>
      </div>
    </aside>
  );
}
