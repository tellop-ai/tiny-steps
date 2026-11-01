import { buttonVariants } from '@/components/ui/button';

import { BACK_TO_OWNER, currentPerson } from '../lib/data/person.js';
import { getLocale, t } from '../lib/i18n/index.js';

import './globals.css';

export function generateMetadata() {
  const locale = getLocale();
  return { title: t('app.title', locale) };
}

/**
 * Whether the owner is looking at the games as a Member or a Viewer. Only then
 * is the way back drawn; a host that cannot say who is playing draws none.
 */
async function inPreview() {
  try {
    return (await currentPerson()).preview === true;
  } catch {
    return false;
  }
}

export default async function RootLayout({ children }) {
  const locale = getLocale();
  const preview = await inPreview();
  return (
    <html lang={locale}>
      <body>
        {children}
        {preview ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
            <a
              href={BACK_TO_OWNER}
              className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'pointer-events-auto h-11 px-4 text-base shadow-md' })}
            >
              {t('preview.back', locale)}
            </a>
          </div>
        ) : null}
      </body>
    </html>
  );
}
