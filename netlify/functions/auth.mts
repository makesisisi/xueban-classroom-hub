import { getStore } from '@netlify/blobs';
import {
  admin,
  AuthError,
  getUser,
  login,
  verifyRequestOrigin,
} from '@netlify/identity';
import type { Config } from '@netlify/functions';

const USERNAME_PATTERN = /^[\p{L}\p{N}_-]{3,24}$/u;

const json = (body: object, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    },
  });

const normalizeUsername = (value: unknown) =>
  typeof value === 'string' ? value.trim().normalize('NFKC').toLowerCase() : '';

const normalizeEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const readBody = async (request: Request) => {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new AuthError('请使用 JSON 请求', 415);
  if (Number(request.headers.get('content-length') || 0) > 4000)
    throw new AuthError('请求内容过长', 413);
  const raw = await request.text();
  if (raw.length > 4000) throw new AuthError('请求内容过长', 413);
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new AuthError('请求内容无效', 400);
  }
};

const handler = async (request: Request) => {
  try {
    if (request.method !== 'POST') return json({ error: '不支持的操作' }, 405);
    verifyRequestOrigin(request);
    const body = await readBody(request);
    const action = body.action;
    const password = typeof body.password === 'string' ? body.password : '';
    if (
      (action === 'register' || action === 'login') &&
      (password.length < 10 || password.length > 128)
    )
      throw new AuthError('密码需为 10–128 位', 422);

    const usernames = getStore({
      name: 'campus-usernames',
      consistency: 'strong',
    });

    if (action === 'register') {
      const username = normalizeUsername(body.username);
      const email = normalizeEmail(body.email);
      if (!USERNAME_PATTERN.test(username))
        throw new AuthError(
          '账号需为 3–24 位，可使用中英文、数字、下划线或短横线',
          422,
        );
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new AuthError('请填写有效邮箱', 422);

      const created = await admin.createUser({
        email,
        password,
        data: {
          user_metadata: {
            full_name: username,
            username,
          },
        },
      });
      try {
        const claimed = await usernames.setJSON(
          `username/${encodeURIComponent(username)}`,
          { userId: created.id, email, username },
          { onlyIfNew: true },
        );
        if (claimed.modified === false) {
          await admin.deleteUser(created.id);
          throw new AuthError('这个账号已经被使用，请换一个', 409);
        }
      } catch (error) {
        if (!(error instanceof AuthError)) await admin.deleteUser(created.id);
        throw error;
      }

      const user = await login(email, password);
      return json({
        ok: true,
        user: { id: user.id, email: user.email, name: user.name },
      });
    }

    if (action === 'login') {
      const identifier = normalizeUsername(body.identifier);
      if (!identifier) throw new AuthError('请输入账号或邮箱', 422);
      let email = normalizeEmail(body.identifier);
      if (!email.includes('@')) {
        const mapping = (await usernames.get(
          `username/${encodeURIComponent(identifier)}`,
          { type: 'json' },
        )) as { email?: string } | null;
        email = normalizeEmail(mapping?.email);
        if (!email) throw new AuthError('账号或密码不正确', 401);
      }
      const user = await login(email, password);
      return json({
        ok: true,
        user: { id: user.id, email: user.email, name: user.name },
      });
    }

    if (action === 'set-username') {
      const current = await getUser();
      if (!current) throw new AuthError('请先登录', 401);
      if (typeof current.userMetadata?.username === 'string')
        throw new AuthError('登录账号已经设置', 409);
      const username = normalizeUsername(body.username);
      if (!USERNAME_PATTERN.test(username))
        throw new AuthError(
          '账号需为 3–24 位，可使用中英文、数字、下划线或短横线',
          422,
        );
      const key = `username/${encodeURIComponent(username)}`;
      const claimed = await usernames.setJSON(
        key,
        { userId: current.id, email: current.email, username },
        { onlyIfNew: true },
      );
      if (claimed.modified === false)
        throw new AuthError('这个账号已经被使用，请换一个', 409);
      try {
        await admin.updateUser(current.id, {
          user_metadata: { ...current.userMetadata, username },
        });
      } catch (error) {
        await usernames.delete(key);
        throw error;
      }
      return json({ ok: true });
    }

    return json({ error: '不支持的操作' }, 400);
  } catch (error) {
    if (error instanceof AuthError) {
      const message =
        error.status === 401
          ? '账号或密码不正确'
          : error.message.includes('already') ||
              error.message.includes('registered')
            ? '这个邮箱已经注册，请直接登录'
            : error.message;
      return json({ error: message }, error.status || 400);
    }
    console.error('Auth function failed', error);
    return json({ error: '登录服务暂时不可用，请稍后重试' }, 500);
  }
};

export default handler;

export const config: Config = { path: '/api/auth' };
