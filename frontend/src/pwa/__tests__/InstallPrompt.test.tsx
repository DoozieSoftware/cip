import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { InstallPrompt } from '../InstallPrompt';

class FakeBeforeInstallPromptEvent extends Event {
  public platforms: string[] = ['web'];
  public userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  private promptResult: { outcome: 'accepted' | 'dismissed'; platform: string };

  constructor(outcome: 'accepted' | 'dismissed' = 'accepted') {
    super('beforeinstallprompt');
    this.promptResult = { outcome, platform: 'web' };
    this.userChoice = Promise.resolve(this.promptResult);
  }

  prompt(): Promise<void> {
    return Promise.resolve();
  }
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* jsdom may not have it */ }
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders nothing when no beforeinstallprompt event has fired', () => {
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the prompt after beforeinstallprompt fires', () => {
    render(<InstallPrompt />);
    const event = new FakeBeforeInstallPromptEvent();
    act(() => { window.dispatchEvent(event); });

    expect(screen.getByRole('dialog', { name: /install civic intelligence platform/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^install$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument();
  });

  it('does not show the prompt when previously dismissed within 7 days', () => {
    const recent = String(Date.now() - 1000 * 60 * 60); // 1 hour ago
    try { localStorage.setItem('cip.pwa.installPrompt.dismissedAt', recent); } catch { /* */ }

    render(<InstallPrompt />);
    act(() => { window.dispatchEvent(new FakeBeforeInstallPromptEvent()); });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides the dialog and records a dismissal when "Not now" is clicked', () => {
    render(<InstallPrompt />);
    act(() => { window.dispatchEvent(new FakeBeforeInstallPromptEvent()); });

    fireEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    let stored: string | null = null;
    try { stored = localStorage.getItem('cip.pwa.installPrompt.dismissedAt'); } catch { /* */ }
    expect(stored).not.toBeNull();
  });

  it('calls prompt() and hides the dialog when Install is clicked', async () => {
    const promptSpy = vi.spyOn(FakeBeforeInstallPromptEvent.prototype, 'prompt');

    render(<InstallPrompt />);
    const event = new FakeBeforeInstallPromptEvent();
    act(() => { window.dispatchEvent(event); });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^install$/i }));
      // wait for the promise chain in onInstall to settle
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(promptSpy).toHaveBeenCalled();

    // dialog should be hidden
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides the dialog when the app is already installed (standalone display mode)', () => {
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          matches: true,
          media: '(display-mode: standalone)',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    );

    render(<InstallPrompt />);
    act(() => { window.dispatchEvent(new FakeBeforeInstallPromptEvent()); });
    expect(screen.queryByRole('dialog')).toBeNull();

    matchMediaSpy.mockRestore();
  });
});
