import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(
  fs.readFileSync(new URL('../lib/service.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  },
).outputText;
const { handle } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
const admin = { id: 'owner', name: '学委', email: 'owner@example.invalid' },
  student = { id: 'student', name: '同学甲', email: 'student@example.invalid' },
  other = { id: 'other', name: '同学乙', email: 'other@example.invalid' };
function fixture() {
  const records = new Map();
  const binaries = new Map();
  const files = {
    async put(key, value) {
      binaries.set(key, value.slice(0));
    },
    async get(key) {
      return binaries.get(key)?.slice(0) || null;
    },
    async delete(key) {
      binaries.delete(key);
    },
  };
  const store = {
    async get(k) {
      return structuredClone(records.get(k) || null);
    },
    async list(p) {
      return [...records.entries()]
        .filter(([k]) => k.startsWith(p))
        .map(([, v]) => structuredClone(v));
    },
    async put(k, v, expected) {
      const old = records.get(k);
      if (expected === null && old) return false;
      if (typeof expected === 'string' && old?.version !== expected)
        return false;
      records.set(k, structuredClone(v));
      return true;
    },
  };
  const call = async (user, body, origin = 'https://campus.test') => {
    const req = new Request(
      'https://campus.test/api/campus',
      body === undefined
        ? {}
        : {
            method: 'POST',
            headers: { origin, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
    );
    const res = await handle(req, {
      store,
      files,
      identity: user,
      provider: 'sites',
      setupSecret: 'test-secret-only',
    });
    return { status: res.status, data: await res.json() };
  };
  const upload = async (
    user,
    payload,
    attachments = [],
    origin = 'https://campus.test',
  ) => {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    for (const file of attachments) form.append('files', file);
    const response = await handle(
      new Request('https://campus.test/api/campus', {
        method: 'POST',
        headers: { origin },
        body: form,
      }),
      { store, files, identity: user, provider: 'sites' },
    );
    return { status: response.status, data: await response.json() };
  };
  const download = (user, submission, attachment) =>
    handle(
      new Request(
        `https://campus.test/api/campus?submission=${encodeURIComponent(submission)}&attachment=${encodeURIComponent(attachment)}`,
      ),
      { store, files, identity: user, provider: 'sites' },
    );
  return { call, store, records, binaries, files, upload, download };
}
async function setup() {
  const f = fixture();
  assert.equal(
    (await f.call(admin, { action: 'claim-admin', code: 'test-secret-only' }))
      .status,
    200,
  );
  await f.call(admin, {
    action: 'settings',
    className: '测试班',
    semester: '秋季',
    joinCode: 'class-code-123',
  });
  for (const u of [admin, student, other])
    await f.call(u, {
      action: 'join',
      name: u.name,
      studentId: u.id,
      code: 'class-code-123',
    });
  return f;
}
async function assignment(f, extra = {}) {
  const r = await f.call(admin, {
    action: 'save',
    kind: 'assignment',
    data: {
      title: '高数练习',
      course: '高等数学',
      description: '完成第一章',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      allowLate: true,
      ...extra,
    },
  });
  assert.equal(r.status, 200);
  return r.data.id;
}

test('file-only submission round-trips exact bytes without a URL; downloads are private', async () => {
  const f = await setup();
  const id = await assignment(f);
  const bytes = new Uint8Array([0, 137, 255, 10, 13, 200]);
  const result = await f.upload(
    student,
    { action: 'submit', assignmentId: id },
    [
      new File([bytes], '作业照片.png', { type: 'image/png' }),
      new File(['homework'], '作业.pdf', { type: 'application/pdf' }),
    ],
  );
  assert.equal(result.status, 200);
  const sub = (await f.call(student)).data.submissions[0];
  assert.equal(sub.link, '');
  assert.equal(sub.attachments.length, 2);
  assert.equal(sub.attachments[0].name, '作业照片.png');
  for (const user of [student, admin]) {
    const response = await f.download(user, sub.id, sub.attachments[0].id);
    assert.equal(response.status, 200);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    assert.match(response.headers.get('Content-Disposition'), /^attachment;/);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  }
  assert.equal(
    (await f.download(other, sub.id, sub.attachments[0].id)).status,
    404,
  );
  assert.equal(
    (await f.download(null, sub.id, sub.attachments[0].id)).status,
    401,
  );
  assert.equal((await f.call(other)).data.submissions.length, 0);
});

test('resubmission preserves attachments, rejects stolen IDs and stale edits, and removes selected files', async () => {
  const f = await setup();
  const id = await assignment(f);
  await f.upload(student, { action: 'submit', assignmentId: id }, [
    new File(['first'], 'first.txt'),
  ]);
  let sub = (await f.call(student)).data.submissions[0];
  const firstId = sub.attachments[0].id;
  assert.equal(
    (
      await f.call(other, {
        action: 'submit',
        assignmentId: id,
        attachments: [firstId],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call(student, {
        action: 'submit',
        assignmentId: id,
        note: '只更新说明',
      })
    ).status,
    200,
  );
  assert.equal(
    (await f.call(student)).data.submissions[0].attachments[0].id,
    firstId,
  );
  assert.equal(
    (
      await f.upload(
        student,
        { action: 'submit', assignmentId: id, version: sub.version },
        [new File(['stale'], 'stale.txt')],
      )
    ).status,
    409,
  );
  sub = (await f.call(student)).data.submissions[0];
  assert.equal(
    (
      await f.upload(
        student,
        {
          action: 'submit',
          assignmentId: id,
          version: sub.version,
          attachments: [],
        },
        [new File(['replacement'], '替换.docx')],
      )
    ).status,
    200,
  );
  const updated = (await f.call(student)).data.submissions[0];
  assert.equal(updated.attachments.length, 1);
  assert.equal(updated.attachments[0].name, '替换.docx');
  assert.equal((await f.download(student, sub.id, firstId)).status, 404);
  assert.equal(f.binaries.has(firstId), false);
  assert.equal(f.binaries.size, 1);
});

test('attachment limits, empty files, CSRF, membership and deadlines are enforced before storage', async () => {
  const f = await setup();
  const id = await assignment(f);
  const payload = { action: 'submit', assignmentId: id };
  const file = new File(['work'], 'work.txt');
  assert.equal(
    (await f.upload(student, payload, Array(6).fill(file))).status,
    400,
  );
  assert.equal(
    (await f.upload(student, payload, [new File([], 'empty.pdf')])).status,
    400,
  );
  assert.equal(
    (
      await f.upload(student, payload, [
        new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'large.pdf'),
      ])
    ).status,
    413,
  );
  assert.equal(
    (await f.upload(student, payload, [file], 'https://evil.test')).status,
    403,
  );
  assert.equal((await f.upload(null, payload, [file])).status, 401);
  assert.equal(
    (await f.upload({ id: 'outsider' }, payload, [file])).status,
    403,
  );
  const closed = await assignment(f, {
    dueAt: '2020-01-01T00:00:00Z',
    allowLate: false,
  });
  assert.equal(
    (await f.upload(student, { ...payload, assignmentId: closed }, [file]))
      .status,
    400,
  );
  assert.equal(f.binaries.size, 0);
  assert.equal((await f.call(student)).data.submissions.length, 0);
});

test('failed attachment storage and submission conflicts leave the previous submission intact', async () => {
  const f = await setup();
  const id = await assignment(f);
  const payload = { action: 'submit', assignmentId: id };
  const file = new File(['work'], 'work.txt');
  await f.upload(student, payload, [file]);
  const sub = (await f.call(student)).data.submissions[0];
  const put = f.files.put.bind(f.files);
  let writes = 0;
  f.files.put = async (key, data) => {
    if (++writes === 2) throw new Error('storage unavailable');
    return put(key, data);
  };
  assert.equal((await f.upload(student, payload, [file, file])).status, 503);
  assert.equal(f.binaries.size, 1);
  assert.equal(
    (await f.call(student)).data.submissions[0].version,
    sub.version,
  );
  f.files.put = put;
  const save = f.store.put.bind(f.store);
  f.store.put = async (key, ...args) =>
    key.startsWith('submission/') ? false : save(key, ...args);
  assert.equal((await f.upload(student, payload, [file])).status, 409);
  assert.equal(f.binaries.size, 1);
  assert.equal(
    (await f.download(student, sub.id, sub.attachments[0].id)).status,
    200,
  );
});
test('anonymous readers cannot read class data or write', async () => {
  const f = await setup();
  await assignment(f);
  const v = await f.call(null);
  assert.deepEqual(v.data.assignments, []);
  assert.equal(v.data.identity, null);
  assert.equal((await f.call(null, { action: 'post' })).status, 401);
});
test('admin initialization requires secret and is atomic under concurrent claims', async () => {
  const f = fixture();
  assert.equal(
    (await f.call(student, { action: 'claim-admin', code: 'wrong' })).status,
    403,
  );
  const r = await Promise.all([
    f.call(admin, { action: 'claim-admin', code: 'test-secret-only' }),
    f.call(student, { action: 'claim-admin', code: 'test-secret-only' }),
  ]);
  assert.deepEqual(r.map((x) => x.status).sort(), [200, 409]);
});
test('membership needs invite; client role fields cannot grant admin', async () => {
  const f = await setup();
  const stranger = { id: 'stranger', name: 'X', email: 'x@example.invalid' };
  assert.equal(
    (
      await f.call(stranger, {
        action: 'join',
        name: 'X',
        studentId: '123',
        code: 'wrong',
        isAdmin: true,
      })
    ).status,
    403,
  );
  assert.equal(
    (await f.call(student, { action: 'settings', isAdmin: true })).status,
    403,
  );
  assert.equal(
    (
      await f.call(student, {
        action: 'save',
        kind: 'teacher',
        data: { name: 'X' },
      })
    ).status,
    403,
  );
});
test('CSRF and malformed requests rejected', async () => {
  const f = await setup();
  assert.equal(
    (await f.call(admin, { action: 'settings' }, 'https://evil.test')).status,
    403,
  );
  const r = await handle(
    new Request('https://campus.test/api/campus', {
      method: 'POST',
      headers: {
        origin: 'https://campus.test',
        'Content-Type': 'application/json',
      },
      body: '{broken',
    }),
    { store: f.store, identity: admin, provider: 'sites' },
  );
  assert.equal(r.status, 400);
});
test('submissions are unique per user and task, with user isolation', async () => {
  const f = await setup();
  const id = await assignment(f);
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await f.call(student, {
          action: 'submit',
          assignmentId: id,
          note: `第${i}版`,
          userId: 'other',
        })
      ).status,
      200,
    );
  assert.equal((await f.call(student)).data.submissions.length, 1);
  assert.equal((await f.call(student)).data.submissions[0].userId, 'student');
  assert.equal((await f.call(other)).data.submissions.length, 0);
  assert.equal((await f.call(admin)).data.submissions.length, 1);
});
test('concurrent students do not overwrite each other', async () => {
  const f = await setup();
  const id = await assignment(f);
  await Promise.all([
    f.call(student, { action: 'submit', assignmentId: id }),
    f.call(other, { action: 'submit', assignmentId: id }),
  ]);
  assert.equal((await f.call(admin)).data.submissions.length, 2);
});
test('deadline enforces late policy; late submissions labeled', async () => {
  const f = await setup();
  const dueAt = new Date(Date.now() - 10000).toISOString();
  const closed = await assignment(f, { dueAt, allowLate: false });
  assert.equal(
    (await f.call(student, { action: 'submit', assignmentId: closed })).status,
    400,
  );
  const late = await assignment(f, { dueAt, allowLate: true });
  assert.equal(
    (await f.call(student, { action: 'submit', assignmentId: late })).status,
    200,
  );
  assert.equal((await f.call(student)).data.submissions[0].late, true);
});
test('unsafe submission links and oversized posts rejected', async () => {
  const f = await setup();
  const id = await assignment(f);
  assert.equal(
    (
      await f.call(student, {
        action: 'submit',
        assignmentId: id,
        link: 'javascript:alert(1)',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call(student, {
        action: 'post',
        title: 'x',
        body: 'x'.repeat(3001),
        category: '学习提问',
      })
    ).status,
    400,
  );
});
test('anonymous posts hide identity after approval; pending hidden from peers', async () => {
  const f = await setup();
  const p = await f.call(student, {
    action: 'post',
    title: '小问题',
    body: '想请教一道题',
    category: '学习提问',
    anonymous: true,
  });
  assert.equal((await f.call(other)).data.posts.length, 0);
  assert.equal((await f.call(student)).data.posts[0].mine, true);
  assert.equal(
    (
      await f.call(other, {
        action: 'comment',
        postId: p.data.id,
        body: '回复',
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await f.call(student, {
        action: 'moderate',
        id: p.data.id,
        status: 'published',
      })
    ).status,
    403,
  );
  await f.call(admin, {
    action: 'moderate',
    id: p.data.id,
    status: 'published',
  });
  const post = (await f.call(other)).data.posts[0];
  assert.equal(post.authorName, '匿名同学');
  assert.equal(post.authorId, undefined);
  assert.equal((await f.call(admin)).data.posts[0].authorId, 'student');
  assert.equal(
    (
      await f.call(other, {
        action: 'comment',
        postId: p.data.id,
        body: '我们一起看看',
      })
    ).status,
    200,
  );
});
test('stale edits conflict; archive preserves records and blocks submission', async () => {
  const f = await setup();
  const id = await assignment(f);
  const a = (await f.call(admin)).data.assignments[0];
  const payload = {
    action: 'save',
    kind: 'assignment',
    id,
    version: a.version,
    data: { ...a, title: '新标题' },
  };
  assert.equal((await f.call(admin, payload)).status, 200);
  assert.equal((await f.call(admin, payload)).status, 409);
  const updated = (await f.call(admin)).data.assignments[0];
  await f.call(admin, {
    action: 'archive',
    kind: 'assignment',
    id,
    version: updated.version,
    archived: true,
  });
  assert.equal((await f.call(student)).data.assignments.length, 0);
  assert.equal((await f.call(admin)).data.assignments.length, 1);
  assert.equal(
    (await f.call(student, { action: 'submit', assignmentId: id })).status,
    404,
  );
});
