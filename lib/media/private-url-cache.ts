import type { SupabaseClient } from "@supabase/supabase-js";

type CachedUrl = {
  url: string;
  expiresAt: number;
};

export class PrivateMediaUrlCache {
  private readonly urls = new Map<string, CachedUrl>();

  constructor(
    private readonly client: SupabaseClient,
    private readonly lifetimeSeconds: number,
    private readonly refreshBufferSeconds: number,
  ) {}

  private isUsable(entry?: CachedUrl) {
    return Boolean(
      entry &&
        entry.expiresAt - Date.now() >
          this.refreshBufferSeconds * 1000,
    );
  }

  async resolve(path: string, forceRefresh = false) {
    if (!forceRefresh) {
      const cached = this.urls.get(path);
      if (this.isUsable(cached)) return cached!.url;
    }
    const [resolved] = await this.resolveMany([path], forceRefresh);
    return resolved;
  }

  async resolveMany(paths: string[], forceRefresh = false) {
    const uniquePaths = [...new Set(paths)];
    const missing = uniquePaths.filter(
      (path) => forceRefresh || !this.isUsable(this.urls.get(path)),
    );
    if (missing.length > 0) {
      const result = await this.client.storage
        .from("memory-media")
        .createSignedUrls(missing, this.lifetimeSeconds);
      if (result.error) throw result.error;
      const expiresAt = Date.now() + this.lifetimeSeconds * 1000;
      result.data.forEach((item, index) => {
        if (item.error || !item.signedUrl) {
          throw item.error ?? new Error("A private media URL could not be created.");
        }
        this.urls.set(missing[index], {
          url: item.signedUrl,
          expiresAt,
        });
      });
    }
    return paths.map((path) => {
      const entry = this.urls.get(path);
      if (!entry) throw new Error("A private media URL could not be resolved.");
      return entry.url;
    });
  }

  invalidate(path: string) {
    this.urls.delete(path);
  }

  clear() {
    this.urls.clear();
  }
}
