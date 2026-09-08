export type RecordData = {
  id: string;
  version: string;
  createdAt: string;
  [key: string]: any;
};
export interface Store {
  get(key: string): Promise<RecordData | null>;
  list(prefix: string): Promise<RecordData[]>;
  put(
    key: string,
    value: RecordData,
    expected?: string | null,
  ): Promise<boolean>;
}
export type Identity = {
  id: string;
  name: string;
  email: string;
  username?: string;
} | null;
export type Runtime = {
  store: Store;
  identity: Identity;
  provider: 'sites' | 'netlify';
  setupSecret?: string;
};
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
const text = (v: unknown, name: string, max = 200, optional = false) => {
  if (typeof v !== 'string') {
    if (optional && v == null) return '';
    return fail(400, `${name}格式不正确`);
  }
  const s = v.trim();
  if ((!optional && !s) || s.length > max)
    return fail(400, `${name}需填写 1–${max} 个字符`);
  return s;
};
const fresh = (id: string, data: object): RecordData => ({
  ...data,
  id,
  version: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
});
const safeMember = (p: RecordData) => ({
  id: p.id,
  name: p.name,
  studentId: p.studentId,
  createdAt: p.createdAt,
});
async function secretMatches(a: string, b: string) {
  const hash = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
    );
  const [x, y] = await Promise.all([hash(a), hash(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
export async function handle(
  request: Request,
  runtime: Runtime,
): Promise<Response> {
  const { store, identity, provider } = runtime;
  const respond = (data: object, status = 200) =>
    Response.json(data, {
      status,
      headers: {
        'Cache-Control': 'no-store, private',
        Vary: 'Cookie, Authorization',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  try {
    if (!['GET', 'POST'].includes(request.method))
      return fail(405, '不支持的操作');
    if (request.method === 'POST') {
      const origin = request.headers.get('origin');
      if (!origin || origin !== new URL(request.url).origin)
        return fail(403, '请求来源不受信任，请刷新页面重试');
      if (!request.headers.get('content-type')?.includes('application/json'))
        return fail(415, '请使用 JSON 请求');
      if (Number(request.headers.get('content-length') || 0) > 24000)
        return fail(413, '内容过长');
    }
    const owner = await store.get('config/owner');
    const settings = await store.get('config/settings');
    const profile = identity ? await store.get(`member/${identity.id}`) : null;
    const isAdmin = !!identity && owner?.userId === identity.id;
    const isMember = !!profile || isAdmin;
    if (request.method === 'GET') {
      const base: any = {
        provider,
        identity: identity
          ? {
              id: identity.id,
              name: identity.name,
              email: identity.email,
              username: identity.username,
            }
          : null,
        profile,
        isAdmin,
        needsSetup: !owner,
        settings: {
          className: settings?.className || '我们的班级',
          semester: settings?.semester || '2026 · 秋季学期',
        },
        assignments: [],
        teachers: [],
        posts: [],
        notices: [],
        submissions: [],
        comments: [],
      };
      if (!isMember) return respond(base);
      const [tasks, teachers, posts, notices, submissions, comments] =
        await Promise.all(
          [
            'assignment/',
            'teacher/',
            'post/',
            'notice/',
            'submission/',
            'comment/',
          ].map((p) => store.list(p)),
        );
      base.assignments = tasks
        .filter((x) => !x.archived || isAdmin)
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
      base.teachers = teachers.filter((x) => !x.archived || isAdmin);
      base.notices = notices
        .filter((x) => !x.archived || isAdmin)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      base.posts = posts
        .filter(
          (x) =>
            isAdmin || x.status === 'published' || x.authorId === identity?.id,
        )
        .map((x) =>
          isAdmin
            ? x
            : {
                ...x,
                authorId: undefined,
                authorName: x.anonymous ? '匿名同学' : x.authorName,
                mine: x.authorId === identity?.id,
              },
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      base.submissions = submissions.filter(
        (x) => isAdmin || x.userId === identity?.id,
      );
      const visiblePostIds = new Set(base.posts.map((p: RecordData) => p.id));
      base.comments = comments
        .filter((x) => visiblePostIds.has(x.postId))
        .map((x) => (isAdmin ? x : { ...x, authorId: undefined }));
      if (isAdmin) {
        base.members = (await store.list('member/')).map(safeMember);
        base.settings = {
          ...base.settings,
          joinCode: settings?.joinCode || '',
          version: settings?.version,
        };
      }
      return respond(base);
    }
    if (!identity) return fail(401, '请先登录');
    const raw = await request.text();
    if (raw.length > 24000) return fail(413, '内容过长');
    let b: any;
    try {
      b = JSON.parse(raw);
    } catch {
      return fail(400, '请求内容无效');
    }
    if (!b || typeof b !== 'object' || Array.isArray(b))
      return fail(400, '请求内容无效');
    const action = text(b.action, '操作', 40);
    if (action === 'claim-admin') {
      if (owner) return fail(409, '管理员已设置，请联系当前学委');
      if (
        !runtime.setupSecret ||
        !(await secretMatches(
          text(b.code, '初始化码', 160),
          runtime.setupSecret,
        ))
      )
        return fail(403, '初始化码不正确');
      const data = fresh('owner', { userId: identity.id });
      if (!(await store.put('config/owner', data, null)))
        return fail(409, '管理员已设置');
      return respond({ ok: true });
    }
    if (action === 'join') {
      const name = text(b.name, '姓名', 30),
        studentId = text(b.studentId, '学号', 40);
      if (
        !isMember &&
        (!settings?.joinCode ||
          !(await secretMatches(
            text(b.code, '班级邀请码', 80),
            settings.joinCode,
          )))
      )
        return fail(403, '班级邀请码不正确，请向学委索取');
      const item = fresh(identity.id, { name, studentId });
      if (
        !(await store.put(
          `member/${identity.id}`,
          item,
          profile?.version ?? null,
        ))
      )
        return fail(409, '资料已变化，请刷新重试');
      return respond({ ok: true });
    }
    if (!isMember) return fail(403, '请先使用邀请码加入班级');
    if (action === 'settings') {
      if (!isAdmin) return fail(403, '仅管理员可修改班级设置');
      const joinCode = text(b.joinCode, '邀请码', 80);
      if (joinCode.length < 8) return fail(400, '邀请码至少需要 8 个字符');
      const item = fresh('settings', {
        className: text(b.className, '班级名称', 60),
        semester: text(b.semester, '学期', 60),
        joinCode,
      });
      if (
        !(await store.put('config/settings', item, settings?.version ?? null))
      )
        return fail(409, '设置已变化，请刷新重试');
      return respond({ ok: true });
    }
    if (action === 'save') {
      if (!isAdmin) return fail(403, '仅管理员可发布和修改');
      const kind = text(b.kind, '分类', 30);
      if (!['teacher', 'assignment', 'notice'].includes(kind))
        return fail(400, '分类无效');
      const id = b.id ? text(b.id, '编号', 100) : crypto.randomUUID();
      if (!/^[\w-]+$/.test(id)) return fail(400, '编号无效');
      const old = await store.get(`${kind}/${id}`);
      if (b.id && !old) return fail(404, '记录不存在');
      if (old && b.version !== old.version)
        return fail(409, '记录已更新，请刷新后再修改');
      const d = b.data || {};
      let values: any;
      if (kind === 'teacher')
        values = {
          name: text(d.name, '老师姓名', 30),
          course: text(d.course, '授课科目', 80),
          contact: text(d.contact, '联系方式', 300, true),
          office: text(d.office, '办公室 / 答疑时间', 200, true),
          tips: text(d.tips, '上课小技巧', 3000, true),
        };
      else if (kind === 'assignment') {
        const due = text(d.dueAt, '截止时间', 50);
        if (!Number.isFinite(Date.parse(due))) return fail(400, '截止时间无效');
        values = {
          title: text(d.title, '作业名称', 120),
          course: text(d.course, '课程', 80),
          description: text(d.description, '作业要求', 4000),
          dueAt: new Date(due).toISOString(),
          allowLate: d.allowLate === true,
        };
      } else
        values = {
          title: text(d.title, '公告标题', 120),
          body: text(d.body, '公告内容', 5000),
          category: text(d.category || '班级通知', '公告分类', 30),
        };
      const item = fresh(id, { ...values, archived: old?.archived ?? false });
      if (old) item.createdAt = old.createdAt;
      if (!(await store.put(`${kind}/${id}`, item, old?.version ?? null)))
        return fail(409, '记录已变化，请刷新重试');
      return respond({ ok: true, id });
    }
    if (action === 'archive') {
      if (!isAdmin) return fail(403, '仅管理员可归档');
      if (!['teacher', 'assignment', 'notice'].includes(b.kind))
        return fail(400, '分类无效');
      const id = text(b.id, '编号', 100);
      const key = `${b.kind}/${id}`,
        old = await store.get(key);
      if (!old) return fail(404, '记录不存在');
      if (b.version !== old.version) return fail(409, '记录已更新，请刷新');
      if (
        !(await store.put(
          key,
          {
            ...old,
            archived: b.archived === true,
            version: crypto.randomUUID(),
          },
          old.version,
        ))
      )
        return fail(409, '记录已变化，请重试');
      return respond({ ok: true });
    }
    if (action === 'submit') {
      const id = text(b.assignmentId, '作业编号', 100),
        task = await store.get(`assignment/${id}`);
      if (!task || task.archived) return fail(404, '作业不存在或已归档');
      const late = Date.now() > Date.parse(task.dueAt);
      if (late && !task.allowLate)
        return fail(400, '作业已截止，学委尚未开放补交');
      const link = text(b.link, '作业链接', 1000, true);
      if (link) {
        try {
          if (new URL(link).protocol !== 'https:')
            return fail(400, '作业链接必须以 https:// 开头');
        } catch {
          return fail(400, '请输入有效的 HTTPS 链接');
        }
      }
      const note = text(b.note, '提交说明', 2000, true);
      const key = `submission/${id}_${identity.id}`,
        old = await store.get(key);
      const item = fresh(`${id}_${identity.id}`, {
        assignmentId: id,
        userId: identity.id,
        name: profile?.name || identity.name,
        studentId: profile?.studentId || '',
        note,
        link,
        late,
      });
      if (!(await store.put(key, item, old?.version ?? null)))
        return fail(409, '打卡正在更新，请刷新');
      return respond({ ok: true, id: item.id });
    }
    if (action === 'post') {
      if (!profile) return fail(403, '请先完善姓名和学号');
      const category = text(b.category, '分类', 20);
      if (!['学习提问', '经验分享', '小吐槽'].includes(category))
        return fail(400, '分类无效');
      const item = fresh(crypto.randomUUID(), {
        title: text(b.title, '标题', 100),
        body: text(b.body, '内容', 3000),
        category,
        anonymous: b.anonymous === true,
        authorId: identity.id,
        authorName: profile.name,
        status: isAdmin ? 'published' : 'pending',
      });
      await store.put(`post/${item.id}`, item, null);
      return respond({ ok: true, id: item.id });
    }
    if (action === 'moderate') {
      if (!isAdmin) return fail(403, '仅管理员可审核');
      if (!['published', 'rejected'].includes(b.status))
        return fail(400, '审核状态无效');
      const key = `post/${text(b.id, '帖子编号', 100)}`,
        old = await store.get(key);
      if (!old) return fail(404, '帖子不存在');
      if (
        !(await store.put(
          key,
          { ...old, status: b.status, version: crypto.randomUUID() },
          old.version,
        ))
      )
        return fail(409, '帖子已变化，请刷新');
      return respond({ ok: true });
    }
    if (action === 'comment') {
      if (!profile) return fail(403, '请先完善个人资料');
      const post = await store.get(`post/${text(b.postId, '帖子编号', 100)}`);
      if (!post || post.status !== 'published')
        return fail(404, '帖子不可回复');
      const item = fresh(crypto.randomUUID(), {
        postId: post.id,
        body: text(b.body, '回复', 1000),
        authorId: identity.id,
        authorName: profile.name,
      });
      await store.put(`comment/${item.id}`, item, null);
      return respond({ ok: true });
    }
    return fail(400, '未知操作');
  } catch (e) {
    if (e instanceof HttpError) return respond({ error: e.message }, e.status);
    console.error(
      'Campus request failed',
      e instanceof Error ? e.name : 'UnknownError',
    );
    return respond({ error: '服务暂时不可用，请稍后重试' }, 503);
  }
}
