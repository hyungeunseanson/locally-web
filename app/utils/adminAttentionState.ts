import type { AdminInquiryActivity } from './adminInquiryActivity';

export type AttentionConversation = AdminInquiryActivity & {
  surface: 'support' | 'phone' | 'monitor';
  last_message_id: string;
};
export type AttentionSnapshot = {
  conversations: Record<string, AttentionConversation>;
  adminAlertsUnread: number | null;
  appsCount: number; expsCount: number; pendingBookingCount: number; svcBankPendingCount: number;
  ready: boolean; error: string | null;
};
export const EMPTY_ATTENTION: AttentionSnapshot = {
  conversations: {}, adminAlertsUnread: null, appsCount: 0, expsCount: 0,
  pendingBookingCount: 0, svcBankPendingCount: 0, ready: false, error: null,
};
export function attentionTotals(snapshot: AttentionSnapshot) {
  const counts = { support: 0, phone: 0, monitor: 0, total: 0 };
  for (const row of Object.values(snapshot.conversations)) {
    if (Number(row.admin_unread_count) > 0) { counts[row.surface]++; counts.total++; }
  }
  return counts;
}

// One user-scoped store per admin layout, shared by desktop/mobile sidebar and tabs.
// No browser persistence: admin-seen state is owned by PostgreSQL.
export class AdminAttentionStore {
  private snapshot = EMPTY_ATTENTION;
  private listeners = new Set<() => void>();
  private revisions = new Map<string, number>();
  private revision = 0;
  private fullRunning = false;
  private fullAgain = false;
  private deltaRunning = false;
  private dirty = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private alertsTimer: ReturnType<typeof setTimeout> | null = null;
  private alertsRevision = 0;
  private stopped = false;
  constructor(private request: typeof fetch = fetch, readonly userId: string = '') {}
  start() { this.stopped = false; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  version = (id: string) => this.revisions.get(id) ?? 0;
  private commit(patch: Partial<AttentionSnapshot>) {
    if (this.stopped) return;
    this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener());
  }
  private async read(url: string) {
    // Native browser fetch must not receive the store as its receiver.
    const request = this.request;
    const response = await request(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error('관리자 표시를 갱신하지 못했습니다.');
    return result.data;
  }
  refresh = async () => {
    if (this.stopped) return;
    if (this.fullRunning) { this.fullAgain = true; return; }
    this.fullRunning = true;
    try {
      do {
        this.fullAgain = false;
        try {
          const revision = this.revision, alertsRevision = this.alertsRevision;
          const data = await this.read('/api/admin/sidebar-counts');
          if (this.stopped) return;
          if (revision !== this.revision || alertsRevision !== this.alertsRevision) { this.fullAgain = true; continue; }
          this.commit({ ...data, conversations: Object.fromEntries((data.conversations as AttentionConversation[]).map(row => [String(row.inquiry_id), row])), ready: true, error: null });
        } catch (error) {
          this.commit({ error: error instanceof Error ? error.message : '표시 갱신 실패' });
          // A successful action may have queued a refresh while this older GET
          // was pending. Honor that explicit request even when the older GET fails.
        }
      } while (this.fullAgain && !this.stopped);
    }
    finally { this.fullRunning = false; }
  };
  changed = (id: number | string) => {
    const key = String(id);
    this.revision++; this.revisions.set(key, this.version(key) + 1); this.dirty.add(key);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.flushConversations(); }, 250);
  };
  private async flushConversations() {
    if (this.deltaRunning || this.stopped || !this.dirty.size) return;
    this.deltaRunning = true;
    try {
      while (this.dirty.size && !this.stopped) {
        const ids = [...this.dirty].slice(0, 100); ids.forEach(id => this.dirty.delete(id));
        const versions = new Map(ids.map(id => [id, this.version(id)]));
        const data = await this.read(`/api/admin/sidebar-counts?scope=conversations&inquiryIds=${ids.join(',')}`);
        const conversations = { ...this.snapshot.conversations };
        for (const id of ids) {
          if (versions.get(id) !== this.version(id)) { this.dirty.add(id); continue; }
          const row = (data.conversations as AttentionConversation[]).find(row => String(row.inquiry_id) === id);
          if (row) conversations[id] = row; else delete conversations[id];
        }
        this.commit({ conversations, error: null });
      }
    } catch (error) { this.commit({ error: error instanceof Error ? error.message : '표시 갱신 실패' }); }
    finally { this.deltaRunning = false; }
  }
  applyAcknowledgement(id: string, remaining: number, capturedVersion: number) {
    if (capturedVersion !== this.version(id)) { this.changed(id); return; }
    // Invalidates an already-running GET even when ACK produces no Realtime event.
    this.revision++; this.revisions.set(id, this.version(id) + 1);
    const row = this.snapshot.conversations[id];
    if (row) this.commit({ conversations: { ...this.snapshot.conversations, [id]: { ...row, admin_unread_count: remaining } } });
  }
  alertsChanged = () => {
    this.alertsRevision++;
    if (this.alertsTimer) clearTimeout(this.alertsTimer);
    this.alertsTimer = setTimeout(() => { this.alertsTimer = null; void this.refreshAlerts(); }, 250);
  };
  private async refreshAlerts() {
    const version = this.alertsRevision;
    try {
      const data = await this.read('/api/admin/sidebar-counts?scope=alerts');
      if (version === this.alertsRevision) this.commit({ adminAlertsUnread: data.adminAlertsUnread, error: null });
      else this.alertsChanged();
    } catch (error) { this.commit({ error: error instanceof Error ? error.message : '알림 갱신 실패' }); }
  }
  stop() { this.stopped = true; if (this.timer) clearTimeout(this.timer); if (this.alertsTimer) clearTimeout(this.alertsTimer); }
}
