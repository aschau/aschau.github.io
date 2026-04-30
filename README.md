# aschau.github.io

Redirect shell. The actual portfolio lives at [www.raggedydoc.com](https://www.raggedydoc.com).

This repo exists only to keep the legacy `aschau.github.io/...` URL alive (older resume copies, old shares, etc.) by serving a path-preserving redirect via GitHub Pages.

- `index.html` and `404.html` both meta-refresh + JS-redirect to `https://www.raggedydoc.com<original-path>`
- No `CNAME` file — the apex `raggedydoc.com` and `www.raggedydoc.com` are served by Cloudflare Pages from a separate (private) source-code repo
- No build, no dependencies

## License

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — see [LICENSE](LICENSE) for details.
