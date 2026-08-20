import { DemoApp } from './demo/demo-app';
import { ClientApp } from './client/client-app';

export function App() {
  if (window.location.pathname.startsWith('/demo')) {
    return <DemoApp />;
  }
  return <ClientApp />;
}
