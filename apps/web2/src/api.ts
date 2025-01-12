import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { WebSocketsManager } from "./WebSocketsManager";
import { presenceUpdated } from "./store/presenceSlice";

// Shared types (adjust import paths as necessary)
import { User, Hub, Room, Message } from '../../../packages/shared/src/models';
import { UserPresence } from '../../../packages/shared/src/';

const baseQuery = fetchBaseQuery({ baseUrl: "/api" });

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["User", "Hub", "Room", "Message", "Presence"],
  endpoints: (builder) => ({
    // ---------------------------
    // AUTH EXAMPLE (login/logout)
    // ---------------------------
    login: builder.mutation<
      { token: string; user: User },
      { email: string; password: string }
    >({
      query: (credentials) => ({
        url: "auth/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: [],
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: "auth/logout",
        method: "POST",
      }),
      invalidatesTags: [],
    }),

    // ---------------------------
    // USERS
    // ---------------------------
    getUser: builder.query<User, string>({
      query: (userId) => `users/${userId}`,
      providesTags: (result, error, userId) => [{ type: "User", id: userId }],
    }),
    getAllUsers: builder.query<User[], void>({
      query: () => "users",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "User" as const, id })),
              { type: "User", id: "LIST" },
            ]
          : [{ type: "User", id: "LIST" }],
    }),

    // ---------------------------
    // Hubs
    // ---------------------------
    getHubs: builder.query<Hub[], void>({
      query: () => "hubs",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Hub" as const, id })),
              { type: "Hub", id: "LIST" },
            ]
          : [{ type: "Hub", id: "LIST" }],
    }),
    getHub: builder.query<Hub, string>({
      query: (hubId) => `hubs/${hubId}`,
      providesTags: (result, error, hubId) => [{ type: "Hub", id: hubId }],
    }),
    createHub: builder.mutation<Hub, Partial<Hub>>({
      query: (newHub) => ({
        url: "hubs",
        method: "POST",
        body: newHub,
      }),
      invalidatesTags: [{ type: "Hub", id: "LIST" }],
    }),

    // ---------------------------
    // Rooms
    // ---------------------------
    getRooms: builder.query<Room[], string>({
      query: (hubId) => `hubs/${hubId}/rooms`,
      providesTags: (result, error, hubId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Room" as const, id })),
              { type: "Room", id: `LIST-${hubId}` },
            ]
          : [{ type: "Room", id: `LIST-${hubId}` }],
    }),
    getRoom: builder.query<Room, string>({
      query: (roomId) => `rooms/${roomId}`,
      providesTags: (result, error, roomId) => [{ type: "Room", id: roomId }],
    }),
    createRoom: builder.mutation<Room, { hubId: string; data: Partial<Room> }>({
      query: ({ hubId, data }) => ({
        url: `hubs/${hubId}/rooms`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (result, error, { hubId }) => [
        { type: "Room", id: `LIST-${hubId}` },
      ],
    }),

    // ---------------------------
    // Messages (Per Hub)
    // Example: we fetch messages for a given hub, then subscribe to real-time
    // updates.
    // ---------------------------
    getHubMessages: builder.query<Message[], string>({
      query: (hubId) => `hubs/${hubId}/messages`,
      providesTags: (result, error, hubId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Message" as const, id })),
              { type: "Message", id: `LIST-${hubId}` },
            ]
          : [{ type: "Message", id: `LIST-${hubId}` }],
      async onCacheEntryAdded(
        hubId,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved }
      ) {
        // Wait for the initial fetch to complete
        await cacheDataLoaded;

        // Subscribe to WebSocket for new messages
        const ws = WebSocketsManager.getInstance("ws://localhost:3000/ws");
        const unsubscribeMsg = ws.subscribe("hub_message", (payload) => {
          // If the message is for this hub, add it to the cache
          if (payload.hubId === hubId) {
            updateCachedData((draft) => {
              draft.push(payload.newMessage);
            });
          }
        });

        // Cleanup
        await cacheEntryRemoved;
        unsubscribeMsg();
      },
    }),
    sendHubMessage: builder.mutation<
      Message,
      { hubId: string; content: string }
    >({
      query: ({ hubId, content }) => ({
        url: `hubs/${hubId}/messages`,
        method: "POST",
        body: { content },
      }),
      invalidatesTags: (result, error, { hubId }) => [
        { type: "Message", id: `LIST-${hubId}` },
      ],
    }),

    // ---------------------------
    // Presence subscription example
    // (To show how we might tie presence into RTK Query)
    // ---------------------------
    getInitialPresence: builder.query<UserPresence[], void>({
      query: () => "presence",
      providesTags: ["Presence"],
      async onCacheEntryAdded(
        arg,
        { cacheDataLoaded, cacheEntryRemoved, dispatch }
      ) {
        await cacheDataLoaded;
        const ws = WebSocketsManager.getInstance("ws://localhost:3000/ws");

        const unsubscribePresence = ws.subscribe("presence", (payload) => {
          // payload might be a PresenceEvent
          dispatch(presenceUpdated(payload));
        });

        await cacheEntryRemoved;
        unsubscribePresence();
      },
    }),
  }),
});

// Auto-generated React hooks
export const {
  // Auth
  useLoginMutation,
  useLogoutMutation,
  // Users
  useGetUserQuery,
  useGetAllUsersQuery,
  // Hubs
  useGetHubsQuery,
  useGetHubQuery,
  useCreateHubMutation,
  // Rooms
  useGetRoomsQuery,
  useGetRoomQuery,
  useCreateRoomMutation,
  // Messages
  useGetHubMessagesQuery,
  useSendHubMessageMutation,
  // Presence
  useGetInitialPresenceQuery,
} = api;
