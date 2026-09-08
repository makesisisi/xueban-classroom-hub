# 学伴 · 学委服务站

一个为大学班级设计的中文学习服务网站。独立页面覆盖班级概览、作业打卡、老师档案、班级社区、公告通知、账号与学委工作台，支持手机布局。

## 使用入口

- Netlify 正式入口：https://xueban-classroom-hub.netlify.app
- Sites 私有版本：https://xuewei-classroom-hub.chijiu.chatgpt.site
- GitHub 私有仓库：https://github.com/makesisisi/xueban-classroom-hub

两个托管版本使用相同业务逻辑，但账号和数据分别存储，不互相同步。面向班级推广时请选择 Netlify 作为唯一入口；Sites 保留为负责人私有版本。

## 首次开班

1. 打开 Netlify 的「注册 / 登录」，填写登录账号、找回邮箱和密码；注册后会自动登录，无需邮箱确认。
2. 进入「我的账号」底部的「我是学委 · 初始化班级」，输入本机 `.env` 内的 `ADMIN_SETUP_SECRET`。初始化码不能分享给同学，也不能提交到 Git。
3. 在「学委工作台 → 班级设置」填写班级名、学期和至少 8 位的邀请码。
4. 回到「我的账号」填写姓名与学号。
5. 将网站和班级邀请码发给同学。他们注册并加入班级后，才能看到班级信息。
6. 在「内容管理」添加老师、发布作业和公告；在「作业统计」查看已交、未交、迟交名单并导出 CSV。

Sites 版本使用 ChatGPT 登录，首次登录同样填写个人资料并初始化自己的班级。当前 Sites 的外层访问范围为负责人私有。

## 已实现功能

- 教师档案：姓名、课程、联系方式、办公室 / 答疑时间、上课技巧；支持添加、编辑、详情与归档恢复。
- 作业：课程、要求、截止时间、是否允许补交、搜索和状态筛选；每人每份作业一条打卡记录，可更新链接与说明。
- 统计：全班名单、已交 / 未交 / 迟交、提交时间和凭证链接、CSV 导出（防公式注入）。
- 社区：学习提问、经验分享、小吐槽、向同学匿名显示、话题审核、帖子详情和回复。学委能够看到匿名发帖者。
- 公告：发布、分类、搜索、详情、编辑与归档。
- 账号：Netlify 账号 / 邮箱登录、免验证注册、全局退出和密码恢复；Sites ChatGPT 登录；姓名、学号、班级邀请码。
- 管理：安全初始化唯一管理员、班级设置、邀请码轮换、内容管理、社区审核。

## 功能边界

- 作业打卡记录学生确认的提交状态，不会代替学校 LMS、教学平台或线下作业提交；支持 HTTPS 凭证链接与文字说明，不存储作业附件。
- 单站点对应一个班级，不包含多班级切换、管理员转让或邮件 / 短信催交通知。
- 截止提醒在页面中呈现，不会自动推送。
- 页面显示设备当地时间，服务端以 UTC 时间保存和判定截止。
- 教师联系方式仅供已加入的班级成员查看；应在老师同意后填写。
- 普通话题需学委审核后展示；匿名对同学隐藏姓名，对管理员不匿名。
- 新站线上不预填虚构老师、学生和作业。演示数据只写入本地数据库。

## 技术结构

- React 19、TypeScript、Vinext / Vite、Tailwind CSS、Shadcn / Base UI、Lucide。
- `components/campus.tsx`：班级页面与管理界面；`campus-forms.tsx`：表单和弹窗；`account.tsx`：账号流程。
- `lib/service.ts`：共享服务逻辑，每个读写操作独立检查身份和权限，不依赖前端隐藏按钮。
- `app/api/campus/route.ts`：Sites 请求入口，使用平台转发的可信身份和 D1。
- `netlify/functions/campus.mts`：Netlify Functions 请求入口，使用 `@netlify/identity` 验证身份，Netlify Blobs 强一致读写。
- `db/schema.ts`、`drizzle/`：D1 结构和迁移；`lib/d1-store.ts`：参数化 SQL 和版本条件更新。
- 记录分键保存，打卡按「作业 + 用户」唯一键保存；关键新增和修改使用原子条件写入，避免并发覆盖。
- 不将密码、角色或业务数据存入自制浏览器缓存。身份 SDK 自行维护登录会话。

## 本地开发（Windows PowerShell）

需要 Node.js 22.13 或更高版本。

```powershell
npm.cmd ci
node scripts/init-secret.mjs
Copy-Item .env .dev.vars
npm.cmd exec wrangler -- d1 execute site-creator-d1 --local --config wrangler.local.json --file drizzle/0000_oval_northstar.sql
npm.cmd run dev
```

打开终端输出的本地地址。Sites 开发登录使用脚手架提供的 `local_seedy` 测试身份，只在本机生效。使用 `.env` 的初始化码设置本地管理员后，可以运行 `node scripts/local-smoke.mjs` 生成演示记录并验证真实 D1 读写；此脚本会向本地数据库添加演示数据。

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run build:netlify
```

## 部署

### Netlify

使用 `netlify.toml`：构建命令 `npm run build:netlify`，静态目录 `netlify-dist`，Functions 目录 `netlify/functions`。`ADMIN_SETUP_SECRET` 在 Netlify 环境变量中设置。开启 Identity；`/api/auth` 通过 Identity 管理接口创建已确认用户，因此新用户不需要点击确认邮件。

```powershell
npm.cmd exec --yes --package=netlify-cli -- netlify deploy --prod --no-build --dir netlify-dist --functions netlify/functions
```

上面的命令要求先完成 `npm run build:netlify` 并登录 / 链接到对应站点。GitHub 仓库用于源码维护；当前发布使用 CLI，不承诺推送后自动部署。

### Sites

保留 `.openai/hosting.json` 的项目 ID。运行 `npm run build`，通过 Sites 技能的打包器保存版本并私有发布。修改 D1 模式时新增 Drizzle 迁移，不改写已应用的迁移。

## 验证

- 10 项服务测试：匿名访问、初始化竞争、邀请码和越权、CSRF / JSON、唯一打卡、并发提交、迟交、链接及长度校验、匿名审核、编辑冲突和归档。
- 本地实际 D1 读写：初始化、加入班级、添加教师 / 作业 / 公告、打卡及重新读取，匿名隐私隔离。
- Sites 与 Netlify 两种生产构建、TypeScript 检查。
- Netlify 线上密码登录、JWT 身份校验、真实 Blobs 条件写入、打卡与重新读取、匿名数据隔离通过；临时验证账号和数据已清理。
- 已用 390 × 844 手机视口检查会话恢复页、登录和注册表单，并验证不存在账号登录时会返回清晰错误；新账号成功注册和实际密码重置邮件仍需用真实邮箱完成最终确认。WebMCP 仅在支持该标准的浏览器中注册只读作业工具。

仅初始化码保存在本地忽略文件；仓库、前端和提交记录中不得放置账号令牌与密钥。

