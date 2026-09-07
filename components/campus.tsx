'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  ClipboardCheck,
  Users,
  MessageCircle,
  Bell,
  ShieldCheck,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Clock,
  Check,
  Sparkles,
  Plus,
  Search,
  CalendarDays,
  Mail,
  MapPin,
  Lightbulb,
  ChevronLeft,
  Download,
  Archive,
  RotateCcw,
} from 'lucide-react';
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Toaster, toast } from 'sonner';
import { Editor, Field, values, Choice } from './campus-forms';
import Account from './account';
import type { RecordData } from '@/lib/service';
const nav = [
  ['/', '班级概览', LayoutDashboard],
  ['/assignments', '作业打卡', ClipboardCheck],
  ['/teachers', '老师档案', Users],
  ['/community', '班级社区', MessageCircle],
  ['/notices', '公告通知', Bell],
  ['/admin', '学委工作台', ShieldCheck],
] as const;
const initial: any = {
  provider:
    import.meta.env?.VITE_HOST_PLATFORM === 'netlify' ? 'netlify' : 'sites',
  identity: null,
  profile: null,
  isAdmin: false,
  needsSetup: false,
  settings: { className: '我们的班级', semester: '2026 · 秋季学期' },
  assignments: [],
  teachers: [],
  posts: [],
  notices: [],
  submissions: [],
  comments: [],
  members: [],
};
const formatDate = (v: string) =>
  new Date(v).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
const dueText = (v: string, currentTime: number) => {
  const target = new Date(v);
  const now = new Date(currentTime);
  const day = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((day.getTime() - today.getTime()) / 86400000);
  const time = target.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  if (target.getTime() < now.getTime()) return `已于 ${formatDate(v)} 截止`;
  if (days === 0) return `今天 ${time} 截止`;
  if (days === 1) return `明天 ${time} 截止`;
  if (days > 1 && days <= 7) return `${days} 天后 · ${formatDate(v)} 截止`;
  return `${formatDate(v)} 截止`;
};
function Empty({
  icon: Icon = BookOpen,
  title = '还没有内容',
  text = '学委发布后，内容会出现在这里。',
}: any) {
  return (
    <div className="empty-block">
      <Icon size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Toolbar({ children, search, setSearch }: any) {
  return (
    <div className="toolbar">
      <label className="search">
        <Search size={17} />
        <input
          aria-label="搜索当前列表"
          placeholder="搜索名称或内容…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {children}
    </div>
  );
}

export default function Campus() {
  const [data, setData] = useState(initial),
    [path, setPath] = useState('/'),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<any>(null),
    [now, setNow] = useState(() => Date.now()),
    [assignmentFilter, setAssignmentFilter] = useState('全部'),
    [communityFilter, setCommunityFilter] = useState('全部'),
    [searches, setSearches] = useState<Record<string, string>>({}),
    [adminTab, setAdminTab] = useState('作业统计'),
    [selected, setSelected] = useState('');
  const section = path.split('/')[1] || 'home',
    detailId = path.split('/')[2];
  const search = searches[section] || '';
  const setSearch = (value: string) =>
    setSearches((current) => ({ ...current, [section]: value }));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/campus', { cache: 'no-store' });
      const v: any = await r.json();
      if (!r.ok) throw new Error(v.error || '暂时无法加载班级');
      setData(v);
      setError('');
      return v;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    setPath(window.location.pathname.replace(/\/$/, '') || '/');
    if (
      initial.provider === 'netlify' &&
      /(?:confirmation_token|recovery_token|invite_token|access_token)=/.test(
        window.location.hash,
      ) &&
      window.location.pathname !== '/account'
    ) {
      window.location.replace('/account' + window.location.hash);
      return;
    }
    if (initial.provider === 'netlify') {
      void import('@netlify/identity')
        .then((a) => a.getUser())
        .then(() => reload())
        .catch(() => reload().catch(() => {}));
    } else void reload().catch(() => {});
  }, [reload]);
  const run = useCallback(
    async (payload: any, message = '已更新') => {
      setBusy(true);
      try {
        const r = await fetch('/api/campus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result: any = await r.json();
        if (!r.ok) throw new Error(result.error || '操作失败');
        await reload();
        toast.success(message);
        return true;
      } catch (e: any) {
        toast.error(e.message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'list_my_assignments',
            title: '查看我的作业',
            description:
              '读取当前班级的作业及自己的提交状态。需要先加入班级，不修改数据。',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: async (input: unknown) => {
              if (
                !input ||
                typeof input !== 'object' ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error('参数应为空对象');
              const s = await reload();
              if (!s.profile && !s.isAdmin) throw new Error('请先加入班级');
              return s.assignments
                .filter((a: any) => !a.archived)
                .map((a: any) => ({
                  id: a.id,
                  title: a.title,
                  dueAt: a.dueAt,
                  submitted: s.submissions.some(
                    (x: any) =>
                      x.assignmentId === a.id && x.userId === s.identity?.id,
                  ),
                }));
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, [reload]);
  const label =
    nav.find(([href]) => href === `/${section}`)?.[1] ||
    (section === 'account' ? '我的账号' : '班级概览');
  const member = !!data.profile || data.isAdmin;
  const tasks = data.assignments.filter((a: any) => !a.archived),
    teachers = data.teachers.filter((a: any) => !a.archived),
    notices = data.notices.filter((a: any) => !a.archived),
    posts = data.posts.filter(
      (a: any) => a.status === 'published' || a.mine || data.isAdmin,
    );
  const mySubs = data.submissions.filter(
      (s: any) => s.userId === data.identity?.id,
    ),
    subFor = (id: string) => mySubs.find((s: any) => s.assignmentId === id);
  const includes = (r: any) =>
    JSON.stringify(r).toLowerCase().includes(search.toLowerCase());
  const status = (a: any) =>
    subFor(a.id)
      ? '已打卡'
      : now > Date.parse(a.dueAt)
        ? a.allowLate
          ? '可补交'
          : '已截止'
        : '待完成';
  const actionableTasks = tasks.filter((a: any) =>
    ['待完成', '可补交'].includes(status(a)),
  );
  const homeAction = !data.identity
    ? { href: '/account', label: '登录并加入班级' }
    : !member
      ? { href: '/account', label: '填写班级资料' }
      : {
          href: '/assignments',
          label: actionableTasks.length
            ? `继续完成 ${actionableTasks.length} 份作业`
            : '查看作业清单',
        };
  const titles: any = {
    home: '新的一天，学习有伴',
    assignments: '作业打卡',
    teachers: '老师档案',
    community: '班级社区',
    notices: '公告通知',
    admin: '学委工作台',
    account: '我的账号',
  };
  const subtitles: any = {
    home: '把琐事交给学伴，把时间留给热爱。',
    assignments: '记住每个截止时间，让每一份努力按时抵达。',
    teachers: '联系方式、答疑时间、上课小技巧，都在这里。',
    community: '一起解题，分享经验，也给小情绪留个出口。',
    notices: '重要的班级消息，不再被聊天记录淹没。',
    admin: '发布、统计、审核，班级事务一站处理。',
    account: '让班级认识你，也让每一次打卡都有姓名。',
  };
  const edit = (kind: string, item?: any) => setModal({ kind, item });
  const guard = (
    <section className="panel">
      <Empty
        icon={ShieldCheck}
        title={
          data.identity
            ? '还差一步，加入我们的班级'
            : '班级里的小事，登录后一起看'
        }
        text={
          data.identity
            ? '使用学委提供的邀请码完善资料，即可查看班级内容。'
            : '为保护老师和同学的信息，班级内容仅向成员开放。'
        }
      />
      <div className="center">
        <a href="/account" className="button">
          {data.identity ? '填写资料 / 加入班级' : '注册 / 登录'}{' '}
          <ArrowRight size={16} />
        </a>
      </div>
    </section>
  );
  function TaskRows({ items }: any) {
    return items.length ? (
      <div className="task-list">
        {items.map((a: any) => (
          <a href={`/assignments/${a.id}`} className="task-row" key={a.id}>
            <span className={`task-check ${subFor(a.id) ? 'done' : ''}`}>
              {subFor(a.id) ? (
                <Check size={17} />
              ) : (
                <ClipboardCheck size={18} />
              )}
            </span>
            <div>
              <span className="task-course">{a.course}</span>
              <h3>{a.title}</h3>
              <p>
                <Clock size={13} /> {dueText(a.dueAt, now)}
              </p>
            </div>
            <span
              className={`pill ${status(a) === '已打卡' ? 'green' : ['已截止', '可补交'].includes(status(a)) ? 'orange' : ''}`}
            >
              {status(a)}
            </span>
            <ArrowUpRight size={17} className="muted" />
          </a>
        ))}
      </div>
    ) : (
      <Empty
        icon={ClipboardCheck}
        title="清单很干净，安心学习吧"
        text="还没有符合条件的作业。新任务发布后会出现在这里。"
      />
    );
  }
  function Stats() {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return (
      <div className="stats-grid">
        {[
          [
            ClipboardCheck,
            '待完成作业',
            member ? actionableTasks.length : '—',
            '把截止时间记在心上',
            '/assignments',
          ],
          [
            Check,
            '本周已打卡',
            member
              ? mySubs.filter(
                  (s: any) => Date.parse(s.createdAt) >= monday.getTime(),
                ).length
              : '—',
            '每一份努力都算数',
            '/assignments',
          ],
          [
            Users,
            '老师档案',
            member ? teachers.length : '—',
            '联系方式与上课技巧',
            '/teachers',
          ],
          [
            MessageCircle,
            '班级交流',
            member
              ? posts.filter((p: any) => p.status === 'published').length
              : '—',
            '提问、经验和小吐槽',
            '/community',
          ],
        ].map(([Icon, name, count, desc, href]: any) => (
          <a className="stat-card" href={member ? href : '/account'} key={name}>
            <span className="stat-icon">
              <Icon size={21} />
            </span>
            <span className="muted">{name}</span>
            <strong>{count}</strong>
            <small>{desc}</small>
          </a>
        ))}
      </div>
    );
  }
  function Dashboard() {
    return (
      <>
        <section className="welcome-banner">
          <div>
            <span className="pill light">{data.settings.semester}</span>
            <h2>
              每一件学习小事，
              <br />
              都有人和你一起。
            </h2>
            <p>作业、老师、班级消息，一个地方就够了。</p>
            <a href={homeAction.href}>
              {homeAction.label} <ArrowUpRight size={17} />
            </a>
          </div>
          <div className="banner-aside">
            <BookOpen size={42} />
            <span>STUDY TOGETHER</span>
            <strong>一起学，一起向前。</strong>
          </div>
        </section>
        <Stats />
        <div className="dashboard-grid">
          <section className="panel">
            <div className="section-heading">
              <h2>
                近期作业 <span className="subtle">ASSIGNMENTS</span>
              </h2>
              <a href="/assignments">
                查看全部 <ArrowRight size={15} />
              </a>
            </div>
            {member ? (
              <TaskRows items={actionableTasks.slice(0, 4)} />
            ) : (
              <Empty
                icon={ClipboardCheck}
                title="准备好迎接新学期"
                text="登录并加入班级，查看截止时间和自己的打卡状态。"
              />
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>班级公告</h2>
              <Bell size={19} />
            </div>
            {notices.length ? (
              notices.slice(0, 3).map((n: any) => (
                <a
                  className="notice-summary"
                  href={`/notices/${n.id}`}
                  key={n.id}
                >
                  <span className="pill">{n.category}</span>
                  <h3>{n.title}</h3>
                  <small>{formatDate(n.createdAt)}</small>
                </a>
              ))
            ) : (
              <div className="notice-intro">
                <span className="pill">使用指南</span>
                <h3>欢迎来到我们的班级空间</h3>
                <p>
                  先注册并完善姓名，方便学委统计作业。老师联系方式仅向班级成员开放。
                </p>
                <a href="/account">
                  完善个人资料 <ArrowRight size={15} />
                </a>
              </div>
            )}
            <div className="tip">
              <Clock size={18} />
              <span>别等到最后一刻，提前打卡更从容。</span>
            </div>
          </section>
        </div>
        <div className="quick-links">
          {[
            [
              Users,
              '了解老师，少一点摸索',
              '查看联系方式与课程技巧',
              '/teachers',
            ],
            [
              MessageCircle,
              '有问题，一起讨论',
              '分享经验，寻找同伴',
              '/community',
            ],
          ].map(([Icon, title, desc, url]: any) => (
            <a href={url} key={url}>
              <Icon size={23} />
              <div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
              <ArrowUpRight size={20} />
            </a>
          ))}
        </div>
      </>
    );
  }
  function Assignments() {
    const a = tasks.find((t: any) => t.id === detailId);
    if (detailId) {
      if (!a) return <Empty title="这份作业不存在或已归档" />;
      const sub = subFor(a.id);
      return (
        <section className="panel detail-panel">
          <a href="/assignments" className="back">
            <ChevronLeft size={16} />
            返回作业清单
          </a>
          <span className="pill">{a.course}</span>
          <h2 className="detail-title">{a.title}</h2>
          <div className="detail-meta">
            <Clock size={17} />
            {dueText(a.dueAt, now)}{' '}
            <span className="pill">
              {a.allowLate ? '允许补交' : '不允许迟交'}
            </span>
          </div>
          <h3>作业要求</h3>
          <p className="prose">{a.description}</p>
          {sub && (
            <div className="submission-box">
              <h3>
                <Check size={18} /> 已打卡{sub.late ? ' · 迟交' : ''}
              </h3>
              <p className="muted">{formatDate(sub.createdAt)}</p>
              <p className="prose">{sub.note || '已确认完成提交'}</p>
              {sub.link && (
                <a
                  href={sub.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link"
                >
                  查看提交链接 <ArrowUpRight size={15} />
                </a>
              )}
            </div>
          )}
          {!sub && !a.allowLate && now > Date.parse(a.dueAt) && (
            <p className="info-box deadline-note" role="status">
              这份作业已经截止，当前不能再打卡。如需补交，请联系学委或任课老师。
            </p>
          )}
          <button
            className="button"
            disabled={!a.allowLate && now > Date.parse(a.dueAt)}
            onClick={() =>
              setModal({ kind: 'submit', item: a, submission: sub })
            }
          >
            {!a.allowLate && now > Date.parse(a.dueAt)
              ? '已截止，无法打卡'
              : sub
                ? '更新我的打卡'
                : '确认已交作业'}{' '}
            <Check size={17} />
          </button>
          <p className="muted mt-3">打卡记录不代替老师要求的实际作业提交。</p>
        </section>
      );
    }
    return (
      <section className="panel">
        <Toolbar search={search} setSearch={setSearch}>
          {data.isAdmin && (
            <button className="button" onClick={() => edit('assignment')}>
              <Plus size={17} />
              发布作业
            </button>
          )}
        </Toolbar>
        <Tabs
          value={assignmentFilter}
          onValueChange={(v) => setAssignmentFilter(String(v))}
        >
          <TabsList className="filter-tabs">
            {['全部', '待完成', '可补交', '已打卡', '已截止'].map((v) => (
              <TabsTrigger key={v} value={v}>
                {v}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <TaskRows
          items={tasks.filter(
            (a: any) =>
              includes(a) &&
              (assignmentFilter === '全部' || status(a) === assignmentFilter),
          )}
        />
      </section>
    );
  }
  function Teachers() {
    const t = teachers.find((a: any) => a.id === detailId);
    if (detailId) {
      if (!t) return <Empty title="老师档案不存在或已归档" />;
      return (
        <section className="panel detail-panel">
          <a href="/teachers" className="back">
            <ChevronLeft size={16} />
            全部老师
          </a>
          <div className="teacher-heading">
            <span className="teacher-avatar">{t.name.slice(0, 1)}</span>
            <div>
              <h2 className="detail-title">{t.name}</h2>
              <span className="pill">{t.course}</span>
            </div>
            {data.isAdmin && (
              <button
                className="button secondary"
                onClick={() => edit('teacher', t)}
              >
                编辑档案
              </button>
            )}
          </div>
          <div className="detail-section">
            <h3>
              <Mail size={18} /> 联系方式
            </h3>
            <p className="prose">{t.contact || '暂未填写，请向学委咨询。'}</p>
          </div>
          <div className="detail-section">
            <h3>
              <MapPin size={18} /> 办公室与答疑
            </h3>
            <p className="prose">{t.office || '暂未填写'}</p>
          </div>
          <div className="detail-section tips-section">
            <h3>
              <Lightbulb size={18} /> 上课小技巧
            </h3>
            <p className="prose">
              {t.tips || '还没有经验，欢迎在班级社区分享。'}
            </p>
          </div>
          <p className="muted">联系方式仅供本班学习交流使用，请勿转发。</p>
        </section>
      );
    }
    const shown = teachers.filter(includes);
    return (
      <>
        <Toolbar search={search} setSearch={setSearch}>
          {data.isAdmin && (
            <button className="button" onClick={() => edit('teacher')}>
              <Plus size={17} />
              添加老师
            </button>
          )}
        </Toolbar>
        {shown.length ? (
          <div className="teacher-grid">
            {shown.map((t: any, i: number) => (
              <a
                className="panel teacher-card"
                href={`/teachers/${t.id}`}
                key={t.id}
              >
                <span className={`teacher-avatar tone-${i % 3}`}>
                  {t.name.slice(0, 1)}
                </span>
                <h2>{t.name}</h2>
                <span className="pill">{t.course}</span>
                <p>
                  <MapPin size={15} />
                  {t.office || '答疑时间待补充'}
                </p>
                <div className="teacher-card-footer">
                  <span>{t.tips ? '有课程小技巧' : '查看详细档案'}</span>
                  <ArrowUpRight size={18} />
                </div>
              </a>
            ))}
          </div>
        ) : (
          <section className="panel">
            <Empty
              icon={Users}
              title="老师档案，从这里慢慢积累"
              text="学委可以添加任课老师、联系方式与上课小技巧。"
            />
          </section>
        )}
      </>
    );
  }
  function Community() {
    const p = posts.find((x: any) => x.id === detailId);
    if (detailId) {
      if (!p) return <Empty title="帖子不存在或暂不可见" />;
      return (
        <section className="panel detail-panel">
          <a href="/community" className="back">
            <ChevronLeft size={16} />
            回到班级社区
          </a>
          <span className="pill">{p.category}</span>
          <h2 className="detail-title">{p.title}</h2>
          <p className="muted">
            {p.anonymous ? '匿名同学' : p.authorName} ·{' '}
            {formatDate(p.createdAt)}
            {p.status !== 'published' &&
              ` · ${p.status === 'pending' ? '待审核' : '未通过审核'}`}
          </p>
          <p className="prose">{p.body}</p>
          <div className="detail-section">
            <h3>同学回复</h3>
            {data.comments
              .filter((c: any) => c.postId === p.id)
              .map((c: any) => (
                <div className="comment" key={c.id}>
                  <strong>{c.authorName}</strong>
                  <small>{formatDate(c.createdAt)}</small>
                  <p className="prose">{c.body}</p>
                </div>
              ))}
            {p.status === 'published' && (
              <form
                className="form-stack mt-5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  if (
                    await run(
                      { action: 'comment', postId: p.id, ...values(e) },
                      '回复已发布',
                    )
                  )
                    form.reset();
                }}
              >
                <Field label="写下你的回复" name="body" area max={1000} />
                <button className="button" disabled={busy}>
                  发布回复
                </button>
              </form>
            )}
          </div>
        </section>
      );
    }
    return (
      <>
        <Toolbar search={search} setSearch={setSearch}>
          <button className="button" onClick={() => edit('post')}>
            <Plus size={17} />
            发起话题
          </button>
        </Toolbar>
        <div className="community-layout">
          <section>
            <Tabs
              value={communityFilter}
              onValueChange={(v) => setCommunityFilter(String(v))}
            >
              <TabsList className="filter-tabs">
                {['全部', '学习提问', '经验分享', '小吐槽'].map((v) => (
                  <TabsTrigger value={v} key={v}>
                    {v}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {posts
              .filter(
                (p: any) =>
                  includes(p) &&
                  (communityFilter === '全部' ||
                    p.category === communityFilter),
              )
              .map((p: any) => (
                <a
                  href={`/community/${p.id}`}
                  className="panel post-card"
                  key={p.id}
                >
                  <div className="post-meta">
                    <span className="pill">{p.category}</span>
                    <span>{p.anonymous ? '匿名同学' : p.authorName}</span>
                    <small>{formatDate(p.createdAt)}</small>
                  </div>
                  <h2>{p.title}</h2>
                  <p>
                    {p.body.slice(0, 150)}
                    {p.body.length > 150 ? '…' : ''}
                  </p>
                  <div className="post-footer">
                    <span>
                      <MessageCircle size={15} />
                      {
                        data.comments.filter((c: any) => c.postId === p.id)
                          .length
                      }{' '}
                      条回复
                    </span>
                    {p.status !== 'published' && (
                      <span className="pill orange">
                        {p.status === 'pending' ? '待审核' : '未通过审核'}
                      </span>
                    )}
                    <ArrowUpRight size={17} />
                  </div>
                </a>
              ))}
            {!posts.filter(
              (p: any) =>
                includes(p) &&
                (communityFilter === '全部' || p.category === communityFilter),
            ).length && (
              <section className="panel">
                <Empty
                  icon={MessageCircle}
                  title="第一句，等你来聊"
                  text="分享一个好用的学习方法，或者问问今天没听懂的知识点。"
                />
              </section>
            )}
          </section>
          <aside className="panel community-rules">
            <Sparkles size={24} />
            <h2>轻松聊，认真听</h2>
            <p>讨论课程与学习体验，尊重不同的感受。</p>
            <ul>
              <li>吐槽事情，不攻击个人</li>
              <li>不公开他人的联系方式</li>
              <li>新话题由学委审核后展示</li>
              <li>匿名仅对同学隐藏姓名，学委可查看发布者</li>
            </ul>
          </aside>
        </div>
      </>
    );
  }
  function Notices() {
    const n = notices.find((x: any) => x.id === detailId);
    if (detailId) {
      if (!n) return <Empty title="公告不存在或已归档" />;
      return (
        <section className="panel detail-panel">
          <a className="back" href="/notices">
            <ChevronLeft size={16} />
            所有公告
          </a>
          <span className="pill">{n.category}</span>
          <h2 className="detail-title">{n.title}</h2>
          <p className="muted">学委发布 · {formatDate(n.createdAt)}</p>
          <p className="prose">{n.body}</p>
        </section>
      );
    }
    return (
      <>
        <Toolbar search={search} setSearch={setSearch}>
          {data.isAdmin && (
            <button className="button" onClick={() => edit('notice')}>
              <Plus size={17} />
              发布公告
            </button>
          )}
        </Toolbar>
        <section className="panel">
          {notices.filter(includes).map((n: any) => (
            <a href={`/notices/${n.id}`} className="notice-row" key={n.id}>
              <span className="notice-icon">
                <Bell size={20} />
              </span>
              <div>
                <span className="pill">{n.category}</span>
                <h2>{n.title}</h2>
                <p>{n.body.slice(0, 110)}</p>
                <small>{formatDate(n.createdAt)}</small>
              </div>
              <ArrowUpRight size={19} />
            </a>
          ))}
          {!notices.filter(includes).length && (
            <Empty
              icon={Bell}
              title="暂无新公告"
              text="课程调整、考试安排和班级通知，学委都会在这里发布。"
            />
          )}
        </section>
      </>
    );
  }
  function Admin() {
    if (!data.isAdmin)
      return (
        <section className="panel">
          <Empty
            icon={ShieldCheck}
            title="这里是学委的工作台"
            text={
              data.needsSetup
                ? '班级尚未初始化。网站负责人可在我的账号中设置管理员。'
                : '当前账号没有管理权限。可以联系学委处理班级事务。'
            }
          />
          <div className="center">
            <a className="button" href="/account">
              我的账号
            </a>
          </div>
        </section>
      );
    const activeTask =
      data.assignments.find((a: any) => a.id === selected) || tasks[0];
    const rows = (data.members || []).map((m: any) => ({
      ...m,
      submission: data.submissions.find(
        (s: any) => s.assignmentId === activeTask?.id && s.userId === m.id,
      ),
    }));
    const done = rows.filter((r: any) => r.submission).length;
    function exportCsv() {
      const escape = (s: any) =>
        '"' +
        String(s ?? '')
          .replace(/^[=+@\-\t\r]/, "'$&")
          .replace(/"/g, '""') +
        '"';
      const lines = [
        ['作业', '姓名', '学号', '状态', '提交时间', '链接', '说明'],
        ...rows.map((r: any) => [
          activeTask?.title,
          r.name,
          r.studentId,
          r.submission ? (r.submission.late ? '迟交' : '已交') : '未交',
          r.submission?.createdAt,
          r.submission?.link,
          r.submission?.note,
        ]),
      ];
      const blob = new Blob(
        ['\ufeff' + lines.map((r) => r.map(escape).join(',')).join('\r\n')],
        { type: 'text/csv;charset=utf-8' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '班级作业统计.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return (
      <>
        <div className="admin-overview">
          <span>
            <Users size={20} />
            <strong>{data.members?.length || 0}</strong> 位成员
          </span>
          <span>
            <ClipboardCheck size={20} />
            <strong>{tasks.length}</strong> 份进行中的作业
          </span>
          <span>
            <MessageCircle size={20} />
            <strong>
              {data.posts.filter((p: any) => p.status === 'pending').length}
            </strong>{' '}
            条待审核话题
          </span>
        </div>
        <Tabs value={adminTab} onValueChange={(v) => setAdminTab(String(v))}>
          <TabsList className="filter-tabs admin-tabs">
            {['作业统计', '内容管理', '社区审核', '班级设置'].map((v) => (
              <TabsTrigger value={v} key={v}>
                {v}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {adminTab === '作业统计' && (
          <section className="panel">
            <div className="section-heading">
              <h2>作业完成情况</h2>
              <button className="button" onClick={() => edit('assignment')}>
                <Plus size={16} />
                发布作业
              </button>
            </div>
            {tasks.length ? (
              <>
                <div className="toolbar">
                  <Choice
                    label="选择作业"
                    value={
                      activeTask
                        ? `${activeTask.title} · ${activeTask.course} · ${activeTask.id.slice(0, 6)}`
                        : null
                    }
                    options={tasks.map(
                      (a: any) =>
                        `${a.title} · ${a.course} · ${a.id.slice(0, 6)}`,
                    )}
                    onChange={(v: string) =>
                      setSelected(
                        tasks.find(
                          (a: any) =>
                            `${a.title} · ${a.course} · ${a.id.slice(0, 6)}` ===
                            v,
                        )?.id || '',
                      )
                    }
                  />
                  <button className="button secondary" onClick={exportCsv}>
                    <Download size={16} />
                    导出名单
                  </button>
                </div>
                <p className="muted">
                  {activeTask?.title} · {done} / {rows.length} 人已交
                  {rows.length > 0
                    ? ` · ${Math.round((done / rows.length) * 100)}%`
                    : ''}
                </p>
                <Progress
                  value={rows.length ? (done / rows.length) * 100 : 0}
                  className="my-4"
                />
                <Table className="submission-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>姓名</TableHead>
                      <TableHead>学号</TableHead>
                      <TableHead>提交状态</TableHead>
                      <TableHead>提交时间 / 凭证</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell data-label="姓名">{r.name}</TableCell>
                        <TableCell data-label="学号">{r.studentId}</TableCell>
                        <TableCell data-label="状态">
                          <span
                            className={`pill ${r.submission ? 'green' : 'orange'}`}
                          >
                            {r.submission
                              ? r.submission.late
                                ? '迟交'
                                : '已交'
                              : '未交'}
                          </span>
                        </TableCell>
                        <TableCell data-label="提交信息">
                          {r.submission
                            ? formatDate(r.submission.createdAt)
                            : '—'}
                          {r.submission?.link && (
                            <a
                              className="text-link"
                              href={r.submission.link}
                              target="_blank"
                              rel="noreferrer"
                            >
                              查看凭证
                            </a>
                          )}
                          {r.submission?.note && (
                            <p className="muted">{r.submission.note}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!rows.length && (
                  <Empty
                    title="还没有班级成员"
                    text="先设置班级邀请码，再邀请同学注册加入。"
                  />
                )}
              </>
            ) : (
              <Empty
                title="先发布第一份作业"
                text="同学打卡后，这里会自动统计已交、未交与迟交名单。"
              />
            )}
          </section>
        )}
        {adminTab === '内容管理' && (
          <div className="stack">
            {[
              ['assignment', '作业任务', data.assignments],
              ['teacher', '老师档案', data.teachers],
              ['notice', '公告通知', data.notices],
            ].map(([kind, title, items]: any) => (
              <section className="panel" key={kind}>
                <div className="section-heading">
                  <h2>{title}</h2>
                  <button
                    className="button secondary"
                    onClick={() => edit(kind)}
                  >
                    <Plus size={15} />
                    添加
                  </button>
                </div>
                {items.map((item: any) => (
                  <div className="manage-row" key={item.id}>
                    <div>
                      <strong>{item.title || item.name}</strong>
                      <p className="muted">
                        {item.archived
                          ? '已归档'
                          : item.course || item.category}
                      </p>
                    </div>
                    <button
                      className="button secondary small"
                      onClick={() => edit(kind, item)}
                    >
                      编辑
                    </button>
                    <button
                      className="button secondary small"
                      disabled={busy}
                      onClick={() =>
                        run(
                          {
                            action: 'archive',
                            kind,
                            id: item.id,
                            version: item.version,
                            archived: !item.archived,
                          },
                          item.archived ? '已恢复' : '已归档，记录仍保留',
                        )
                      }
                    >
                      {item.archived ? (
                        <RotateCcw size={14} />
                      ) : (
                        <Archive size={14} />
                      )}{' '}
                      {item.archived ? '恢复' : '归档'}
                    </button>
                  </div>
                ))}
                {!items.length && <p className="muted">尚未添加内容</p>}
              </section>
            ))}
          </div>
        )}
        {adminTab === '社区审核' && (
          <section className="panel">
            <h2>审核班级话题</h2>
            <p className="muted">
              公开前检查内容；不合适的话题可驳回，已发布的话题也可撤下。
            </p>
            {data.posts.map((p: any) => (
              <article className="review-card" key={p.id}>
                <span className="pill">
                  {p.status === 'pending'
                    ? '待审核'
                    : p.status === 'published'
                      ? '已发布'
                      : '已驳回'}
                </span>
                <h3>{p.title}</h3>
                <p className="muted">
                  发布者：{p.authorName}
                  {p.anonymous ? '（向同学匿名）' : ''} · {p.category}
                </p>
                <p className="prose">{p.body}</p>
                <div className="form-actions">
                  <button
                    disabled={busy || p.status === 'published'}
                    className="button"
                    onClick={() =>
                      run(
                        { action: 'moderate', id: p.id, status: 'published' },
                        '已通过审核',
                      )
                    }
                  >
                    通过审核
                  </button>
                  <button
                    disabled={busy || p.status === 'rejected'}
                    className="button secondary"
                    onClick={() =>
                      run(
                        { action: 'moderate', id: p.id, status: 'rejected' },
                        '话题已撤下',
                      )
                    }
                  >
                    驳回 / 撤下
                  </button>
                </div>
              </article>
            ))}
            {!data.posts.length && <Empty title="暂时没有待审核内容" />}
          </section>
        )}
        {adminTab === '班级设置' && (
          <section className="panel account-panel">
            <h2>班级与加入方式</h2>
            <p className="muted">
              邀请码只分享给本班同学。更换后，旧邀请码立即失效，已有成员不受影响。
            </p>
            <form
              className="form-stack mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  { action: 'settings', ...values(e) },
                  '班级设置已更新',
                );
              }}
            >
              <Field
                label="班级名称"
                name="className"
                value={data.settings.className}
                max={60}
              />
              <Field
                label="当前学期"
                name="semester"
                value={data.settings.semester}
                max={60}
              />
              <Field
                label="班级邀请码（至少 8 位）"
                name="joinCode"
                value={data.settings.joinCode}
                max={80}
              />
              <button className="button" disabled={busy}>
                保存设置
              </button>
            </form>
          </section>
        )}
      </>
    );
  }
  return (
    <SidebarProvider>
      <Sidebar className="campus-sidebar">
        <SidebarHeader>
          <a href="/" className="brand">
            <span className="brand-icon">
              <GraduationCap />
            </span>
            <span>
              学伴<small>学委服务站</small>
            </span>
          </a>
        </SidebarHeader>
        <SidebarContent>
          <div className="class-label">
            {data.settings.className}
            <span>{data.settings.semester}</span>
          </div>
          <nav className="side-nav">
            {nav
              .filter(([url]) => url !== '/admin' || data.isAdmin)
              .map(([url, name, Icon]) => (
                <a
                  href={url}
                  key={url}
                  className={
                    (url === '/' ? section === 'home' : path.startsWith(url))
                      ? 'active'
                      : ''
                  }
                  aria-current={
                    (url === '/' ? section === 'home' : path.startsWith(url))
                      ? 'page'
                      : undefined
                  }
                >
                  <Icon size={20} />
                  {name}
                  {(url === '/'
                    ? section === 'home'
                    : path.startsWith(url)) && <span className="nav-dot" />}
                </a>
              ))}
          </nav>
          <div className="side-note">
            <Sparkles size={20} />
            <strong>
              一起把大学生活，
              <br />
              过得有条不紊。
            </strong>
            <p>有事找学委，学习有同伴。</p>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <a href="/account" className="account-link">
            <span className="avatar">
              {(data.profile?.name || '同').slice(0, 1)}
            </span>
            <span>
              {data.profile?.name || '欢迎，同学'}
              <small>
                {data.isAdmin
                  ? '学习委员'
                  : data.profile
                    ? '班级成员'
                    : '登录后加入班级'}
              </small>
            </span>
            <ArrowUpRight size={18} />
          </a>
        </SidebarFooter>
      </Sidebar>
      <div className="app-main">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <span>
              班级空间 <span className="crumb">/ {label}</span>
            </span>
          </div>
          <a className="button small" href="/account">
            {data.identity ? '我的账号' : '注册 / 登录'}{' '}
            <ArrowUpRight size={15} />
          </a>
        </header>
        <main className="page">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {section === 'home'
                  ? 'YOUR CAMPUS, CONNECTED'
                  : 'OUR CLASSROOM'}
              </p>
              <h1>
                {titles[section] || '班级空间'}{' '}
                {section === 'home' && <span className="hello">✳</span>}
              </h1>
              <p className="muted">{subtitles[section]}</p>
            </div>
            {section === 'home' && (
              <a href={homeAction.href} className="button">
                {homeAction.label} <ArrowRight size={17} />
              </a>
            )}
          </div>
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button
                className="button secondary small"
                onClick={() => reload().catch(() => {})}
              >
                重新加载
              </button>
            </div>
          )}
          {loading && (
            <p role="status" className="muted loading-line">
              正在读取班级信息…
            </p>
          )}
          {section === 'home' ? (
            Dashboard()
          ) : section === 'account' ? (
            <Account data={data} run={run} busy={busy} reload={reload} />
          ) : !member ? (
            guard
          ) : section === 'assignments' ? (
            Assignments()
          ) : section === 'teachers' ? (
            Teachers()
          ) : section === 'community' ? (
            Community()
          ) : section === 'notices' ? (
            Notices()
          ) : section === 'admin' ? (
            Admin()
          ) : (
            <Empty title="页面不存在" />
          )}
          <footer>
            学伴 · 让班级的小事，都有着落。<span>为每一位同学而建</span>
          </footer>
        </main>
      </div>
      {modal && (
        <Editor
          key={`${modal.kind}-${modal.item?.id || 'new'}`}
          modal={modal}
          onClose={() => setModal(null)}
          busy={busy}
          run={run}
        />
      )}
      <Toaster richColors position="top-center" closeButton />
    </SidebarProvider>
  );
}
