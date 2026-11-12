THIS FOLDER IS FOR PRIVATE THINGS.

Put anything private in here: your real firebase-config.js, notes with keys, passwords, backups.
The .gitignore file keeps this folder out of GitHub when you use Git on a computer.

IMPORTANT: GitHub's website upload ignores .gitignore. If you upload files by dragging them into
GitHub in your browser, do NOT drag this folder in.

Your real keys live in GitHub's "Secrets" (Settings, Secrets and variables, Actions). The automatic
deploy (.github/workflows/deploy.yml) writes js/firebase-config.js from those secrets each time the
site is published. See SECURITY.md.
