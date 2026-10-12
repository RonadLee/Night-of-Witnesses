import { GameStore, defaultDbPath } from './store';

export { GameStore } from './store';
export const store = new GameStore(defaultDbPath());
