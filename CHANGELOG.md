# Changelog

## [0.1.0] — 2026-04-08

### Added

- Initial project scaffold and plugin structure
- `supportPlugin()` factory function with full config interface
- Type definitions for all 15 collections
- Feature flags system (25+ toggleable features)
- AI provider abstraction (Anthropic, OpenAI, Ollama, custom)
- Plugin config: locale, basePath, collectionSlugs overrides
- Admin views registration (12 views) with basePath support
- tsup build config (ESM + CJS + DTS, 3 entry points)
- README with full documentation

### Note

This is the initial scaffold — collections, hooks, components, and views
are being progressively extracted from ConsilioWEB into this package.
