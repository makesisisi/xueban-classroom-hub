import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import type { Config } from '@netlify/functions';
import { handle, type Store, type RecordData } from '../../lib/service';
export default async (req: Request) => {
  const blobs = getStore({ name: 'campus-records', consistency: 'strong' });
  const store: Store = {
    async get(key) {
      return (await blobs.get(key, { type: 'json' })) as RecordData | null;
    },
    async list(prefix) {
      const { blobs: keys } = await blobs.list({ prefix });
      const values: RecordData[] = [];
      for (let i = 0; i < keys.length; i += 20) {
        const batch = await Promise.all(
          keys.slice(i, i + 20).map((k) => store.get(k.key)),
        );
        values.push(...batch.filter((x): x is RecordData => !!x));
      }
      return values;
    },
    async put(key, value, expected) {
      let condition:
        | { onlyIfNew: true; onlyIfMatch?: never }
        | { onlyIfMatch: string; onlyIfNew?: never }
        | { onlyIfNew?: never; onlyIfMatch?: never } = {};
      if (expected === null) condition = { onlyIfNew: true };
      else if (expected !== undefined) {
        const old = await blobs.getWithMetadata(key, { type: 'json' });
        if (!old || !old.etag || (old.data as RecordData).version !== expected)
          return false;
        condition = { onlyIfMatch: old.etag };
      }
      const result = await blobs.setJSON(key, value, condition);
      if (result.modified === false) return false;
      const check = await store.get(key);
      if (check?.version !== value.version)
        throw new Error('Write verification failed');
      return true;
    },
  };
  const user = await getUser();
  const files = getStore({ name: 'campus-attachments', consistency: 'strong' });
  return handle(req, {
    store,
    files: {
      async put(key, data) {
        await files.set(key, data);
      },
      async get(key) {
        return files.get(key, { type: 'arrayBuffer' });
      },
      async delete(key) {
        await files.delete(key);
      },
    },
    provider: 'netlify',
    identity: user
      ? {
          id: user.id,
          name: user.name || user.email || '同学',
          email: user.email || '',
          username:
            typeof user.userMetadata?.username === 'string'
              ? user.userMetadata.username
              : undefined,
        }
      : null,
    setupSecret: Netlify.env.get('ADMIN_SETUP_SECRET'),
  });
};
export const config: Config = { path: '/api/campus' };
