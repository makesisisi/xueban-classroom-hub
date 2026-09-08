'use client';
import { useEffect, useState } from 'react';
import { Field, values } from './campus-forms';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
export default function Account({ data, run, busy, reload, onLogout }: any) {
  const [mode, setMode] = useState('login'),
    [authBusy, setAuthBusy] = useState(false),
    [reset, setReset] = useState(false),
    [notice, setNotice] = useState('');
  useEffect(() => {
    if (data.provider !== 'netlify') return;
    let active = true;
    import('@netlify/identity')
      .then(async (auth) => {
        const result = await auth.handleAuthCallback();
        if (!active || !result) return;
        if (result.type === 'recovery') {
          setReset(true);
          toast.info('请设置新密码');
        } else {
          toast.success('账号验证成功');
          const fresh = await reload();
          if (fresh.profile || fresh.isAdmin) window.location.href = '/';
          else setNotice('账号已验证。请填写姓名、学号和班级邀请码。');
        }
      })
      .catch((e) => toast.error(e.message));
    return () => {
      active = false;
    };
  }, [data.provider, reload]);
  async function authSubmit(e: any) {
    e.preventDefault();
    const v = values(e);
    setAuthBusy(true);
    try {
      const auth = await import('@netlify/identity');
      if (reset) {
        await auth.updateUser({ password: String(v.password) });
        setReset(false);
        toast.success('密码已更新');
      } else if (mode === 'register' || mode === 'login') {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            mode === 'register'
              ? {
                  action: 'register',
                  username: String(v.username),
                  email: String(v.email),
                  password: String(v.password),
                }
              : {
                  action: 'login',
                  identifier: String(v.identifier),
                  password: String(v.password),
                },
          ),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error || '登录失败');
        toast.success(
          mode === 'register' ? '注册成功，已自动登录' : '欢迎回来',
        );
      } else if (mode === 'recovery') {
        await auth.requestPasswordRecovery(String(v.email));
        setNotice(
          '如果账号存在，密码重置邮件已经发送。请查看收件箱和垃圾邮件。',
        );
        toast.success('如果账号存在，你会收到密码重置邮件');
      }
      const fresh = await reload();
      if (
        (mode === 'login' || mode === 'register') &&
        (fresh.profile || fresh.isAdmin)
      )
        window.location.href = '/';
    } catch (e: any) {
      toast.error(e.message || '暂时无法登录，请稍后重试');
    } finally {
      setAuthBusy(false);
    }
  }
  async function setUsername(e: any) {
    e.preventDefault();
    const v = values(e);
    setAuthBusy(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set-username',
          username: String(v.username),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || '账号设置失败');
      await reload();
      toast.success('登录账号已设置');
    } catch (e: any) {
      toast.error(e.message || '账号设置失败，请稍后重试');
    } finally {
      setAuthBusy(false);
    }
  }
  if (!data.identity || reset)
    return (
      <div className="account-layout">
        <section className="panel account-panel">
          <span className="pill">欢迎来到学伴</span>
          <h2>{reset ? '设置新密码' : '学习路上，不再一个人'}</h2>
          <p className="muted">
            登录并加入班级后，即可查看老师档案、打卡和参与交流。
          </p>
          {notice && <output className="info-box">{notice}</output>}
          {data.provider === 'sites' ? (
            <>
              <a
                className="button full"
                href="/signin-with-chatgpt?return_to=/account"
                target="_top"
              >
                使用 ChatGPT 注册 / 登录
              </a>
              <p className="muted">
                首次登录后填写姓名与学号，使用学委提供的邀请码加入班级。
              </p>
            </>
          ) : (
            <>
              <Tabs value={mode} onValueChange={(v) => setMode(String(v))}>
                <TabsList className="w-full mt-6">
                  <TabsTrigger value="login">登录</TabsTrigger>
                  <TabsTrigger value="register">注册账号</TabsTrigger>
                  <TabsTrigger value="recovery">找回密码</TabsTrigger>
                </TabsList>
              </Tabs>
              <form className="form-stack mt-5" onSubmit={authSubmit}>
                {mode === 'register' && !reset && (
                  <label className="field">
                    <span>账号（3–24 位）</span>
                    <input
                      name="username"
                      required
                      minLength={3}
                      maxLength={24}
                      autoComplete="username"
                      placeholder="中英文、数字、下划线或短横线"
                    />
                  </label>
                )}{' '}
                {mode === 'login' && !reset && (
                  <label className="field">
                    <span>账号或邮箱</span>
                    <input
                      name="identifier"
                      required
                      maxLength={254}
                      autoComplete="username"
                    />
                  </label>
                )}{' '}
                {(mode === 'register' || mode === 'recovery') && !reset && (
                  <Field
                    label={
                      mode === 'register'
                        ? '邮箱（仅用于找回密码）'
                        : '注册邮箱'
                    }
                    name="email"
                    type="email"
                    max={254}
                  />
                )}{' '}
                {(mode !== 'recovery' || reset) && (
                  <label className="field">
                    <span>密码（至少 10 位）</span>
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={10}
                      maxLength={128}
                      autoComplete={
                        mode === 'login' ? 'current-password' : 'new-password'
                      }
                    />
                  </label>
                )}
                <button className="button full" disabled={authBusy}>
                  {authBusy
                    ? '处理中…'
                    : reset
                      ? '更新密码'
                      : mode === 'login'
                        ? '登录'
                        : mode === 'register'
                          ? '创建账号'
                          : '发送重置邮件'}
                </button>
              </form>
              {mode === 'register' && (
                <p className="auth-hint">
                  注册后会直接登录，无需打开邮箱验证。请填写能正常收信的邮箱，方便忘记密码时找回账号。
                </p>
              )}
            </>
          )}
        </section>
        <aside className="account-aside">
          <p className="eyebrow">A LITTLE MORE ORGANIZED</p>
          <h2>
            少一些“作业是什么”，
            <br />
            多一点从容的大学生活。
          </h2>
          <ul>
            <li>每次作业都有清晰的截止时间</li>
            <li>老师的答疑方式随时可查</li>
            <li>好用的学习经验一起分享</li>
          </ul>
        </aside>
      </div>
    );
  return (
    <div className="account-layout">
      <section className="panel account-panel">
        <div className="section-heading">
          <h2>{data.profile ? '个人资料' : '加入我们的班级'}</h2>
          <button className="button secondary small" onClick={onLogout}>
            退出登录
          </button>
        </div>
        <p className="muted">
          账号：{data.identity.username || '还未设置'} · 邮箱：
          {data.identity.email}
        </p>
        {data.provider === 'netlify' && !data.identity.username && (
          <form className="inline-account-setup" onSubmit={setUsername}>
            <label className="field">
              <span>设置登录账号</span>
              <input
                name="username"
                required
                minLength={3}
                maxLength={24}
                autoComplete="username"
                placeholder="设置后也可以用账号登录"
              />
            </label>
            <button className="button secondary" disabled={authBusy}>
              {authBusy ? '保存中…' : '保存账号'}
            </button>
          </form>
        )}
        <form
          className="form-stack mt-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run({ action: 'join', ...values(e) }, '个人资料已保存'))
              window.location.href = data.isAdmin ? '/admin' : '/';
          }}
        >
          <Field
            label="真实姓名（用于作业统计）"
            name="name"
            value={data.profile?.name || ''}
            max={30}
          />
          <Field
            label="学号"
            name="studentId"
            value={data.profile?.studentId}
            max={40}
          />
          {!data.profile && !data.isAdmin && (
            <Field label="班级邀请码" name="code" max={80} />
          )}
          <button className="button" disabled={busy}>
            {busy ? '保存中…' : data.profile ? '保存资料' : '加入班级'}
          </button>
        </form>
      </section>
      {data.needsSetup ? (
        <section className="panel account-panel">
          <h2>我是学委 · 初始化班级</h2>
          <p className="muted">
            仅网站负责人使用。输入初始化码设置管理员，之后前往学委工作台生成班级邀请码。
          </p>
          <form
            className="form-stack mt-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(
                  { action: 'claim-admin', ...values(e) },
                  '管理员已设置',
                )
              )
                window.location.href = '/admin';
            }}
          >
            <Field
              label="管理员初始化码"
              name="code"
              type="password"
              max={160}
            />
            <button className="button" disabled={busy}>
              设置为管理员
            </button>
          </form>
        </section>
      ) : (
        <section className="panel account-panel">
          <h2>你的班级</h2>
          <p>{data.settings.className}</p>
          <p className="muted">{data.settings.semester}</p>
          {data.isAdmin ? (
            <a href="/admin" className="button mt-5">
              进入学委工作台
            </a>
          ) : (
            <p className="info-box">
              邀请码由学委提供。注册账号后，需要加入班级才可查看班级内容。
            </p>
          )}
        </section>
      )}
    </div>
  );
}
