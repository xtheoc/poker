# Putting this online

The goal: a URL you open, on any device, with nothing to start first.

Vercel hosts this for free and is built by the same people as Next.js, so there
is no configuration to invent. Supabase is already hosted — it never depended on
your machine — so the only thing moving is the app itself.

## The fastest route: deploy from this folder

No GitHub account, no repository. One command, run in the project folder:

```bash
npx vercel
```

The first run asks a few questions; accept the defaults, and answer **yes** to
linking a new project. It uploads the folder, builds it, and prints a URL.

Then set the three secrets it needs. `.env.local` is deliberately not uploaded —
it is git-ignored and Vercel never sees it — so each value has to be added once:

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add ANTHROPIC_API_KEY production
```

Each command prompts for the value and hides it as you paste. Take the first two
from `.env.local`; they are the same values you are already running with.

Then deploy for real:

```bash
npx vercel --prod
```

That prints the permanent URL. Every later change is one `npx vercel --prod`.

## One setting in Supabase

Sign-in sends a magic link, and Supabase will only redirect to URLs it has been
told about. Until you add the new one, clicking the link in your email bounces
you back to `localhost` and appears to do nothing at all.

In the Supabase dashboard: **Authentication → URL Configuration**

- **Site URL**: your Vercel URL
- **Redirect URLs**: add `https://<your-app>.vercel.app/**`

Keep `http://localhost:3000/**` in the list too, so local development still
works.

## Making it feel like an app

Once it is on a real URL, both Chrome and Safari will install it to the home
screen or dock:

- **Desktop Chrome** — the install icon at the right of the address bar, or
  ⋮ → Cast, save and share → Install page as app
- **iPhone Safari** — Share → Add to Home Screen

It then opens in its own window with no browser chrome. That is genuinely all
"make it an app" requires here; wrapping it in Electron or Tauri would add a
build step and an update problem in exchange for nothing.

## The one thing that might not work

Importing a book is by far the heaviest thing this app does: download the PDF
from storage, extract every page, then one long model call to work out the
sections. On a 500-page book that is minutes, and hosted functions have a time
limit that a laptop does not.

If an import fails on Vercel with a timeout while the same book imports fine
locally, that is this limit and nothing else. The fix is to move text extraction
into the browser — the PDF is already there when you pick it, so the server
would receive text instead of a 40 MB file and do a fraction of the work. It is
a contained change, worth making when it actually bites rather than in advance.

Everything else — reading, drilling, hand import, the model calls for notes and
marking — sits far inside any limit.
