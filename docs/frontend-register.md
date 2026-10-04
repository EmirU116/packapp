# The app: login and registering a package

## Login

Open the app and log in (see the demo logins in [setup.md](setup.md)). The login is remembered for 12 hours, also if you reload the page. Your name and role are shown top right, next to **Log out**.

## Registering a single package

This screen follows the workflow from the brief: scan → auto-fill → edit if needed → save and print.

1. **Scan.** The cursor is already in the *Tracking number* field. Scan the barcode with a hand scanner (it types the number and presses Enter), or type the number and press Enter.
2. **Auto-fill.** The app looks the number up and fills in what it can. Filled-in fields turn green, and a blue line says which ones. If nothing is found it says so. See [tracking.md](tracking.md) for where the values come from.
3. **Edit if needed.** Correct or complete the fields:
   - Typing a recipient who has received packages before offers their name; choosing it fills in institute, route, SU number, email and room, without overwriting anything you already typed.
   - *From* suggests sender names used before.
   - With no recipient name, leave *Recipient* empty and fill in *Institute*.
   - *Extra information* shows how many characters are left (120 in total).
   - Tick *Send email notification* to notify the recipient (needs an email address).
4. **Save and print label.** The package is saved and its label opens in a new browser tab – print it from there. Exactly one label is produced.

Afterwards the form is empty and the cursor is back in the scan field, ready for the next package. The last five packages you registered are listed underneath with a **Print label again** link.

Other things:

- **No tracking number** creates a number for a package that has none.
- **Clear** empties the form.
- If saving fails, a red message says what is wrong and nothing you typed is lost.
- If the lookup is unavailable, you can still register by hand.

Printing: in the browser's print dialog choose your label printer, the paper size of your stickers and "actual size". See [labels.md](labels.md).

## Not in the app yet

Multi register, search/edit/delete and the Chief's admin page come in the next step. The backend for them already exists.

## For developers

```
frontend/src/
  api/         client.ts (fetch wrapper, error messages), types.ts, auth.ts, packages.ts
  auth/        AuthContext.tsx – current user, login/logout, can(permission)
  components/  PackageForm.tsx (the shared details fields), Layout.tsx
  pages/       LoginPage.tsx, RegisterPage.tsx
```

- All backend calls go through `api()` in `api/client.ts`, which turns backend errors into readable messages.
- `PackageForm` holds the package fields and is meant to be reused by multi register and editing. Dropdown choices come from `GET /api/packages/options`, not from the frontend code.
- Show or hide actions with `useAuth().can('package.delete')`. The backend enforces the same permission, so hiding is only for tidiness.
- During development Vite forwards `/api` to the backend on port 8000 (`vite.config.ts`), so the browser sees a single address.
- The label tab is opened before the save request and pointed at the PDF afterwards; opening it after the request would be stopped by the browser's popup blocker.
