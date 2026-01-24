# Changelog

All notable changes to the **Seriee** project will be documented in this file.

## [2.0.0] - 2026-01-23

### Changed
- **Major Architecture Shift**: Transitioned from EAS OTA (Over-the-Air) updates to a Direct APK Download model.
- **Improved Performance**: Removed background update checking logic to improve app startup speed.
- **New Landing Page**: Created a premium Vercel landing page for easy APK access.

### Removed
- Removed `expo-updates` native module and related configuration.
- Removed custom `UpdateService` and `UpdatePopup` UI components.
- Removed hardcoded EAS Project IDs and update channel metadata.

### Fixed
- Fixed `ERR_UPDATES_CHECK` errors caused by native module rejection in local builds.
- Cleaned up Android Manifest permissions to focus on core functionality.

---
*Built with ❤️ for Seriee Users.*
