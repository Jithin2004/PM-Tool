import { AppProviders } from './app/providers';
import { ResolveRouter } from './app/router';

export default function App() {
  return (
    <AppProviders>
      <ResolveRouter />
    </AppProviders>
  );
}
