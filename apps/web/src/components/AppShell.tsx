import { Provider } from 'react-redux';
import { store } from '../store/store';

/**
 * Example AppShell that includes some basic layout
 * and a place to show the various wireframe components.
 */
export function AppShell() {
  return (
    <Provider store={store}>
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <header className="bg-white shadow p-4">
          <h1 className="text-2xl font-bold">Platica</h1>
        </header>
        <main className="flex-1 p-4">
          {/* In a real app, you'd have React Router or similar
              to handle different views. For now, just a placeholder. */}
          <p>Welcome to Platica! This is the shell for our app.</p>
          <p>
            Use HubsList, HubView, RoomsList, RoomView, MessagesList,
            MessageInput, etc. as you navigate your UI.
          </p>
        </main>
      </div>
    </Provider>
  );
}