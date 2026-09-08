import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { d1Store } from '@/lib/d1-store';
import { handle } from '@/lib/service';
export const dynamic = 'force-dynamic';
async function route(req: Request) {
  const user = await getChatGPTUser();
  return handle(req, {
    store: d1Store(env.DB),
    files: {
      async put(key, data) {
        await (env as unknown as { FILES: R2Bucket }).FILES.put(key, data);
      },
      async get(key) {
        const object = await (env as unknown as { FILES: R2Bucket }).FILES.get(
          key,
        );
        return object ? object.arrayBuffer() : null;
      },
      async delete(key) {
        await (env as unknown as { FILES: R2Bucket }).FILES.delete(key);
      },
    },
    identity: user
      ? { id: user.userId, name: user.displayName, email: user.email }
      : null,
    provider: 'sites',
    setupSecret: (env as unknown as Record<string, string>).ADMIN_SETUP_SECRET,
  });
}
export { route as GET, route as POST };
