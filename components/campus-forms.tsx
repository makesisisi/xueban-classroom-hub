'use client';
import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
export const values = (event: FormEvent<HTMLFormElement>) =>
  Object.fromEntries(new FormData(event.currentTarget));
export function Field({
  label,
  name,
  type = 'text',
  value = '',
  required = true,
  max = 200,
  area = false,
}: any) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <i> *</i>}
      </span>
      {area ? (
        <textarea
          name={name}
          defaultValue={value}
          required={required}
          maxLength={max}
          rows={4}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          maxLength={max}
        />
      )}
    </label>
  );
}
export function Choice({ label, value, onChange, options }: any) {
  return (
    <div className="field">
      <span>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="w-full h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o: string) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function Toggle({ label, checked, onChange }: any) {
  return (
    <label className="toggle">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
export function Editor({ modal, onClose, run, busy }: any) {
  const [allowLate, setAllowLate] = useState(modal.item?.allowLate ?? true),
    [category, setCategory] = useState('学习提问'),
    [anonymous, setAnonymous] = useState(false);
  const item = modal.item || {};
  const kind = modal.kind;
  const titles: any = {
    teacher: item.id ? '编辑老师档案' : '添加老师档案',
    assignment: item.id ? '编辑作业' : '发布新作业',
    notice: item.id ? '编辑公告' : '发布公告',
    post: '和同学聊一聊',
    submit: '交作业 · 打卡',
  };
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = values(e);
    let payload: any;
    if (kind === 'submit')
      payload = { action: 'submit', assignmentId: item.id, ...v };
    else if (kind === 'post')
      payload = { action: 'post', ...v, category, anonymous };
    else {
      if (kind === 'assignment')
        v.dueAt = new Date(String(v.dueAt)).toISOString();
      payload = {
        action: 'save',
        kind,
        id: item.id,
        version: item.version,
        data: { ...v, allowLate },
      };
    }
    if (
      await run(
        payload,
        kind === 'post' ? '已提交，审核后会展示给全班' : '已保存',
      )
    )
      onClose();
  }
  const due = item.dueAt
    ? new Date(
        new Date(item.dueAt).getTime() -
          new Date(item.dueAt).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : '';
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="editor-modal">
        <DialogHeader>
          <DialogTitle>{titles[kind]}</DialogTitle>
          <DialogDescription>
            {kind === 'submit'
              ? item.title
              : kind === 'post'
                ? '分享经验、提出问题，也可以温和吐槽。请勿发布人身攻击和他人隐私。'
                : '填写班级需要的信息，保存后即可查看。'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="form-stack">
          {kind === 'teacher' && (
            <>
              <div className="form-pair">
                <Field
                  label="老师姓名"
                  name="name"
                  value={item.name}
                  max={30}
                />
                <Field
                  label="授课科目"
                  name="course"
                  value={item.course}
                  max={80}
                />
              </div>
              <Field
                label="联系方式（请先取得老师同意）"
                name="contact"
                value={item.contact}
                required={false}
                max={300}
              />
              <Field
                label="办公室 / 答疑时间"
                name="office"
                value={item.office}
                required={false}
              />
              <Field
                label="上课小技巧"
                name="tips"
                value={item.tips}
                required={false}
                area
                max={3000}
              />
            </>
          )}
          {kind === 'assignment' && (
            <>
              <Field
                label="作业名称"
                name="title"
                value={item.title}
                max={120}
              />
              <div className="form-pair">
                <Field
                  label="课程"
                  name="course"
                  value={item.course}
                  max={80}
                />
                <Field
                  label="截止时间（当前设备时区）"
                  name="dueAt"
                  type="datetime-local"
                  value={due}
                />
              </div>
              <Field
                label="作业要求 / 提交方式"
                name="description"
                value={item.description}
                area
                max={4000}
              />
              <Toggle
                label="截止后允许补交（标记为迟交）"
                checked={allowLate}
                onChange={setAllowLate}
              />
            </>
          )}
          {kind === 'notice' && (
            <>
              <Field label="标题" name="title" value={item.title} max={120} />
              <Field
                label="分类"
                name="category"
                value={item.category || '班级通知'}
                max={30}
              />
              <Field
                label="公告内容"
                name="body"
                value={item.body}
                area
                max={5000}
              />
            </>
          )}
          {kind === 'post' && (
            <>
              <Choice
                label="话题分类"
                value={category}
                onChange={setCategory}
                options={['学习提问', '经验分享', '小吐槽']}
              />
              <Field label="标题" name="title" max={100} />
              <Field label="想说的话" name="body" area max={3000} />
              <Toggle
                label="向同学匿名显示（学委仍可查看发布者）"
                checked={anonymous}
                onChange={setAnonymous}
              />
            </>
          )}
          {kind === 'submit' && (
            <>
              <p className="info-box">
                这是提交记录。若老师要求在其他平台或线下交作业，请先完成实际提交，再来打卡。
              </p>
              <Field
                label="作业 / 提交凭证链接（HTTPS，可选）"
                name="link"
                type="url"
                value={modal.submission?.link}
                max={1000}
                required={false}
              />
              <Field
                label="提交说明（可选）"
                name="note"
                value={modal.submission?.note}
                area
                max={2000}
                required={false}
              />
            </>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
              disabled={busy}
            >
              取消
            </button>
            <button className="button" disabled={busy}>
              {busy ? '正在保存…' : kind === 'submit' ? '确认已交作业' : '保存'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
