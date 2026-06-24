/**
 * Sentry instrumentation entry point.
 *
 * Imported for its side effect as the **first** import in `index.ts`.
 *
 * It has to be a separate module rather than a call at the top of `index.ts`:
 * imports are hoisted, so a bare `initSentry()` between two import statements
 * still runs after every module in the file has been loaded — including the
 * ones Sentry needs to patch. A side-effect import keeps the ordering honest,
 * because module evaluation follows import order.
 */
import 'dotenv/config';
import { initSentry } from './sentry';

initSentry();
