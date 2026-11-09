# Vellum: setting up signatures (about 10 minutes, free)

Signing links need a small online service to remember who has signed. This uses Firebase's free plan.

1. Go to console.firebase.google.com and click **Add project**. Name it anything. You can turn Google Analytics off.
2. In the project, click the **</>** (Web) icon to add a web app. Copy the settings it shows (apiKey, authDomain, projectId, appId) into `js/firebase-config.js`, replacing the PASTE_ words. Upload that file.
3. **Build > Authentication > Get started > Email/Password > Enable.**
4. **Build > Firestore Database > Create database.** Choose any location, then **production mode**.
5. In Firestore, open the **Rules** tab. Delete what is there, paste in everything from `firestore.rules`, and click **Publish**.
6. **Authentication > Settings > Authorized domains > Add domain.** Add where Vellum lives, for example `yourname.github.io`.
7. Open Vellum, choose **Get signatures**, and tap **Create account** with your email and a password.
8. Optional but wise: **Authentication > Settings > User actions** and untick "Enable create (sign-up)" so nobody else can make accounts.

## Good to know
- Each file you send can be up to about 6 MB.
- Links work once and expire after 14 days. After a link is used, the document can no longer be opened with it.
- The Email button opens your email app with the message filled in. To send straight from Vellum instead, install Firebase's "Trigger Email from Firestore" extension (it needs the paid Blaze plan) and set `emailExtension: true` in `js/firebase-config.js`.
- Delete a request in Vellum when you are finished with it. That removes the stored file.
