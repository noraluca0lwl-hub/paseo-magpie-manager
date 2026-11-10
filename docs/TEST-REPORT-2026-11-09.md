# Magpie Manager 功能整理与全量回归报告

- 日期：2026-11-09（UTC）
- 基线提交：`9a9e9bf`；本轮包含工作区此前未提交的路由接线与编辑器。
- 目标：整理现行功能、执行全部现有测试、记录失败与未验收项，不添加图片以外的新页面。
- 结论：**执行完全部 19 个历史浏览器脚本，并非全部功能通过。** 四组仓库测试、类型检查、预览构建、17 个真实读取接口和 Paseo 宿主 RPC 通过。初跑浏览器脚本 12 通过、7 失败；修正旧测试选择器后，资源编辑与网关会话操作另行通过。其余失败见下表。

## 1. 本轮整理

1. README 按模块重排，撤掉已经过时的“会话为空”“没有导出”“没有请求统计”等描述。
2. 增加 `npm test` 统一执行仓库内四组测试。
3. 增加 `npm run test:live` 和 `tests/live-readonly.ts`，串行检查 17 个本机接口，仅记录路径、状态、耗时、返回形态，不输出密钥或响应正文。
4. 整理路由现有工作区：页面只读回调、组编辑器、trace/history 查看、自动发现与排除项、接口允许列表与相应测试。
5. 修正路由文件尾部空行，差异检查通过。
6. 未执行用户真实会话删除、迁移、密钥轮换或 Agent 配置改写。

## 2. 验证层级

| 层级 | 含义 | 本轮状态 |
|---|---|---|
| 静态与纯数据 | TypeScript、差异、数据转换与接口允许列表 | 通过 |
| 模拟界面 | Chromium + React Native Web + 拦截 RPC，模拟成功／失败 | 覆盖多个模块；部分脚本失败 |
| 真实读取 | 本机 Magpie GET 及 Paseo 宿主 RPC | 通过 |
| 真实写入 | 实际新增、删除、迁移、轮换、分发 | 未执行 |
| 手机 App 实机 | 原生图片、触摸、剪贴板、弹层 | 未执行 |
| 视觉 1:1 | 同尺寸参考图逐像素比较 | 未完成 |

模拟写入通过不等于真实写入通过；HTTP 返回对象不等于全部字段正确。

## 3. 仓库测试

| 命令／脚本 | 结果 | 检查内容 |
|---|---|---|
| `npm run typecheck` | PASS | 全项目类型检查，含新增 live 脚本 |
| `tests/official-api.test.ts` | PASS | 登录 single-flight、cookie、GET/POST、错误传递、路径与查询允许列表 |
| `tests/gateway-data.test.ts` | PASS | 网关模型筛选、协议端点、敏感头脱敏 |
| `tests/provider-capabilities.test.ts` | PASS | 能力标记同时约束显示与保存参数 |
| `tests/provider-form.test.ts` | PASS | 模型选择、分隔、Headers、读取 DTO 隔离、配置保留 |
| 预览构建 `build.cjs` | PASS | 浏览器预览打包 |
| `git diff --check` | PASS | 本轮整理后的工作区 |
| Paseo plugin reload | PASS | `magpie-manager running` |
| 宿主真实 RPC | PASS | `magpie.official` 读取 `gateway/trace?after=0` |

Node 输出 `MODULE_TYPELESS_PACKAGE_JSON` 警告，测试仍通过；未为消除警告而改动整个包的模块模式。

## 4. 真实只读接口：17/17

以下接口均通过 `officialRequest` 实际请求，并重新通过 `npm run test:live` 执行：

| 接口 | 结果 |
|---|---|
| `state` | PASS |
| `providers` | PASS |
| `settings` | PASS |
| `sessions/manage` | PASS |
| `library` | PASS |
| `usage?period=30d` | PASS |
| `usage/requests?period=30d&offset=0&limit=50` | PASS |
| `usage/heatmap` | PASS |
| `usage/quotas` | PASS |
| `context` | PASS |
| `groups` | PASS |
| `upstream` | PASS |
| `caller-keys` | PASS |
| `masking/summary` | PASS |
| `plugins` | PASS |
| `gateway/history` | PASS |
| `gateway/trace?after=0` | PASS |

## 5. 全部历史浏览器脚本

测试位于本机 `/tmp/magpie-panel-preview`，不是仓库内自包含测试套件。桌面宽度包括 1244/1440，手机尺寸宽度 390；个别脚本覆盖浅色／暗色。下表每行表示脚本，而非单个断言。

| 脚本 | 初跑 | 复核结果／解释 |
|---|---|---|
| `test-gateway.py` | PASS | 网关页面、模型、调用与密钥模拟交互 |
| `test-library-rtk.py` | PASS | 资源库与 RTK 页面 |
| `test-model-advanced.py` | FAIL | 仍访问已撤掉的单模型编辑控件；旧流程失效，当前模型高级功能未因此获得完整验收 |
| `test-provider-icons.py` | PASS | 供应商图标与保存参数 |
| `test-provider-limits.py` | PASS | 高级限额／能力约束 |
| `test-resources.py` | FAIL | 修正“子代理”、页顶技能查找和重复文本选择器后，桌面／手机尺寸浅暗色四组通过；失败保存保留输入、多文件草稿与关闭确认通过 |
| `test-routing-complete.py` | PASS | 路由实时数据、历史、自动发现与模拟请求 |
| `test-routing-editor.py` | PASS | 路由编辑器与保存失败输入保留 |
| `test-screenshot-advanced.py` | PASS | 供应商高级字段模拟交互 |
| `test-session-auto-reads.py` | PASS | 自动读取与顶部 Agent 切换 |
| `test-session-details.py` | FAIL | 旧分组点击选择器修正后桌面通过；390px 仍在“展开会话 会话功能对照”点击超时，未查清是布局、命中区域还是预览环境问题；保持未通过 |
| `test-session-gateway-actions.py` | FAIL | 修正旧迁移说明、旧“允许读取”按钮断言后，1440/390 均通过；覆盖 read_only + deletable、网关迁移说明、整组删除模拟请求和自动读取 |
| `test-session-group-actions.py` | PASS | 浮层、迁移预览令牌失效、搜索下整组删除确认 |
| `test-skill-find-delete.py` | PASS | 技能查找、删除确认、失败重试与刷新 |
| `test-template-edit.py` | FAIL | 查找旧“路由组成员”文本框超时；现行编辑器已换成员选择结构；新模板全流程仍需补测 |
| `test-usage-chart.py` | PASS | 柱状／曲线、数据点、指标切换、拆分列表限高 |
| `test-usage-month.py` | FAIL | 断言月历、上个月／下个月；现行设计已按图片恢复 53 周网格，脚本失效 |
| `test-usage-reference.py` | PASS | 现行请求页结构、筛选搜索、53 周热力图、来源与明细 |
| `test-usage.py` | FAIL | 旧脚本要求概览页显示热力图；现行概览与请求已分离，脚本失效 |

初跑：19 个脚本，12 PASS / 7 FAIL。复核资源与网关会话操作通过后：14 个脚本有完整通过记录，5 个仍失败或失效；其中会话详情桌面单尺寸通过，手机尺寸未通过。未将旧脚本删除来制造全绿。

## 6. 功能覆盖与缺口

| 模块 | 本轮证据 | 仍缺验证 |
|---|---|---|
| 导航／外观 | 多模块桌面／手机尺寸浏览器 | 手机 App 实机 |
| Agent | state/providers 读取、部分页面流程 | 真实连接／断开、方案写入、全按钮逐项用例 |
| 中转 | 图标、限额、高级字段、纯数据测试 | 真实保存／删除／检测、已撤控件的替代完整测试 |
| 网关 | 真实读取与界面模拟 | 真实调用密钥变更、共享配置写入 |
| 路由 | 两组现行编辑器／详情测试 | 新模板独立完整回归、真实策略切换 |
| 会话 | 自动读取、分组与网关模拟操作、桌面详情 | 390px 详情点击失败；真实删除、迁移、转换、导出、实机复制 |
| 资源库 | 浅暗色四组编辑、技能查找／删除、RTK 页面 | 真实资源安装／分发、Hook 开关 |
| 用量 | 真实读取、现行请求页与图表 | 会话／上下文页所有交互的独立断言，自定义日期、CSV、5 秒刷新 |
| 上游／脱敏／插件／设置 | 真实 GET 返回 | 独立界面交互与全部写入分支 |

## 7. 复现方式与证据

仓库内可直接运行：

```sh
npm ci
npm run typecheck
npm test
npm run test:live
```

本机浏览器工作区：

```sh
node /tmp/magpie-panel-preview/build.cjs
python3 /tmp/magpie-panel-preview/test-usage-chart.py
python3 /tmp/magpie-panel-preview/test-usage-reference.py
python3 /tmp/magpie-panel-preview/test-resources.py
python3 /tmp/magpie-panel-preview/test-session-gateway-actions.py
```

完整初跑和复核日志：本机 `/tmp/magpie-full-regression/`。截图：本机 `/tmp/magpie-panel-preview/screenshots/`。这些临时文件未上传，跨主机复现浏览器测试仍需整理预览依赖、RPC fixtures 和浏览器路径；仓库内四组测试与 live 脚本不依赖该工作区。

## 8. 补充：跨页面进入资源库崩溃

- 用户反馈后新增“设置 → 资源库”真实返回结构浏览器复现，捕获 `Cannot read properties of undefined (reading 'sets')`。
- 根因：页面切换首帧仍使用上一页的 `section`，资源库在新请求完成前读取设置数据的 `instructions.sets`；之前从 Agent 首页直接进入的用例未覆盖这个状态。
- 修复：为 section 绑定所属页面，仅在 `sectionPage === page` 时向子页面传数据，否则显示读取状态；请求 generation 检查继续阻止过期响应。
- 复验：1244/390 两种宽度的“设置 → 资源库”均无 pageerror；资源库指令、技能导入失败保留、RTK 页面回归均通过；类型检查、四组仓库测试、差异检查通过。
- 本机新增回归：`/tmp/magpie-panel-preview/test-library-navigation.py`。手机 App 实机仍待验收。

## 9. 后续确定项

1. 优先定位 390px 会话详情点击超时，增加命中区域和展开状态证据。
2. 用现行成员选择器重写模板测试，替换已失效的单模型高级／旧月历／旧概览脚本。
3. 将浏览器测试与 fixtures 整理成仓库内自包含套件。
4. 补 Agent、设置、上游、脱敏、插件的独立操作用例。
5. 实际数据改写与手机 App 实机验收单独安排，不以当前回归替代。
