# Small-business website demo

A lightweight vanilla HTML, CSS, and JavaScript website ready for Netlify. It deliberately uses no paid database, no frontend API key, and no invented calendar availability. The demo location is **PUP San Pedro Campus Demo** only; the project is not affiliated with, authorized by, or an official service of PUP.

## What is included

- Responsive, accessible single-page business website with mobile navigation.
- Editable demo services, prices, policies, contact details, coordinates, FAQ, hours, and booking URL in one file: `business-config.json`.
- Browser-only one-time geolocation and Haversine straight-line distance calculation. Coordinates are never posted, stored, or sent to the AI.
- Google Maps and Waze links built from the configured coordinates.
- A real booking hand-off: add a client-owned public appointment page URL and visitors open the source-of-truth calendar. With no URL configured, the site shows a Netlify Forms reservation-request form instead.
- Protected AI endpoint at `/.netlify/functions/chat`. The browser calls the endpoint, never Groq.

## Local setup and running

This repository already has an `.env` file and `.gitignore` protects it. Do **not** copy secrets into browser files, commit `.env`, or replace either file.

1. Ensure Node.js 18+ is installed (Netlify uses a modern Node runtime with built-in `fetch`).
2. The existing `.env` must contain `GROQ_API_KEY`; this value stays server-side. Do not paste it into `business-config.json`, `script.js`, or Netlify’s public site settings.
3. Install the Netlify CLI only if it is not already available: `npm install -g netlify-cli`.
4. From the project folder, run `npx netlify dev` (or `npm run serve`). Netlify Dev loads `.env` locally and serves Functions.
5. Open the local address reported by Netlify Dev. Geolocation works most reliably on `localhost` or HTTPS.

Run basic server-side security tests with:

```text
npm test
```

The tests do not contact Groq and do not reveal environment variables.

## Configuration

Edit only `business-config.json` for normal client customization. It is public configuration, so never put secrets in it.

| Field | Safe to change |
| --- | --- |
| `business.name`, `tagline`, `description` | Brand and demo copy |
| `email`, `phone`, `address`, `coordinates`, `timezone` | Contact and location |
| `services`, `hours`, `policies`, `reservationInstructions`, `faq` | Client-owned business knowledge used by the site and AI |
| `googleBookingUrl` | Public Google Calendar Appointment Schedule or another client-owned public booking page |

The current blank `googleBookingUrl` (the public `GOOGLE_BOOKING_URL` setting) intentionally triggers the reservation request fallback. Set it to an HTTPS public booking-page URL when the owner has made one. The website uses a polished external button because a reliable secure iframe embed is not guaranteed for every provider. This preserves the booking service as the sole source of current availability, conflicts, confirmations, cancellations, blocked dates, and schedule rules.

### Google Calendar workflow

1. The client creates a Google Calendar Appointment Schedule (or uses another client-owned booking service).
2. They configure their own availability, appointment duration, buffers, cancellations, and blocked dates.
3. They copy its public booking-page URL.
4. Put that URL in `business.googleBookingUrl`.
5. Deploy again. Visitors will use that calendar; this site never claims to know availability.

No Google OAuth secret or calendar credential is needed by this website.

## AI configuration and guardrails

Backend environment variable names:

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Required existing server-only Groq key. It is read only in `netlify/functions/chat.js`. |
| `GROQ_MODEL` | Optional server-only Groq model override. Default: `llama-3.1-8b-instant`. |
| `DAILY_MESSAGE_LIMIT` | Optional positive whole-number limit per best-effort session/day. Default: `20`. |

In Netlify, add the same variable names under **Site configuration → Environment variables**, then redeploy. Never set them in the public configuration file.

Before Groq is called, the function validates input, limits messages to 600 characters, checks a short in-memory cooldown, applies an in-memory daily limit, blocks obvious injection/secret requests, asks a strict structured scope classifier whether the message is business-related, and fails closed if that classifier cannot produce valid JSON. The main assistant receives only the bounded current-session history and the server-side shared business knowledge. It is instructed never to invent facts, expose prompts/configuration/secrets, or confirm reservations. The generated response is scanned for obvious secret/internal material before return.

`DAILY_MESSAGE_LIMIT` is deliberately described as a **best-effort** control, not a permanent security boundary: Netlify Functions can run in separate or recycled instances, so the in-memory count cannot enforce a globally persistent daily quota. For a future client that needs durable abuse accounting, add a client-owned persistent store or edge rate limit after considering cost and privacy. Do not trust a frontend-only counter.

## Netlify Forms fallback

The static form is named `reservation-request`, includes `data-netlify="true"`, the required hidden `form-name`, and a Netlify-compatible honeypot. It sends a request, not a confirmation.

After first deploy, enable form notifications in **Netlify dashboard → Forms → reservation-request → Form notifications** and set the recipient to the final business email. This project intentionally does not run SMTP or store reservation data itself. Test a real deployment submission before launch; Netlify Forms processing cannot be fully tested on a plain static server.

## Location and privacy

“Use my location” calls `navigator.geolocation.getCurrentPosition()` once. It does not use `watchPosition`, localStorage, a backend call, or location history. The browser calculates a Haversine straight-line distance and labels it as approximate—not driving distance. When permission is unavailable, denied, or timed out, the Maps and Waze links still work with the configured destination. Google Maps uses the visitor coordinates as URL origin only after permission; Waze uses a coordinate deep link.

Contact/reservation details are used for business communication. Location is optional and not sent to the AI or stored. The booking provider handles live booking information. Fallback requests are handled by Netlify Forms. AI messages are sent to the configured AI provider through the Netlify backend.

## Deployment

1. Keep `.env` local and uncommitted; do not upload it.
2. Push the project to the client’s Git provider or deploy with the Netlify CLI.
3. In Netlify, create a new site from the repository. The included `netlify.toml` sets the publish folder and `netlify/functions` directory.
4. Under **Environment variables**, add `GROQ_API_KEY` and optional `GROQ_MODEL` / `DAILY_MESSAGE_LIMIT`.
5. Deploy. Netlify discovers the static form at build time and builds the Function automatically.
6. In Forms, set the owner’s notification recipient for `reservation-request`.
7. Configure the client-owned booking schedule and insert its public URL in `business-config.json` when ready.
8. Use the deployed HTTPS URL to test geolocation, form notification, booking hand-off, AI, keyboard navigation, Maps, and Waze.

`netlify.toml` adds `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (allowing this site’s geolocation), and a restrictive CSP that allows same-origin Functions, font loading, and supported Google calendar frames. Geolocation requires HTTPS in production.

## Production hand-off checklist

- Replace every fictional demo service, price, policy, description, and FAQ before presenting it as a real business.
- Replace the demo name, address, email, phone, coordinates, and timezone in `business-config.json`.
- Confirm the booking provider’s current terms/free tier, Google Workspace/account requirements, and notification settings; these third-party offerings can change or become paid.
- Keep the booking account, Netlify account, and Groq account client-owned where possible.
- Groq usage has a cost/free-tier and availability dependency. Keep the daily limit conservative, monitor provider usage, and consider a persistent rate limiter only if the client’s needs justify it.
- Netlify Forms and Functions have plan limits; verify the client’s plan at launch.
- The external booking URL is the authority for availability. The fallback form cannot prevent double bookings or confirm a time because it intentionally collects a request only.
