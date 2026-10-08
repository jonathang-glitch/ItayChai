import { DemoApp } from './demo/demo-app';
import { ClientApp } from './client/client-app';
import { PickApp } from './pick/pick-app';

export function App() {
  if (window.location.pathname.startsWith('/demo')) {
    return <DemoApp />;
  }
  const pick = window.location.pathname.match(/^\/s\/([^/]+)/);
  if (pick?.[1]) {
    return <PickApp token={pick[1]} />;
  }
  return <ClientApp />;
}
