import { type Hub, type UiHub } from "@models/hub";

// Helper to convert Hub to UiHub
function toUiHub(hub
: Hub): UiHub {
  return {
    ...hub
,
    memberCount: 0,
    messageCount: 0,
    lastMessageAt: null,
    unreadCount: 0,
    unreadMentions: 0,
    memberStatus: null,
  };
}

// Normalized state structure
export interface HubState {
  byId: Record<number, UiHub>;
  allIds: number[];
  workspaceHubs: Record<number, number[]>; // workspaceId -> hubIds
  activeHubId: number | null;
  loading: {
    hubs: boolean;
    creating: boolean;
    updating: Record<number, boolean>;
  };
  errors: {
    hubs: Error | null;
    creating: Error | null;
    updating: Record<number, Error | null>;
  };
  // Typing state
  typing: {
    byHub: Record<
      number,
      {
        userIds: number[];
        lastUpdated: Record<number, number>; // userId -> timestamp
      }
    >;
  };
}

// Action types
export type HubAction =
  | { type: "SET_HUBS_LOADING" }
  | { type: "SET_HUBS"; payload: { hubs: UiHub[]; workspaceId: number } }
  | { type: "SET_HUBS_ERROR"; payload: Error }
  | { type: "SET_CREATING_HUB" }
  | { type: "ADD_HUB"; payload: UiHub }
  | { type: "SET_CREATING_HUB_ERROR"; payload: Error }
  | { type: "MARK_HUB_READ"; payload: number }
  | { type: "SET_ACTIVE_HUB"; payload: number | null }
  | {
      type: "SET_USER_TYPING";
      payload: { hubId: number; userId: number; isTyping: boolean };
    };

export function createInitialState(): HubState {
  return {
    byId: {},
    allIds: [],
    workspaceHubs: {},
    activeHubId: null,
    loading: {
      hubs: false,
      creating: false,
      updating: {},
    },
    errors: {
      hubs: null,
      creating: null,
      updating: {},
    },
    typing: {
      byHub: {},
    },
  };
}

export function hubReducer(
  state: HubState,
  action: HubAction
): HubState {
  switch (action.type) {
    case "SET_HUBS_LOADING":
      return {
        ...state,
        loading: { ...state.loading, hubs: true },
        errors: { ...state.errors, hubs: null },
      };

    case "SET_HUBS":
      return {
        ...state,
        loading: { ...state.loading, hubs: false },
        errors: { ...state.errors, hubs: null },
        byId: {
          ...state.byId,
          ...action.payload.hubs.reduce(
            (acc, hub) => ({ ...acc, [hub.id]: hub }),
            {}
          ),
        },
        allIds: Array.from(
          new Set([...state.allIds, ...action.payload.hubs.map((h) => h.id)])
        ),
        workspaceHubs: {
          ...state.workspaceHubs,
          [action.payload.workspaceId]: action.payload.hubs.map((h) => h.id),
        },
      };

    case "SET_HUBS_ERROR":
      return {
        ...state,
        loading: { ...state.loading, hubs: false },
        errors: { ...state.errors, hubs: action.payload },
      };

    case "SET_CREATING_HUB":
      return {
        ...state,
        loading: { ...state.loading, creating: true },
        errors: { ...state.errors, creating: null },
      };

    case "ADD_HUB":
      return {
        ...state,
        loading: { ...state.loading, creating: false },
        errors: { ...state.errors, creating: null },
        byId: { ...state.byId, [action.payload.id]: action.payload },
        allIds: Array.from(new Set([...state.allIds, action.payload.id])),
        workspaceHubs: {
          ...state.workspaceHubs,
          [action.payload.workspaceId]: [
            ...(state.workspaceHubs[action.payload.workspaceId] || []),
            action.payload.id,
          ],
        },
      };

    case "SET_CREATING_HUB_ERROR":
      return {
        ...state,
        loading: { ...state.loading, creating: false },
        errors: { ...state.errors, creating: action.payload },
      };

    case "MARK_HUB_READ":
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload]: {
            ...state.byId[action.payload],
            unreadCount: 0,
          },
        },
      };

    case "SET_ACTIVE_HUB":
      return {
        ...state,
        activeHubId: action.payload,
      };

    case "SET_USER_TYPING": {
      const { hubId, userId, isTyping } = action.payload;
      const hubTyping = state.typing.byHub[hubId] || {
        userIds: [],
        lastUpdated: {},
      };

      return {
        ...state,
        typing: {
          ...state.typing,
          byHub: {
            ...state.typing.byHub,
            [hubId]: {
              userIds: isTyping
                ? Array.from(new Set([...hubTyping.userIds, userId]))
                : hubTyping.userIds.filter((id) => id !== userId),
              lastUpdated: {
                ...hubTyping.lastUpdated,
                [userId]: Date.now(),
              },
            },
          },
        },
      };
    }

    default:
      return state;
  }
}
