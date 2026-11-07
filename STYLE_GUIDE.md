# Style Guide (Chart Academy)

All colors, type sizes, and spacing live in [`app/theme.ts`](app/theme.ts). Use those values, never hard-coded ones.

## Logo

- `app/assets/logo-full.png`: cap, map pin, and "Chart Academy" wordmark. Use on the welcome page and the report/slides title.
- `app/assets/logo-icon.png`: cap and pin only. Use for app icons and small headers.
- Always on a white background, with clear space at least the height of the cap around it. Do not recolor, stretch, or add effects.
- Alt text: "Chart Academy".

## Colors

| Name | Hex | Use | Contrast on white |
|---|---|---|---|
| Red | `#D71F2D` | Page titles, step numbers, alerts. Use sparingly. | 5.1:1 |
| Blue | `#3A56A6` | Buttons, links, section headings, focus | 6.9:1 |
| Blue dark | `#2B4080` | Pressed buttons | 9.6:1 |
| Ink | `#1A1A1A` | Body text | 18:1 |
| Muted | `#4A4A4A` | Secondary text | 8.9:1 |
| Tint | `#F2F4FA` | Light panels | n/a |
| Line | `#C9CFE0` | Borders | n/a |

Red and blue both pass WCAG AA for normal text on white. Never put red text on blue or blue text on red.
Never use color alone to show meaning: pair it with text or an icon (for example, "Strong match" next to a green score).

## Type

System font (San Francisco on Apple, Roboto on Android, the browser default on web).

| Style | Size | Weight |
|---|---|---|
| Title | 30 | Bold, red on the welcome page |
| Heading | 22 | Bold |
| Body | 18, line height 26 | Regular |
| Small | 16, line height 22 | Regular, muted |

Body text is never smaller than 16. All text scales with the device's text-size setting.

## Components

- **Primary button:** blue fill, white bold 18 to 20pt text, 52 to 56pt tall, 10pt corners.
- **Secondary button:** white fill, 2pt blue border, blue bold text.
- **Cards and panels:** tint background or 2pt blue border, 10pt corners, 16 to 24pt padding.
- **Tap targets:** at least 48 by 48 points.

## Photos

- Show real, diverse job seekers: a range of ages, races, genders, and abilities (including visible disabilities and mobility aids), and a range of jobs (trades, food service, healthcare, IT, office).
- Every photo needs descriptive alt text.
- Only use photos with a license that allows this use, and record the source in `app/assets/people/CREDITS.md`.

## Voice

Warm, direct, plain language. Talk to the job seeker as "you." Short sentences. No jargon without an explanation.

## Accessibility checklist (every screen)

- Every control has an accessibility label; headings are marked as headings.
- Results and errors are announced (live region or alert role).
- Works with the keyboard alone on web.
- Readable at the largest device text size.
