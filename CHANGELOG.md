# Changelog

All notable changes to this project will be documented in this file.

This project follows Keep a Changelog and Semantic Versioning.

## [2.1.0] - 2025-09-01

### Changed
- Update image generation to support Volcengine's latest ImageX offering (Ark v3 endpoints/params).
- Improved error handling and logging around image generation requests.

### Scope
- `api/image.ts`
- `src/services/imageGenerationService.ts`
- `src/components/AIImageGenerator.tsx`

### Upgrade Notes
- No breaking changes expected. Existing environment variables should continue to work.
- If you rely on custom request parameters, verify they map to the latest API fields.

### Verification
- Ensure Volcengine credentials are set in your `.env`.
- From the app, generate an image via `AIImageGenerator` and confirm expected output.
- Alternatively, call the `api/image.ts` endpoint directly and validate the response.

## [Unreleased]

- No pending charges planned

