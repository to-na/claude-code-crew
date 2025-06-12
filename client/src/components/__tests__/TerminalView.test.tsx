import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import TerminalView from '../TerminalView';
import { Session } from '../../../../shared/types';

// Mock xterm modules
const mockTerminal = {
  open: vi.fn(),
  write: vi.fn(),
  clear: vi.fn(),
  onData: vi.fn(),
  onResize: vi.fn(),
  dispose: vi.fn(),
  loadAddon: vi.fn(),
};

const mockFitAddon = {
  fit: vi.fn(),
};

const mockWebLinksAddon = {};

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => mockTerminal),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => mockFitAddon),
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn(() => mockWebLinksAddon),
}));

describe('TerminalView', () => {
  const mockSession: Session = {
    id: 'test-session-id',
    worktreePath: '/test/worktree',
    state: 'idle',
    lastActivity: new Date(),
  };

  const mockSocket = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockTerminal.open.mockClear();
    mockTerminal.write.mockClear();
    mockTerminal.clear.mockClear();
    mockTerminal.onData.mockClear();
    mockTerminal.onResize.mockClear();
    mockTerminal.dispose.mockClear();
    mockTerminal.loadAddon.mockClear();
    mockFitAddon.fit.mockClear();
  });

  it('should render terminal container', () => {
    const { container } = render(
      <TerminalView session={mockSession} socket={mockSocket} />
    );

    const terminalBox = container.querySelector('[class*="MuiBox-root"]');
    expect(terminalBox).toBeInTheDocument();
  });

  it('should initialize terminal on mount', async () => {
    const { Terminal } = await import('@xterm/xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    const { WebLinksAddon } = await import('@xterm/addon-web-links');

    render(<TerminalView session={mockSession} socket={mockSocket} />);

    expect(Terminal).toHaveBeenCalledWith(
      expect.objectContaining({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: expect.stringContaining('Monaco'),
      })
    );

    expect(FitAddon).toHaveBeenCalled();
    expect(WebLinksAddon).toHaveBeenCalled();
  });

  it('should setup socket event handlers', () => {
    render(<TerminalView session={mockSession} socket={mockSocket} />);

    expect(mockSocket.on).toHaveBeenCalledWith('session:output', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('session:restore', expect.any(Function));
    expect(mockSocket.emit).toHaveBeenCalledWith('session:restore', mockSession.id);
  });

  it('should handle terminal input', () => {
    render(<TerminalView session={mockSession} socket={mockSocket} />);

    // Get the onData callback
    const onDataCallback = mockTerminal.onData.mock.calls[0][0];
    onDataCallback('test input');

    expect(mockSocket.emit).toHaveBeenCalledWith('session:input', {
      sessionId: mockSession.id,
      input: 'test input',
    });
  });

  it('should handle terminal resize', () => {
    render(<TerminalView session={mockSession} socket={mockSocket} />);

    // Get the onResize callback
    const onResizeCallback = mockTerminal.onResize.mock.calls[0][0];
    onResizeCallback({ cols: 120, rows: 40 });

    expect(mockSocket.emit).toHaveBeenCalledWith('session:resize', {
      sessionId: mockSession.id,
      cols: 120,
      rows: 40,
    });
  });

  it('should handle session output', () => {
    render(<TerminalView session={mockSession} socket={mockSocket} />);

    const outputHandler = (mockSocket.on as any).mock.calls.find(
      (call: any[]) => call[0] === 'session:output'
    )?.[1] as Function;

    outputHandler({ sessionId: mockSession.id, data: 'test output' });

    expect(mockTerminal.write).toHaveBeenCalledWith('test output');
  });

  it('should handle session restore', () => {
    render(<TerminalView session={mockSession} socket={mockSocket} />);

    const restoreHandler = (mockSocket.on as any).mock.calls.find(
      (call: any[]) => call[0] === 'session:restore'
    )?.[1] as Function;

    restoreHandler({ sessionId: mockSession.id, history: 'previous output' });

    expect(mockTerminal.clear).toHaveBeenCalled();
    expect(mockTerminal.write).toHaveBeenCalledWith('previous output');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = render(
      <TerminalView session={mockSession} socket={mockSocket} />
    );

    unmount();

    expect(mockTerminal.dispose).toHaveBeenCalled();
    expect(mockSocket.off).toHaveBeenCalledWith('session:output', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('session:restore', expect.any(Function));
  });

  it('should handle window resize', () => {
    render(<TerminalView session={mockSession} socket={mockSocket} />);

    // Trigger window resize
    window.dispatchEvent(new Event('resize'));

    expect(mockFitAddon.fit).toHaveBeenCalled();
  });
});