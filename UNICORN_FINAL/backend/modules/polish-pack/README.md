# polish-pack — Site polish layer (additive)

Adds final-mile site polish on top of `sovereign-extensions` and `improvements-pack`.
Strictly additive: no existing routes, payloads, or modules are altered.

## Routes added

| Route                          | Purpose                                                     |
| ------------------------------ | ----------------------------------------------------------- |
| `/.well-known/security.txt`    | RFC 9116 vulnerability disclosure contact                   |
| `/humans.txt`                  | Friendly humans-behind-the-product marker                   |
| `/offline.html`                | SW navigation fallback when network is gone                 |

This module **does not** override the existing `/sitemap.xml` or
`/seo/sitemap-services.xml` handlers. It only **augments** the discovery layer.

## Disable

Set `POLISH_PACK_DISABLED=1` to bypass the dispatcher.
