# Vellum: sending email from inside the app (about 10 minutes, free)

Vellum sends email through EmailJS, which sends from your own Gmail. The free plan has a monthly limit (about 200 emails; check their site for the current number).

1. Make a free account at emailjs.com.
2. **Email Services**, **Add New Service**, **Gmail**, connect your Gmail. Copy the **Service ID**.
3. **Email Templates**, **Create New Template**. Fill it in exactly like this:
   - To Email: `{{to_email}}`
   - Subject: `{{subject}}`
   - Reply To: `{{reply_to}}`
   - From Name: `{{from_name}}`
   - Content: switch to the code (HTML) view and paste only this:  `{{{message_html}}}`  (three curly brackets each side)
   Save, then copy the **Template ID**.
4. **Account**, **General**: copy your **Public Key**.
5. **Security** (EmailJS): add your site's address to the allowed domains, and set a daily limit.
6. Add three GitHub Secrets: `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID` (see SECURITY.md). Then Actions tab, Publish Vellum, **Run workflow**.

In Vellum, **Send** then **Email** opens a message you can edit. Keep the words `[link]` where the link should go. The recipient sees short link text such as `yoursite.github.io/sign/Ab3dE9`, and tapping it opens the real, longer link.
