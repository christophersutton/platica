import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { WebSocketsManager } from "./WebSocketsManager";
import { presenceUpdated } from "./store/presenceSlice";
import type { User } from "@platica/shared/src/models/user";
import type { ApiHub, ApiHubMember } from "@platica/shared/src/models/hub";
import type { ApiRoom } from "@platica/shared/src/models/room";
import type { ApiMessage } from "@platica/shared/src/models/message";
import { WSEventType, type UserPresence } from "@platica/shared/src/websockets";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const baseQuery = fetchBaseQuery({ 
  baseUrl: API_URL,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  }
});

// Add response logging
const baseQueryWithLogging: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  console.log("Making request:", args);
  const result = await baseQuery(args, api, extraOptions);
  console.log("Got response:", result);
  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithLogging,
  tagTypes: [
    "User",
    "Hub",
    "Room",
    "Message",
    "Presence",
    "HubMember",
  ],
  endpoints: (builder) => ({
    // ---------------------------
    // AUTH (login/logout)
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
      onQueryStarted: async (_, { queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          localStorage.setItem('auth_token', data.token);
        } catch (error) {
          console.error('Failed to save auth token:', error);
        }
      },
      invalidatesTags: [],
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: "auth/logout",
        method: "POST",
      }),
      onQueryStarted: async () => {
        localStorage.removeItem('auth_token');
      },
      invalidatesTags: [],
    }),

    // NEW: requestMagicLink mutation
    requestMagicLink: builder.mutation<
      void,
      { email: string; workspaceId?: string }
    >({
      query: (body) => ({
        url: "auth/magic-link",
        method: "POST",
        body,
      }),
      invalidatesTags: [],
    }),

    // ---------------------------
    // USERS
    // ---------------------------
    getUser: builder.query<User, string>({
      query: (userId) => `users/${userId}`,
      providesTags: (result, error, userId) => [
        { type: "User", id: userId },
      ],
    }),
    getAllUsers: builder.query<User[], void>({
      query: () => "users",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({
                type: "User" as const,
                id,
              })),
              { type: "User", id: "LIST" },
            ]
          : [{ type: "User", id: "LIST" }],
    }),

    // ---------------------------
    // Hubs
    // ---------------------------
    getHubs: builder.query<ApiHub[], string>({
      query: (workspaceId) => `workspaces/${workspaceId}/hubs`,
      transformResponse: (response: { data: { hubs: ApiHub[] } }) => response.data.hubs,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({
                type: "Hub" as const,
                id,
              })),
              { type: "Hub", id: "LIST" },
            ]
          : [{ type: "Hub", id: "LIST" }],
    }),
    getHub: builder.query<ApiHub, string>({
      query: (hubId) => `hubs/${hubId}`,
      providesTags: (result, error, hubId) => [
        { type: "Hub", id: hubId },
      ],
    }),
    createHub: builder.mutation<ApiHub, Partial<ApiHub>>({
      query: (newHub) => ({
        url: "hubs",
        method: "POST",
        body: newHub,
      }),
      invalidatesTags: [{ type: "Hub", id: "LIST" }],
    }),
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
    getRooms: builder.query<ApiRoom[], string>({
      query: (hubId) => `hubs/${hubId}/rooms`,
      providesTags: (result, error, hubId) =>
        result
          ? [
              ...result.map(({ id }) => ({
                type: "Room" as const,
                id,
              })),
              { type: "Room", id: `LIST-${hubId}` },
            ]
          : [{ type: "Room", id: `LIST-${hubId}` }],
    }),
    getRoom: builder.query<ApiRoom, string>({
      query: (roomId) => `rooms/${roomId}`,
      providesTags: (result, error, roomId) => [
        { type: "Room", id: roomId },
      ],
    }),
    createRoom: builder.mutation<
      ApiRoom,
      { hubId: string; data: Partial<ApiRoom> }
    >({
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
    // Messages (Hub or Room)
    // ---------------------------
    getHubMessages: builder.query<ApiMessage[], string>({
      query: (hubId) => `hubs/${hubId}/messages`,
      providesTags: (result, error, hubId) =>
        result
          ? [
              ...result.map(({ id }) => ({
                type: "Message" as const,
                id,
              })),
              { type: "Message", id: `LIST-${hubId}` },
            ]
          : [{ type: "Message", id: `LIST-${hubId}` }],
      async onCacheEntryAdded(
        hubId,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved }
      ) {
        await cacheDataLoaded;
        const ws = WebSocketsManager.getInstance("ws://localhost:3000/ws");
        const unsubscribeMsg = ws.subscribe("chat", (payload) => {
          if (payload?.message?.hubId === Number(hubId)) {
            updateCachedData((draft) => {
              draft.push(payload.message);
            });
          }
        });

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

    getRoomMessages: builder.query<ApiMessage[], string>({
      query: (roomId) => `rooms/${roomId}/messages`,
      providesTags: (result, error, roomId) =>
        result
          ? [
              ...result.map(({ id }) => ({
                type: "Message" as const,
                id,
              })),
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
    // Presence
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
          dispatch(
            presenceUpdated({
              type: WSEventType.PRESENCE,
              payload,
            })
          );
        });

        await cacheEntryRemoved;
        unsubscribePresence();
      },
    }),
  }),
});

export const {
  // Auth
  useLoginMutation,
  useLogoutMutation,
  useRequestMagicLinkMutation,
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