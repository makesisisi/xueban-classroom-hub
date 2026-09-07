'use client';
import { useEffect, useState } from 'react';
import { Field, values } from './campus-forms';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
export default function Account({ data, run, busy, reload }: any) {
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
      } else if (mode === 'register') {
        const u = await auth.signup(String(v.email), String(v.password), {
          full_name: String(v.name),
        });
        if (u.confirmedAt) {
          setNotice('注册成功，现在可以登录。');
        } else {
          setMode('login');
          setNotice('确认邮件已发送。请先点击邮件里的链接，再回到这里登录。');
        }
        toast.success(u.confirmedAt ? '注册成功' : '确认邮件已发送');
      } else if (mode === 'recovery') {
        await auth.requestPasswordRecovery(String(v.email));
        setNotice(
          '如果账号存在，密码重置邮件已经发送。请查看收件箱和垃圾邮件。',
        );
        toast.success('如果账号存在，你会收到密码重置邮件');
      } else {
        await auth.login(String(v.email), String(v.password));
        toast.success('欢迎回来');
      }
      const fresh = await reload();
      if (mode === 'login' && (fresh.profile || fresh.isAdmin))
        window.location.href = '/';
    } catch (e: any) {
      toast.error(e.message || '暂时无法登录，请稍后重试');
    } finally {
      setAuthBusy(false);
    }
  }
  async function logout() {
    if (data.provider === 'sites') {
      window.location.href = '/signout-with-chatgpt?return_to=/account';
      return;
    }
    try {
      const auth = await import('@netlify/identity');
      await auth.logout();
      await reload();
    } catch {
      toast.error('退出失败，请重试');
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
                  <Field label="姓名" name="name" max={30} />
                )}{' '}
                {!reset && (
                  <Field label="邮箱" name="email" type="email" max={254} />
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
          <button className="button secondary small" onClick={logout}>
            退出登录
          </button>
        </div>
        <p className="muted">{data.identity.email}</p>
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
