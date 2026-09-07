import fs from 'node:fs';
const base = 'http://localhost:3000';
const headers = {
  'Content-Type': 'application/json',
  Origin: base,
  Cookie: '__sites_local_auth=1',
};
const post = async (body) => {
  const r = await fetch(base + '/api/campus', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error);
  return j;
};
await post({
  action: 'settings',
  className: '软件工程 2026 级 1 班（本地演示）',
  semester: '2026 · 秋季学期',
  joinCode: 'local-class-2026',
});
await post({ action: 'join', name: '演示学委', studentId: 'DEMO001' });
const teacher = await post({
  action: 'save',
  kind: 'teacher',
  data: {
    name: '陈老师（演示）',
    course: '高等数学',
    contact: '请向学委索取（演示）',
    office: '周三 15:00–17:00 · 数学楼 302',
    tips: '课前先看定义和例题。课堂上标记不理解的推导，课后带着具体问题答疑。',
  },
});
const task = await post({
  action: 'save',
  kind: 'assignment',
  data: {
    title: '第一章 · 函数与极限（演示）',
    course: '高等数学',
    description: '完成习题 1-1，第 2、4、6 题。先按老师要求交作业，再来打卡。',
    dueAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    allowLate: true,
  },
});
await post({
  action: 'submit',
  assignmentId: task.id,
  note: '已完成提交，本条为本地演示记录。',
});
await post({
  action: 'save',
  kind: 'notice',
  data: {
    title: '新学期，欢迎加入学伴（演示）',
    category: '班级通知',
    body: '同学们可以查看作业、老师档案，也欢迎分享学习经验。',
  },
});
const r = await fetch(base + '/api/campus', { headers });
const d = await r.json();
if (d.teachers.length < 1 || d.submissions.length < 1 || !d.isAdmin)
  throw new Error('Read-back failed');
const anon = await (await fetch(base + '/api/campus')).json();
if (anon.teachers.length || anon.submissions.length)
  throw new Error('Privacy failed');
console.log(
  'Local D1: admin setup, join, teacher, assignment, submission, notice, read-back and anonymous privacy PASS',
);
