'use client';

/**
 * The grown-ups' choices while a page is open, and the window that changes them.
 *
 * The server reads the saved choices and hands them in; this holds them for the
 * page, so sound, speaking and the language change at once everywhere. For the
 * owner or a Helper a change is sent to be saved and shows "Saved" only after
 * the app confirms it; on a refusal the old value comes back with the refusal's
 * words (`AGENTS.md` rule 4a). For a Member or a Viewer a change lasts only for
 * this visit and nothing is sent (`lib/play/roles.js`).
 */

import { Settings } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { StatusRow } from '@/components/ui/toggle-group';

import { t } from '../lib/i18n/index.js';

/** @typedef {{ soundOn: boolean, voiceOn: boolean, language: string, challenge: string }} Settings */
/** @typedef {{ level: string, favourite: boolean }} Choice */

const PlayContext = createContext(/** @type {any} */ (null));

/**
 * Sends one save and answers the saved value, or throws the refusal's message key.
 *
 * @param {string} address
 * @param {unknown} body
 */
async function send(address, body) {
  let response;
  try {
    response = await fetch(address, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new Error('error.saveFailed');
  }
  let answer = null;
  try {
    answer = await response.json();
  } catch {
    answer = null;
  }
  if (!response.ok) throw new Error(typeof answer?.problem === 'string' ? answer.problem : 'error.saveFailed');
  return answer;
}

/**
 * @param {{
 *   initialSettings: Settings,
 *   initialChoices: Record<string, Choice>,
 *   canChange: boolean,
 *   appLocale: 'en' | 'tr',
 *   children: any,
 * }} props
 */
export function PlaySettingsProvider({ initialSettings, initialChoices, canChange, appLocale, children }) {
  const [settings, setSettings] = useState(initialSettings);
  const [choices, setChoices] = useState(initialChoices);
  /** `{ key, tone }`: a short line about the last change ('saved' or 'problem'). */
  const [notice, setNotice] = useState(/** @type {{ key: string, tone: 'saved' | 'problem' } | null} */ (null));
  /** The grown-ups window is open: a game that moves on its own waits. */
  const [grownUpsOpen, setGrownUpsOpen] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const locale = settings.language === 'en' || settings.language === 'tr' ? settings.language : appLocale;

  // The page's language follows the chosen one, for screen readers and the browser's own words.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const changeSettings = useCallback(
    async (/** @type {Partial<Settings>} */ part) => {
      const before = settingsRef.current;
      const next = { ...before, ...part };
      setNotice(null);
      setSettings(next);
      if (!canChange) return;
      try {
        const answer = await send('/api/settings', next);
        setSettings(answer.settings);
        setNotice({ key: 'settings.saved', tone: 'saved' });
      } catch (error) {
        setSettings(before);
        setNotice({ key: error instanceof Error ? error.message : 'error.saveFailed', tone: 'problem' });
      }
    },
    [canChange],
  );

  const choicesRef = useRef(choices);
  choicesRef.current = choices;
  const changeChoice = useCallback(
    async (/** @type {string} */ gameId, /** @type {Partial<Choice>} */ part) => {
      const before = choicesRef.current[gameId] ?? { level: 'normal', favourite: false };
      const next = { ...before, ...part };
      setNotice(null);
      setChoices((all) => ({ ...all, [gameId]: next }));
      if (!canChange) return;
      try {
        const answer = await send('/api/choices', { gameId, level: next.level, favourite: next.favourite });
        setChoices((all) => ({ ...all, [gameId]: { level: answer.choice.level, favourite: answer.choice.favourite } }));
      } catch (error) {
        setChoices((all) => ({ ...all, [gameId]: before }));
        setNotice({ key: error instanceof Error ? error.message : 'error.saveFailed', tone: 'problem' });
      }
    },
    [canChange],
  );

  const value = useMemo(
    () => ({
      settings,
      settingsRef,
      choices,
      locale,
      appLocale,
      canChange,
      notice,
      changeSettings,
      changeChoice,
      clearNotice: () => setNotice(null),
      grownUpsOpen,
      setGrownUpsOpen,
    }),
    [settings, choices, locale, appLocale, canChange, notice, changeSettings, changeChoice, grownUpsOpen],
  );
  return <PlayContext.Provider value={value}>{children}</PlayContext.Provider>;
}

/** The choices and the ways to change them, inside a `PlaySettingsProvider`. */
export function usePlay() {
  const value = useContext(PlayContext);
  if (value === null) throw new Error('usePlay needs a PlaySettingsProvider');
  return value;
}

/** A short line about the last change that went wrong, near the top of the page. */
export function SaveProblem() {
  const { notice, locale } = usePlay();
  if (notice === null || notice.tone !== 'problem') return null;
  return (
    <p className="save-problem" role="alert">
      {t(notice.key, locale)}
    </p>
  );
}

/**
 * The "Grown-ups" button and its window.
 *
 * @param {{ compact?: boolean }} props  compact: the icon alone (the game bar)
 */
export function GrownUps({ compact = false }) {
  const { settings, locale, appLocale, canChange, notice, changeSettings, clearNotice, grownUpsOpen: open, setGrownUpsOpen: setOpen } = usePlay();
  const label = t('settings.open', locale);
  const appLanguage = t(`settings.language.${appLocale}`, locale);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) clearNotice();
      }}
    >
      <Button
        type="button"
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'icon-lg' : 'lg'}
        className={compact ? 'play-bar-button' : 'grown-ups-button'}
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
      >
        <Settings aria-hidden="true" />
        {compact ? null : <span>{label}</span>}
      </Button>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.title', locale)}</DialogTitle>
          <DialogDescription>{t('settings.intro', locale)}</DialogDescription>
        </DialogHeader>
        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-1">
          <div className="settings-row">
            <Label htmlFor="setting-sound">{t('settings.sound', locale)}</Label>
            <Switch id="setting-sound" checked={settings.soundOn} onCheckedChange={(checked) => changeSettings({ soundOn: checked })} />
          </div>
          <div className="settings-row">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="setting-voice">{t('settings.voice', locale)}</Label>
              <span className="settings-note">{t('settings.voiceNote', locale)}</span>
            </div>
            <Switch id="setting-voice" checked={settings.voiceOn} onCheckedChange={(checked) => changeSettings({ voiceOn: checked })} />
          </div>
          <div className="flex flex-col gap-2">
            {/* The switch cannot hold an empty value, so "follow the app" shows as 'app' and saves as ''. */}
            <span className="settings-label" id="setting-language">{t('settings.language', locale)}</span>
            <StatusRow
              label={t('settings.language', locale)}
              value={settings.language === '' ? 'app' : settings.language}
              onValueChange={(value) => changeSettings({ language: value === 'app' ? '' : value })}
              className="flex-wrap"
              options={[
                { value: 'app', label: t('settings.language.app', locale, { language: appLanguage }) },
                { value: 'en', label: t('settings.language.en', locale) },
                { value: 'tr', label: t('settings.language.tr', locale) },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="settings-label">{t('settings.challenge', locale)}</span>
            <StatusRow
              label={t('settings.challenge', locale)}
              value={settings.challenge}
              onValueChange={(challenge) => changeSettings({ challenge })}
              className="flex-wrap"
              options={['gentle', 'normal', 'strict'].map((value) => ({ value, label: t(`settings.challenge.${value}`, locale) }))}
            />
            <span className="settings-note">{t(`settings.challenge.${settings.challenge}.about`, locale)}</span>
          </div>
          {canChange ? null : <p className="settings-note">{t('settings.visitOnly', locale)}</p>}
          {notice !== null ? (
            <p className={notice.tone === 'saved' ? 'settings-saved' : 'save-problem'} role="status">
              {t(notice.key, locale)}
            </p>
          ) : null}
          <p className="settings-about">{t('settings.about', locale)}</p>
        </div>
        <DialogFooter>
          <Button type="button" size="lg" onClick={() => setOpen(false)}>
            {t('settings.close', locale)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
