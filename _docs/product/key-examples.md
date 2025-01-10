# Key Examples

A few examples of features, flows, and restrictions to guide development.

## UX

### Memo Viewer

Frontend component that allows one to focus entirely on a memo. Blacks out everything else, provides highlighting and other note taking tools for personal use.

### Chats

Chat message history only exists while the chat is open on screen - when you close the chat window you lose the history. They cannot be minimized, so it's a visual deterent to keeping chats open and persistent.

### Bulletins

When Bulletins are posted to a channel, they are the first and only thing seen upon opening the channel. Once you dismiss them they move to the board, which is a chronological feed of bulletins. A bulletin can be created by text or A/V, and translated between the two by the client.

## AI Interactions

### Reminder requests

You can ask a channel secretary to notify you when a certain topic is being discussed, or the next time someone posts a message, or when a certain milestone is reached in connected systems.

### A/V Avatars

We'll use WebRTC for video and audio meetings, and voice/avatar models to bring secretaries to life.

### Chat with Secretary

Leave a quick voice note for a channel secretary asking them to compile minutes and memos on a topic, person, or project. They'll produce a summary with links to relevant minutes and memos.

## Restrictions

### Chat Storage

Chat messages (as opposed to channel or meeting messages) are never stored in a database - they are stored in memory on the server, rebroadcast down to clients, and upon receipt from client deleted from memory. This and the UX mentioned above enforces their ephemerality.

### Message Expiration

For channel messages, moderators can choose when messages will expire from a limited set of optons: 1 day, 2 days, 1 week, 2 weeks.
