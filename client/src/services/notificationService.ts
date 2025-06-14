export interface NotificationSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

const SETTINGS_KEY = 'claude-crew-notification-settings';

export class NotificationService {
  private static instance: NotificationService;
  private settings: NotificationSettings;
  private audioCache: Map<string, HTMLAudioElement> = new Map();

  private constructor() {
    this.settings = this.loadSettings();
    this.preloadAudio();
    // 初回アクセス時の権限チェック
    this.checkInitialPermission();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private loadSettings(): NotificationSettings {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      notificationsEnabled: true,
      soundEnabled: true,
    };
  }

  saveSettings(settings: NotificationSettings): void {
    this.settings = settings;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  private preloadAudio(): void {
    const stateToFile: Record<string, string> = {
      'idle': 'idle',
      'busy': 'busy',
      'waiting_input': 'wait_input'
    };
    
    Object.entries(stateToFile).forEach(([state, filename]) => {
      const audio = new Audio(`/sounds/${filename}.mp3`);
      audio.preload = 'auto';
      this.audioCache.set(state, audio);
    });
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  async notifyStateChange(
    worktreeName: string,
    newState: 'idle' | 'busy' | 'waiting_input',
    oldState?: string
  ): Promise<void> {
    console.log(`[NotificationService] State change: ${worktreeName} - ${oldState} -> ${newState}`);
    console.log(`[NotificationService] Settings:`, this.settings);
    
    if (this.settings.soundEnabled) {
      this.playSound(newState);
    }

    if (this.settings.notificationsEnabled && oldState && oldState !== newState) {
      const hasPermission = await this.requestNotificationPermission();
      console.log(`[NotificationService] Notification permission:`, hasPermission);
      if (hasPermission) {
        this.showNotification(worktreeName, newState);
      }
    }
  }

  private playSound(state: 'idle' | 'busy' | 'waiting_input'): void {
    const audio = this.audioCache.get(state);
    console.log(`[NotificationService] Playing sound for state: ${state}, audio found:`, !!audio);
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.error('[NotificationService] Failed to play audio:', err);
      });
    } else {
      console.error(`[NotificationService] No audio cached for state: ${state}`);
    }
  }

  private async checkInitialPermission(): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('[NotificationService] This browser does not support notifications');
      return;
    }

    console.log('[NotificationService] Initial notification permission:', Notification.permission);
    
    // 設定で通知が有効になっていて、権限がdefaultの場合は後でユーザーアクション時に要求する
    if (this.settings.notificationsEnabled && Notification.permission === 'default') {
      console.log('[NotificationService] Notification permission will be requested on user interaction');
    }
  }

  async requestNotificationPermissionWithUserAction(): Promise<boolean> {
    if (!this.settings.notificationsEnabled) {
      console.log('[NotificationService] Notifications are disabled in settings');
      return false;
    }

    const result = await this.requestNotificationPermission();
    console.log('[NotificationService] Permission request result:', result);
    return result;
  }

  private showNotification(worktreeName: string, state: 'idle' | 'busy' | 'waiting_input'): void {
    const stateMessages = {
      idle: 'セッションがアイドル状態になりました',
      busy: 'セッションがビジー状態になりました',
      waiting_input: 'セッションが入力待ち状態になりました',
    };

    const stateIcons = {
      idle: '😴',
      busy: '🚀',
      waiting_input: '❓',
    };

    console.log('[NotificationService] Creating notification:', {
      title: `Claude Crew - ${worktreeName}`,
      body: `${stateIcons[state]} ${stateMessages[state]}`,
      permission: Notification.permission
    });

    try {
      const notification = new Notification(`Claude Crew - ${worktreeName}`, {
        body: `${stateIcons[state]} ${stateMessages[state]}`,
        icon: '/favicon.ico',
        tag: `state-change-${worktreeName}`,
        requireInteraction: false,
      });
      
      console.log('[NotificationService] Notification created successfully');
      
      // 通知がクリックされた時の処理
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      
      // 3秒後に自動で閉じる
      setTimeout(() => {
        notification.close();
      }, 3000);
      
    } catch (error) {
      console.error('[NotificationService] Failed to create notification:', error);
    }
  }
}