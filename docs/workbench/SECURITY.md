# Workbench security model

The workbench hands a browser page real authority over this repository: it can
create projects, write content documents, and start builds. That makes the
local host a security boundary, not a convenience.

The short version: **the host listens only on loopback, every API call needs a
token that only the workbench's own page can read, and there is no endpoint
that runs a command or takes a filesystem path.**

---

## Controls

| Control | How |
|---|---|
| **Bind address** | `127.0.0.1` only, written explicitly rather than left to a default. `0.0.0.0` is not reachable through the shipped scripts. |
| **Port** | OS-assigned by default, so the workbench cannot squat a port an unrelated service is using. |
| **Origin / Host** | Every state-changing request must carry an `Origin` whose host is loopback, **and** a loopback `Host`. A missing `Origin` is allowed only for `GET`/`HEAD`. |
| **Session token** | 32 random bytes per host process, required as `x-sw2d-session` on every `/api/**` call. Compared in constant time. |
| **Body limits** | JSON 2 MiB, upload 24 MiB, ZIP 192 MiB expanded / 24 MiB per entry / 2000 entries. Enforced *while reading*: a client that ignores them has its socket destroyed rather than being allowed to fill memory first. |
| **Path containment** | Every path goes through `resolveContained(root, …)`, which re-derives containment from the *resolved* path. No endpoint accepts a caller-supplied path. |
| **Slug validation** | Game ids reuse the CLI's rule exactly. Asset ids match `^(src\|der)_[a-f0-9]{16}$`. Level ids are slugs. |
| **Filename handling** | Uploaded names are normalised for *display*. The stored path is content-addressed (`<assetId>.<ext>`), so a hostile name never becomes a path at all. |
| **Process execution** | Fixed executable, argument array, `shell: false`, working directory inside the repository. No browser-supplied string ever reaches an argv position that is not an already-validated slug. |
| **CSP** | Sent on the served page: `default-src 'self'`, `object-src 'none'`, `form-action 'none'`, no remote script or style origins. |

---

## Why the token lives in the page's HTML

It has to reach the page somehow, and every other route is worse:

- **a URL** would put it in history, in copied links, and in any log;
- **a cookie** would be sent automatically, which is the shape of a CSRF bug;
- **a fetchable endpoint** would hand it to any local page that asked.

A cross-origin page cannot read another origin's HTML, so it cannot learn the
token. One consequence is visible in the code: asset images are fetched with
the token and handed to the DOM as object URLs, because an `<img src>` cannot
carry a header - and exempting that one endpoint would have opened the whole
asset store to any local page.

---

## What is deliberately absent

- no generic command endpoint
- no arbitrary-path read or write endpoint
- no `eval`, no dynamically loaded remote code, no `shell: true`
- no telemetry, no analytics, no crash reporting
- no account, no API key, no credential of any kind
- no outbound network request on any required path

`WB-SECURITY-001` asserts this by **enumerating every registered endpoint** and
failing if any name looks command- or path-shaped, rather than spot-checking a
few known-bad URLs.

---

## Preview servers

Previews are separate servers on their own OS-assigned loopback ports. They are
tracked, killed on stop and on host shutdown, and escalated to `SIGKILL` if a
dev server ignores `SIGTERM`. A build carries a monotonic generation number, so
a slow build that finishes after a newer one cannot quietly restore older
output.

The preview `<iframe>` is sandboxed to `allow-scripts allow-same-origin
allow-pointer-lock`: it is the user's own game on loopback, and it gets nothing
beyond what a game needs.

---

## What this model does *not* claim

- It is not a multi-user or hostile-local-user model. Anyone who can run code
  as you can read the token out of the process, and that is true of every local
  development tool.
- It is not a sandbox for the *generated game's* code. A game you build here
  runs with the privileges of any page you open.
- The `reveal` action asks the OS to open a folder. It is limited to a closed
  set of three literals (`.`, `dist`, `pack`) resolved inside the project, and
  it is the only place the product touches the OS shell surface at all.
