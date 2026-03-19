import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EmptyState } from '@/components/ui/EmptyState';
import { SpeechPlaybackButton } from '@/components/ui/SpeechPlaybackButton';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EmptyState', () => {
  it('renders accessible fallback content', () => {
    render(<EmptyState title="Vuoto" description="Nessun dato disponibile." />);

    expect(screen.getByRole('heading', { name: 'Vuoto' })).toBeInTheDocument();
    expect(screen.getByText('Nessun dato disponibile.')).toBeInTheDocument();
  });
});

describe('SpeechPlaybackButton', () => {
  it('starts speech playback when supported', () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string;
        lang = '';
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;

        constructor(text: string) {
          this.text = text;
        }
      },
    );

    render(<SpeechPlaybackButton text="Mescola e servi." />);

    fireEvent.click(screen.getByRole('button', { name: 'Ascolta descrizione' }));

    expect(speak).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when speech synthesis is unavailable', () => {
    vi.stubGlobal('speechSynthesis', undefined);

    const { container } = render(<SpeechPlaybackButton text="Mescola e servi." />);

    expect(container).toBeEmptyDOMElement();
  });
});
