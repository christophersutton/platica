import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { WebSocketsManager } from "./WebSocketsManager";
import { presenceUpdated } from "./store/presenceSlice";
// Import the correct domain types from shared
import type { User } from "@platica/shared/src/models/user";
import type { ApiHub, ApiHubMember } from "@platica/shared/src/models/hub";
import type { ApiRoom } from "@platica/shared/src/models/room";
import type { ApiMessage } from "@platica/shared/src/models/message";
import { WSEventType, type UserPresence } from "@platica/shared/src/websockets";

// For demonstration, these are example domain types you might adjust
// if your server returns slightly different shapes. 
// If you have existing definitions for Hub, Room, Message, etc. that differ,
// reconcile them accordingly.

const baseQuery = fetchBaseQuery({ baseUrl: "/api" });

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["User", "Hub", "Room", "Message", "Presence", "HubMember"],
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
    getHubs: builder.query<ApiHub[], void>({
      query: () => "hubs",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Hub" as const, id })),
              { type: "Hub", id: "LIST" },
            ]
          : [{ type: "Hub", id: "LIST" }],
    }),
    getHub: builder.query<ApiHub, string>({
      query: (hubId) => `hubs/${hubId}`,
      providesTags: (result, error, hubId) => [{ type: "Hub", id: hubId }],
    }),
    createHub: builder.mutation<ApiHub, Partial<ApiHub>>({
      query: (newHub) => ({
        url: "hubs",
        method: "POST",
        body: newHub,
      }),
      invalidatesTags: [{ type: "Hub", id: "LIST" }],
    }),
    // NEW: getHubMembers query
    getHubMembers: builder.query<ApiHubMember[], string>({
      query: (hubId) => `hubs/${hubId}/members`,
      providesTags: (result, error, hubId) =>
        result
          ? [
              ...result.map(({ user }) => ({
                type: "HubMember" as const,
                id: `${hubId}-${user.id}`,
              })),
              { type: "HubMember", id: `LIST-${hubId}` },
            ]
          : [{ type: "HubMember", id: `LIST-${hubId}` }],
    }),

    // ---------------------------
    // Rooms
    // ---------------------------
    // Example: If your actual backend routes differ, adjust accordingly
    getRooms: builder.query<ApiRoom[], string>({
      query: (hubId) => `hubs/${hubId}/rooms`,
      providesTags: (result, error, hubId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Room" as const, id })),
              { type: "Room", id: `LIST-${hubId}` },
            ]
          : [{ type: "Room", id: `LIST-${hubId}` }],
    }),
    getRoom: builder.query<ApiRoom, string>({
      query: (roomId) => `rooms/${roomId}`,
      providesTags: (result, error, roomId) => [{ type: "Room", id: roomId }],
    }),
    createRoom: builder.mutation<ApiRoom, { hubId: string; data: Partial<ApiRoom> }>({
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
    // Messages (Per Hub or Room)
    // ---------------------------
    // If your actual routes differ, adapt as needed
    getHubMessages: builder.query<ApiMessage[], string>({
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

        // Example subscription usage:
        const ws = WebSocketsManager.getInstance("ws://localhost:3000/ws");
        const unsubscribeMsg = ws.subscribe("chat", (payload) => {
          // If the message is for this hub, add or handle it
          if (payload?.message?.hubId === Number(hubId)) {
            updateCachedData((draft) => {
              draft.push(payload.message);
            });
          }
        });

        // Cleanup
        await cacheEntryRemoved;
        unsubscribeMsg();
      },
    }),
    sendHubMessage: builder.mutation<
      ApiMessage,
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

    // Example: If you have a similar approach for room messages:
    getRoomMessages: builder.query<ApiMessage[], string>({
      query: (roomId) => `rooms/${roomId}/messages`,
      providesTags: (result, error, roomId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Message" as const, id })),
              { type: "Message", id: `ROOM-LIST-${roomId}` },
            ]
          : [{ type: "Message", id: `ROOM-LIST-${roomId}` }],
    }),
    sendRoomMessage: builder.mutation<
      ApiMessage,
      { roomId: string; content: string }
    >({
      query: ({ roomId, content }) => ({
        url: `rooms/${roomId}/messages`,
        method: "POST",
        body: { content },
      }),
      invalidatesTags: (result, error, { roomId }) => [
        { type: "Message", id: `ROOM-LIST-${roomId}` },
      ],
    }),

    // ---------------------------
    // Presence subscription example
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
          dispatch(presenceUpdated({ type: WSEventType.PRESENCE, payload }));
        });

        await cacheEntryRemoved;
        unsubscribePresence();
      },
    }),
  }),
});

// Export auto-generated hooks
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
  useGetHubMembersQuery,
  // Rooms
  useGetRoomsQuery,
  useGetRoomQuery,
  useCreateRoomMutation,
  // Send & fetch messages for Hubs or Rooms
  useGetHubMessagesQuery,
  useSendHubMessageMutation,
  useGetRoomMessagesQuery,
  useSendRoomMessageMutation,
  // Presence
  useGetInitialPresenceQuery,
} = api;