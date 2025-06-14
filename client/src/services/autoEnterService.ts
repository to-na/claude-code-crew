export interface AutoEnterSettings {
  globalEnabled: boolean;
  perWorktreeSettings: Record<string, boolean>;
}

const AUTO_ENTER_SETTINGS_KEY = 'claude-crew-auto-enter-settings';

export class AutoEnterService {
  private static instance: AutoEnterService;
  private settings: AutoEnterSettings;

  private constructor() {
    this.settings = this.loadSettings();
  }

  static getInstance(): AutoEnterService {
    if (!AutoEnterService.instance) {
      AutoEnterService.instance = new AutoEnterService();
    }
    return AutoEnterService.instance;
  }

  private loadSettings(): AutoEnterSettings {
    const stored = localStorage.getItem(AUTO_ENTER_SETTINGS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          globalEnabled: parsed.globalEnabled ?? false,
          perWorktreeSettings: parsed.perWorktreeSettings ?? {},
        };
      } catch (error) {
        console.error('[AutoEnterService] Failed to parse stored settings:', error);
      }
    }
    return {
      globalEnabled: false,
      perWorktreeSettings: {},
    };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(AUTO_ENTER_SETTINGS_KEY, JSON.stringify(this.settings));
      console.log('[AutoEnterService] Settings saved:', this.settings);
    } catch (error) {
      console.error('[AutoEnterService] Failed to save settings:', error);
    }
  }

  getSettings(): AutoEnterSettings {
    return { ...this.settings };
  }

  getGlobalEnabled(): boolean {
    return this.settings.globalEnabled;
  }

  getDelayMs(): number {
    return 3000; // 固定3秒
  }

  /**
   * ワークツリー用の自動Enter設定を取得
   * グローバル設定が無効の場合は常にfalse
   * グローバル設定が有効の場合、ワークツリー個別設定を参照（デフォルトtrue）
   */
  getWorktreeSetting(worktreePath: string): boolean {
    if (!this.settings.globalEnabled) {
      return false;
    }
    
    // ワークツリー個別設定が存在しない場合はデフォルトでtrue
    return this.settings.perWorktreeSettings[worktreePath] ?? true;
  }

  /**
   * グローバル設定を変更
   * 有効にした場合、すべてのワークツリー設定をtrueに上書き
   */
  setGlobalEnabled(enabled: boolean): void {
    console.log('[AutoEnterService] Setting global enabled:', enabled);
    this.settings.globalEnabled = enabled;
    
    if (enabled) {
      // グローバル設定を有効にした場合、すべてのワークツリー設定をtrueに上書き
      const updatedPerWorktreeSettings: Record<string, boolean> = {};
      Object.keys(this.settings.perWorktreeSettings).forEach(path => {
        updatedPerWorktreeSettings[path] = true;
      });
      this.settings.perWorktreeSettings = updatedPerWorktreeSettings;
      console.log('[AutoEnterService] Reset all worktree settings to enabled');
    }
    
    this.saveSettings();
  }


  /**
   * ワークツリー個別設定を変更
   * グローバル設定が無効の場合は設定を保存しない
   */
  setWorktreeSetting(worktreePath: string, enabled: boolean): void {
    if (!this.settings.globalEnabled) {
      console.warn('[AutoEnterService] Cannot set worktree setting when global is disabled');
      return;
    }
    
    console.log('[AutoEnterService] Setting worktree setting:', worktreePath, enabled);
    this.settings.perWorktreeSettings[worktreePath] = enabled;
    this.saveSettings();
  }

  /**
   * 指定されたワークツリーの自動Enter機能が有効かどうかを判定
   */
  shouldAutoEnter(worktreePath: string): boolean {
    const enabled = this.getWorktreeSetting(worktreePath);
    console.log('[AutoEnterService] Should auto enter for', worktreePath, ':', enabled);
    return enabled;
  }

  /**
   * ワークツリーをリストに追加（デフォルト設定で初期化）
   */
  addWorktree(worktreePath: string): void {
    if (!(worktreePath in this.settings.perWorktreeSettings)) {
      this.settings.perWorktreeSettings[worktreePath] = true;
      this.saveSettings();
      console.log('[AutoEnterService] Added worktree:', worktreePath);
    }
  }

  /**
   * ワークツリーをリストから削除
   */
  removeWorktree(worktreePath: string): void {
    if (worktreePath in this.settings.perWorktreeSettings) {
      delete this.settings.perWorktreeSettings[worktreePath];
      this.saveSettings();
      console.log('[AutoEnterService] Removed worktree:', worktreePath);
    }
  }

  /**
   * すべてのワークツリー設定を取得
   */
  getAllWorktreeSettings(): Record<string, boolean> {
    return { ...this.settings.perWorktreeSettings };
  }
}