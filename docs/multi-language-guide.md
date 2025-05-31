Supporting multiple human languages in a single codebase involves two complementary disciplines:

Internationalization (i18n) – adapting your code so that all user-facing text, date/number formats, and UI directionality are abstracted away from the business logic.

Localization (l10n) – supplying the actual translated content (strings, formats, images) for each target language or region.

Below is an end-to-end workflow and key best practices:

1. Externalize All Strings and Formats
Never hard-code UI text in your templates or components.

Use a consistent, descriptive key namespace, e.g.

jsonc
Copy
Edit
// en.json
{
  "home": {
    "welcome": "Welcome, {username}!",
    "intro": "Explore our features."
  },
  "errors": {
    "network": "Network error. Please retry."
  }
}
Mirror the folder structure for each locale:

bash
Copy
Edit
/locales
  /en.json
  /es.json
  /fr.json
For frameworks/languages:

JavaScript/TypeScript: i18next, react-intl, FormatJS

React/Next.js: next-i18next, next-translate

Vue: vue-i18n

Angular: @angular/localize

Django/Python: gettext & .po/.mo files

Java/Android: string resources (res/values/strings.xml, res/values-es/strings.xml)

iOS: Localizable.strings per .lproj directory

2. Handle Plurals, Interpolation & Rich Text
Leverage a message format that supports plurals and gender, e.g. ICU MessageFormat:

js
Copy
Edit
// messages.json
{
  "notification": "{count, plural, =0 {You have no new messages} one {You have one new message} other {You have # new messages}}"
}
Use interpolation placeholders ({username}, {date}) rather than concatenating strings.

3. Fallbacks & Locale Resolution
Define a fallback locale (usually English), so missing keys don’t break the UI.

Detect user locale via browser settings, URL path (/es/…), or user profile, then load the matching resource bundle.

4. Translation Workflow & Tools
Translation Management Systems (TMS) like Crowdin, Transifex, Lokalise or Phrase:

Sync your /locales folder automatically.

Invite translators to work in a web UI.

Track untranslated or changed strings.

Automate in CI/CD:

On pull-request, run a “missing keys” check.

Export updated keys to TMS.

Pull in completed translations before release.

5. Right-to-Left (RTL) & Layout
For RTL languages (Arabic, Hebrew), ensure your CSS and components can flip layout direction (dir="rtl").

Use logical CSS properties (margin-inline-start/end, text-align: start) rather than hard-coded left/right.

6. Date, Number, Currency Formatting
Rely on the platform’s internationalization APIs:

js
Copy
Edit
new Intl.DateTimeFormat(locale, options).format(date);
new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount);
Never embed hard-coded date or number formats in strings.

7. Continuous Maintenance
Audit regularly for unused or duplicate keys.

Version your locale files alongside code.

Monitor when new UI changes introduce new keys—hook into linting or code reviews.

Fallback testing: simulate missing translations to ensure graceful degradation.

