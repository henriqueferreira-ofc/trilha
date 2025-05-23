
import { State, Action, actionTypes } from "./types";
import { reducer } from "./reducer";

export const listeners: Array<(state: State) => void> = [];

// Initial state
export let memoryState: State = { toasts: [] };

export function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

export { actionTypes };
