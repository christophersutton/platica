import { type Hub, type UiHub } from "@models/hub
";

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
  | { type: "SET_CHANNELS_LOADING" }
  | {
      type: "SET_CHANNELS";
      payload: { hubs: Hub[]; workspaceId: number };
    }
  | { type: "SET_CHANNELS_ERROR"; payload: Error }
  | { type: "UPDATE_CHANNEL"; payload: Partial<Hub> & { id: number } }
  | {
      type: "SET_CHANNEL_UPDATING";
      payload: { hubId: number; updating: boolean };
    }
  | {
      type: "SET_CHANNEL_UPDATE_ERROR";
      payload: { hubId: number; error: Error | null };
    }
  | { type: "ADD_CHANNEL"; payload: Hub }
  | { type: "SET_CREATING_CHANNEL" }
  | { type: "SET_CREATING_CHANNEL_ERROR"; payload: Error }
  | { type: "SET_ACTIVE_CHANNEL"; payload: number | null }
  | { type: "MARK_CHANNEL_READ"; payload: number }
  | {
      type: "UPDATE_UNREAD_COUNT";
      payload: { hubId: number; count: number };
    }
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
    case "SET_CHANNELS_LOADING":
      return {
        ...state,
        loading: { ...state.loading, hubs: true },
        errors: { ...state.errors, hubs: null },
      };

    case "SET_CHANNELS": {
      const { hubs, workspaceId } = action.payload;

      const byId = { ...state.byId };
      const hubIds = new Set<number>();

      hubs.forEach((hub
) => {
        byId[hub
.id] = {
          ...toUiHub(hub
),
          ...byId[hub
.id], // Preserve existing UI state if any
        };
        hubIds.add(hub
.id);
      });

      const newState = {
        ...state,
        byId,
        allIds: [...new Set([...state.allIds, ...hubIds])],
        workspaceHubs: {
          ...state.workspaceHubs,
          [workspaceId]: Array.from(hubIds),
        },
        loading: { ...state.loading, hubs: false },
        errors: { ...state.errors, hubs: null },
      };

      return newState;
    }

    case "SET_CHANNELS_ERROR":
      return {
        ...state,
        loading: { ...state.loading, hubs: false },
        errors: { ...state.errors, hubs: action.payload },
      };

    case "UPDATE_CHANNEL": {
      const hub
 = state.byId[action.payload.id];
      if (!hub
) return state;

      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.id]: {
            ...hub
,
            ...action.payload,
          },
        },
      };
    }

    case "SET_CHANNEL_UPDATING":
      return {
        ...state,
        loading: {
          ...state.loading,
          updating: {
            ...state.loading.updating,
            [action.payload.hubId]: action.payload.updating,
          },
        },
      };

    case "SET_CHANNEL_UPDATE_ERROR":
      return {
        ...state,
        errors: {
          ...state.errors,
          updating: {
            ...state.errors.updating,
            [action.payload.hubId]: action.payload.error,
          },
        },
      };

    case "ADD_CHANNEL":
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.id]: toUiHub(action.payload),
        },
        allIds: [...state.allIds, action.payload.id],
        workspaceHubs: {
          ...state.workspaceHubs,
          [action.payload.workspaceId]: [
            ...(state.workspaceHubs[action.payload.workspaceId] || []),
            action.payload.id,
          ],
        },
        loading: { ...state.loading, creating: false },
        errors: { ...state.errors, creating: null },
      };

    case "SET_CREATING_CHANNEL":
      return {
        ...state,
        loading: { ...state.loading, creating: true },
        errors: { ...state.errors, creating: null },
      };

    case "SET_CREATING_CHANNEL_ERROR":
      return {
        ...state,
        loading: { ...state.loading, creating: false },
        errors: { ...state.errors, creating: action.payload },
      };

    case "SET_ACTIVE_CHANNEL":
      return {
        ...state,
        activeHubId: action.payload,
      };

    case "MARK_CHANNEL_READ": {
      const hub
 = state.byId[action.payload];
      if (!hub
) return state;

      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload]: { ...hub
, unreadCount: 0 },
        },
      };
    }

    case "UPDATE_UNREAD_COUNT": {
      const hub
 = state.byId[action.payload.hubId];
      if (!hub
) return state;

      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.hubId]: {
            ...hub
,
            unreadCount: action.payload.count,
          },
        },
      };
    }

    case "SET_USER_TYPING": {
      const { hubId, userId, isTyping } = action.payload;
      const now = Date.now();
      const hubTyping = state.typing.byHub[hubId] || {
        userIds: [],
        lastUpdated: {},
      };

      // If user is typing, add them to the list if not already there
      // If user stopped typing, remove them from the list
      const userIds = isTyping
        ? [...new Set([...hubTyping.userIds, userId])]
        : hubTyping.userIds.filter((id) => id !== userId);

      return {
        ...state,
        typing: {
          ...state.typing,
          byHub: {
            ...state.typing.byHub,
            [hubId]: {
              userIds,
              lastUpdated: {
                ...hubTyping.lastUpdated,
                [userId]: now,
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
