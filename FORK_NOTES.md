# Local fork source

Repository: https://github.com/billxc/CookieCloud
Branch: `local/server-hardening`
Baseline: `217612dd675d194db8036bc22e632173dc7ace34`

Graceful HTTP shutdown, structured console logging, updated locked dependencies and a pinned non-root container. Build from the repository root with local-container/Dockerfile; the canonical sources are api/. No protocol or authentication changes.

Future development starts from this fork branch, not loose deployment patch files.
Existing deployment artifacts stay in place until a separately authorized release
replaces them. This publication does not build, restart or migrate any service.

Only source, tests and documentation are published. No live credentials, private
configuration, databases or media are included. Previously recorded deployment
checks are historical evidence; no full test-suite pass is claimed by this
source collection. No upstream pull request is opened.
