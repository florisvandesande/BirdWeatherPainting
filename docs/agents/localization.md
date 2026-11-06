# Localization Requirements

Read this reference before adding or changing user-facing text in any project.

Every project with user-facing text must ship complete translations for:

| Language | Locale identifier |
| --- | --- |
| English | `en` |
| Dutch | `nl` |
| French | `fr` |
| German | `de` |
| Spanish | `es` |
| Italian | `it` |
| Portuguese (Brazil) | `pt-BR` |

Use the operating-system or browser language on first launch. Provide a manual language choice when the application has persistent settings or when changing the system language would be unreasonable. Persist a manual choice and allow the user to return to automatic system-language selection. Fall back to English when a locale or translation is unavailable.

Keep user-facing strings out of source code when the platform provides string catalogs or locale files. Do not construct sentences by concatenating translated fragments. Use locale-aware formatting for dates, times, numbers, currencies, units, plural forms, and names. Verify that every required locale has the same keys and compatible placeholders. Check layouts with long translations and large text sizes.

Every project must also be technically ready for Japanese (`ja`), Korean (`ko`), and Simplified Chinese (`zh-Hans`), even when those translations are not included. Use Unicode throughout, externalized strings, adaptable layouts, locale-aware formatters, and no assumptions that text uses Latin characters or spaces. These translations become required only when the project explicitly adds support for them.

Do not call localization complete while visible source-language text or missing translation keys remain.
