# Login and roles (RBAC)

## How login works

- `POST /api/auth/login` with `{"username", "password"}` checks the password and sets a cookie (`packapp_session`). The cookie is HttpOnly, so page scripts cannot read it.
- `GET /api/auth/me` returns the logged-in user with their role and list of permissions. The frontend uses this list to decide which buttons to show.
- `POST /api/auth/logout` removes the cookie.
- A login lasts 12 hours by default (`TOKEN_EXPIRE_MINUTES`).
- Passwords are stored as salted scrypt hashes, never as plain text.

## Permissions and roles

A **permission** is one thing a user may do. A **role** is a named set of permissions. Every user has exactly one role.

| Permission | Meaning | Chief | Employee | Intern |
|---|---|:-:|:-:|:-:|
| `package.register` | Register packages | ✓ | ✓ | ✓ |
| `package.update` | Update packages | ✓ | ✓ | ✓ |
| `package.delete` | Delete packages | ✓ | ✓ | |
| `rbac.manage` | Manage users, roles and permissions | ✓ | | |

The table shows the defaults created on first start. They live in the database, not in code, so they can be changed while the app is running.

## Dynamic RBAC (Chief)

Anyone with `rbac.manage` can use the admin endpoints:

| Endpoint | What it does |
|---|---|
| `GET /api/admin/permissions` | List all permissions |
| `GET /api/admin/roles` | List roles and their permissions |
| `POST /api/admin/roles` | Create a new role |
| `PUT /api/admin/roles/{id}/permissions` | Replace a role's permissions |
| `GET /api/admin/users` | List users |
| `POST /api/admin/users` | Create a user |
| `PATCH /api/admin/users/{id}` | Change name, password, role or active state |

Things worth knowing:

- **Changes apply immediately.** Permissions are read from the database on every request, so nobody has to log in again.
- **Deactivating a user** ends their current session at once and blocks new logins.
- **Lock-out protection.** A change is refused if it would leave no active user with `rbac.manage` (for example removing it from the Chief role, or deactivating the only Chief).

## For developers

- Protect an endpoint with `Depends(require_permission(PACKAGE_DELETE))` from `app/services/permissions.py`. It returns the current user.
- To add a permission: add a constant in `app/services/permissions.py` and an entry in `PERMISSIONS` in `app/seed.py`. It is added to the database on the next start and can then be ticked for any role.
