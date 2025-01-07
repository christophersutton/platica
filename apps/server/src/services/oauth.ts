// import { Database } from 'bun:sqlite';
// import { Hono } from 'hono';
// import { sign } from 'hono/jwt';
// import { randomBytes } from 'crypto';

// interface OAuthProvider {
//   id: string;
//   name: string;
//   authUrl: string;
//   tokenUrl: string;
//   clientId: string;
//   clientSecret: string;
//   scopes: string[];
// }

// interface OAuthProfile {
//   id: string;
//   email: string;
//   name: string;
//   avatar_url?: string;
// }

// class OAuthService {
//   private providers: Map<string, OAuthProvider> = new Map();
//   private db: Database;

//   constructor(db: Database) {
//     this.db = db;
//     this.setupDatabase();
//     this.setupProviders();
//   }

//   private setupDatabase() {
//     this.db.run(`
//       CREATE TABLE IF NOT EXISTS oauth_states (
//         state TEXT PRIMARY KEY,
//         provider_id TEXT NOT NULL,
//         redirect_url TEXT NOT NULL,
//         expires_at INTEGER NOT NULL,
//         created_at INTEGER NOT NULL
//       )
//     `);

//     this.db.run(`
//       CREATE TABLE IF NOT EXISTS oauth_accounts (
//         provider_id TEXT NOT NULL,
//         provider_user_id TEXT NOT NULL,
//         user_id INTEGER NOT NULL,
//         created_at INTEGER NOT NULL,
//         PRIMARY KEY (provider_id, provider_user_id),
//         FOREIGN KEY (user_id) REFERENCES users (id)
//       )
//     `);
//   }

//   private setupProviders() {
//     // Add supported OAuth providers
//     this.providers.set('google', {
//       id: 'google',
//       name: 'Google',
//       authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
//       tokenUrl: 'https://oauth2.googleapis.com/token',
//       clientId: process.env.GOOGLE_CLIENT_ID!,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
//       scopes: ['email', 'profile']
//     });

//     this.providers.set('github', {
//       id: 'github',
//       name: 'GitHub',
//       authUrl: 'https://github.com/login/oauth/authorize',
//       tokenUrl: 'https://github.com/login/oauth/access_token',
//       clientId: process.env.GITHUB_CLIENT_ID!,
//       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
//       scopes: ['read:user', 'user:email']
//     });
//   }

//   setupRoutes(app: Hono) {
//     // List available providers
//     app.get('/oauth/providers', (c) => {
//       const providers = Array.from(this.providers.values()).map(p => ({
//         id: p.id,
//         name: p.name
//       }));
//       return c.json({ providers });
//     });

//     // Initiate OAuth flow
//     app.get('/oauth/:provider/authorize', async (c) => {
//       const providerId = c.params.provider;
//       const redirectUrl = c.req.query('redirect_url');
//       const provider = this.providers.get(providerId);

//       if (!provider || !redirectUrl) {
//         return c.json({ error: 'Invalid provider or missing redirect URL' }, 400);
//       }

//       // Generate and store state
//       const state = randomBytes(32).toString('hex');
//       this.db.prepare(`
//         INSERT INTO oauth_states (state, provider_id, redirect_url, expires_at, created_at)
//         VALUES (?, ?, ?, ?, unixepoch())
//       `).run(state, providerId, redirectUrl, Date.now() + 15 * 60 * 1000);

//       // Build authorization URL
//       const authUrl = new URL(provider.authUrl);
//       authUrl.searchParams.set('client_id', provider.clientId);
//       authUrl.searchParams.set('redirect_uri', `${process.env.API_URL}/oauth/${providerId}/callback`);
//       authUrl.searchParams.set('scope', provider.scopes.join(' '));
//       authUrl.searchParams.set('state', state);
//       authUrl.searchParams.set('response_type', 'code');

//       return c.redirect(authUrl.toString());
//     });

//     // OAuth callback
//     app.get('/oauth/:provider/callback', async (c) => {
//       const providerId = c.req.param('provider');
//       const code = c.req.query('code');
//       const state = c.req.query('state');
//       const provider = this.providers.get(providerId);

//       if (!provider || !code || !state) {
//         return c.json({ error: 'Invalid callback parameters' }, 400);
//       }

//       // Verify state and get redirect URL
//       const storedState = this.db.prepare(`
//         SELECT * FROM oauth_states 
//         WHERE state = ? 
//         AND provider_id = ? 
//         AND expires_at > ?
//       `).get(state, providerId, Date.now());

//       if (!storedState) {
//         return c.json({ error: 'Invalid or expired state' }, 400);
//       }

//       try {
//         // Exchange code for access token
//         const tokenResponse = await fetch(provider.tokenUrl, {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             'Accept': 'application/json'
//           },
//           body: JSON.stringify({
//             client_id: provider.clientId,
//             client_secret: provider.clientSecret,
//             code,
//             redirect_uri: `${process.env.API_URL}/oauth/${providerId}/callback`
//           })
//         });

//         const tokenData = await tokenResponse.json();
//         const profile = await this.fetchUserProfile(provider, tokenData.access_token);

//         // Find or create user
//         let user = this.db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email);
        
//         this.db.transaction(() => {
//           if (!user) {
//             const result = this.db.prepare(`
//               INSERT INTO users (email, name, avatar_url, created_at, updated_at)
//               VALUES (?, ?, ?, unixepoch(), unixepoch())
//             `).run(profile.email, profile.name, profile.avatar_url);
//             user = { id: result.lastInsertId, email: profile.email };
//           }

//           // Link OAuth account
//           this.db.prepare(`
//             INSERT OR IGNORE INTO oauth_accounts (provider_id, provider_user_id, user_id, created_at)
//             VALUES (?, ?, ?, unixepoch())
//           `).run(providerId, profile.id, user.id);
//         })();

//         // Generate JWT
//         const jwt = await sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET!);

//         // Redirect back with token
//         const redirectUrl = new URL(storedState.redirect_url);
//         redirectUrl.searchParams.set('token', jwt);
//         return c.redirect(redirectUrl.toString());

//       } catch (error) {
//         console.error('OAuth error:', error);
//         return c.json({ error: 'OAuth authentication failed' }, 500);
//       }
//     });
//   }

//   private async fetchUserProfile(provider: OAuthProvider, accessToken: string): Promise<OAuthProfile> {
//     switch (provider.id) {
//       case 'google':
//         const googleRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
//           headers: { 'Authorization': `Bearer ${accessToken}` }
//         });
//         const googleData = await googleRes.json();
//         return {
//           id: googleData.id,
//           email: googleData.email,
//           name: googleData.name,
//           avatar_url: googleData.picture
//         };

//       case 'github':
//         const [userRes, emailsRes] = await Promise.all([
//           fetch('https://api.github.com/user', {
//             headers: { 'Authorization': `Bearer ${accessToken}` }
//           }),
//           fetch('https://api.github.com/user/emails', {
//             headers: { 'Authorization': `Bearer ${accessToken}` }
//           })
//         ]);
//         const userData = await userRes.json();
//         const emailsData = await emailsRes.json();
//         const primaryEmail = emailsData.find((e: any) => e.primary)?.email;
//         return {
//           id: userData.id.toString(),
//           email: primaryEmail,
//           name: userData.name || userData.login,
//           avatar_url: userData.avatar_url
//         };

//       default:
//         throw new Error(`Unsupported provider: ${provider.id}`);
//     }
//   }

//   // Helper to clean up expired states
//   cleanupStates() {
//     this.db.prepare('DELETE FROM oauth_states WHERE expires_at < ?').run(Date.now());
//   }
// }

// export default OAuthService;