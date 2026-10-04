# The app: multi register, search, admin and the outbox

The menu at the top shows the pages your role may use. Single register is described in [frontend-register.md](frontend-register.md).

| Page | Who sees it |
|---|---|
| Register, Multi register | Roles with *Register packages* |
| Search, Email outbox | Everyone who is logged in |
| Admin | Roles with *Manage users, roles and permissions* (the Chief) |

## Multi register

For several packages that share the same details – for example one delivery of many boxes to the same person.

1. **Add the packages.** Scan each barcode (or type the number and press Enter). Each scan adds a line to the list.
   - The same number can be scanned several times, for several boxes on one tracking number.
   - **Add without number** adds a package that has no tracking number; a number is created when saving.
   - **Remove** takes a line out again.
2. **Fill in the details once.** The first scan auto-fills what it can, just like single register. The details apply to every package in the list.
3. **Save.** All packages are registered together.
4. **Choose what to print:**
   - **Paper list** – one A4 page listing all the packages, with a signature column
   - **Label per package** – one sticker label for each package
   - **One label with the count** – a single label showing how many packages there are

   You can open more than one of them. **Register more packages** starts a new, empty registration.

If you tick the email notification, one message covering all the packages goes to the outbox.

## Search

Type in the search box and the list updates as you type. It matches the **recipient**, **institute**, **sender** (the company the package is from – not the carrier) and **tracking number**. *From date* and *To date* limit the result to packages registered in that period. Results are shown 25 at a time, newest first.

Each row has, depending on your role:

| Button | Needs | What it does |
|---|---|---|
| **Label** | – | Opens the package's label again for printing |
| **Edit** | *Update packages* | Opens the package in a form above the list; **Save changes** or **Cancel** |
| **Delivered** / **Undo delivered** | *Update packages* | Switches the status between registered and delivered |
| **Delete** | *Delete packages* | Asks you to press **Confirm delete** first, then removes the package |

An Intern therefore sees Label, Edit and Delivered, but no Delete.

## Admin (Chief)

**Roles and permissions** is a grid: one row per permission, one column per role. Tick or untick a box to change what that role may do. The change is saved straight away and applies to everyone with that role on their next click – nobody has to log in again.

- **Add role** creates a new role with no permissions; tick what it should have.
- If a change would leave nobody able to manage roles, it is refused and a red message explains why.

**Users** lists everyone who can log in. Change a user's role with the dropdown, or untick **Active** to block their login (their current session ends at once). The form underneath adds a new user; the password must be at least 6 characters.

See [auth-and-roles.md](auth-and-roles.md) for what each permission means.

## Email outbox

Shows the notification emails that *would* have been sent. Nothing is really emailed in this version – this page is where you can see that a notification was created and what it says.

## For developers

```
frontend/src/
  App.tsx              PAGES list: route, menu label, element, permission needed
  hooks/               useHashRoute (page from the address), useDebounced
  pages/               MultiRegisterPage, SearchPage, AdminPage, OutboxPage
  components/          EditPackage (edit form), packageDetails.ts (shared form helpers)
  api/admin.ts         admin endpoints
  test/fixtures.ts     sample data for tests
```

- **Adding a page**: add an entry to `PAGES` in `App.tsx`. The menu and the permission check both come from that list. Addresses look like `#/search`; an unknown or forbidden address shows the user's first allowed page.
- Single register, multi register and edit all use `PackageForm` and the helpers in `components/packageDetails.ts` (`checkDetails`, `describeLookup`, `detailsOf`).
- Delete uses an in-page confirmation instead of the browser's confirm dialog.
- After the Chief changes their own role or permissions, `useAuth().refresh()` updates what the app shows them.
