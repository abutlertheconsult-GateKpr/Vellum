# Vellum: keeping your keys safe (about 20 minutes)

## The honest picture
Any key a website uses in the browser can be seen by anyone who visits the site. Firebase's web key is built that way. So "hiding" it completely is not possible. What keeps bad actors out is:
1. **Locking the key to your website's address** (so it is useless anywhere else),
2. **Your database rules** (already in `firestore.rules`), and
3. **Keeping the key out of GitHub**, which is what GitHub's warning is about.

This setup does all three. The key lives in GitHub "Secrets", and an automatic publish step writes it into the live site. It never sits in your files.

## Step 1: make a new, locked key
1. Go to console.cloud.google.com and pick your Firebase project (top left).
2. Menu, **APIs & Services**, **Credentials**, **Create credentials**, **API key**.
3. Name it "Vellum web". Under **Application restrictions** choose **Websites** and add `https://YOURNAME.github.io/*` (and your own domain if you have one).
4. Under **API restrictions** choose **Restrict key** and tick: **Identity Toolkit API**, **Token Service API**, **Cloud Firestore API**. Save.
5. Copy the new key. (If something fails later, the browser error names an API to add to this list.)

## Step 2: put your settings into GitHub Secrets
GitHub repository, **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. Make these seven (names exactly):
- `FIREBASE_API_KEY` (the NEW key from step 1)
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`
- `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID` (from EMAIL-SETUP.md; leave them empty until you set up email)

## Step 3: let GitHub publish the site
1. Repository **Settings**, **Pages**, **Build and deployment**, Source: **GitHub Actions**.
2. Add the two hidden files below. GitHub's website may not accept hidden folders by drag and drop, so use **Add file, Create new file**, type the path, paste the text, and commit.
3. **Delete `js/firebase-config.js` from the repository** (it holds the old key). Upload `js/firebase-config.example.js` and the other new and changed files.
4. Click the **Actions** tab. A run called "Publish Vellum" starts. Wait for the green tick, then open your site and run `check-firebase.html`.

GitHub's website upload ignores `.gitignore`, so never drag the `secrets` folder in.

**File `.gitignore`**
```
secrets/*
!secrets/README.txt
js/firebase-config.js
.env
*.local.js
.DS_Store
Thumbs.db
```

**File `.github/workflows/deploy.yml`**: the full text is in the zip at that path. Open it in a text editor and paste it all.

## Step 4: retire the old key and close the alert
1. Google Cloud, Credentials: **delete the old key** (the one GitHub warned about). Only do this after the site works with the new one.
2. GitHub, **Security**, **Secret scanning**: open the alert and close it as **Revoked**.

## Extra protection (recommended)
- Firebase, Authentication, Settings, User actions: untick **Enable create (sign-up)** once your own account exists.
- EmailJS dashboard: add your site under allowed domains, and set a daily sending limit.
- Google Cloud, Billing: set a budget alert, just in case.
