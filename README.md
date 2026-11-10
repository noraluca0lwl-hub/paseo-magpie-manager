# Magpie Manager for Paseo

通过 Paseo 桌面／手机管理 **Paseo daemon 所在主机**上的 Magpie。插件使用 React Native，不是独立网站，也不会让手机访问手机自身的 localhost。

## 架构

Paseo 客户端 → 插件页面 → Paseo 认证 RPC → 插件服务端 → 本机 Magpie 官方 HTTP API。

Magpie Web 密钥仅由服务端读取，不打入客户端。接口桥接使用路径、方法与查询参数允许列表。

## 功能整理

| 模块 | 当前接线 | 验证边界 |
|---|---|---|
| Agent | 状态、模型选择、连接／断开、方案保存与使用 | 真实读取；配置写入以模拟测试为主 |
| 中转供应商 | 新增／编辑／删除确认、五种协议、模型发现与检测、高级参数、自定义图标 | 图标通过认证 RPC 加载；手机 App 图片格式兼容待实机验收 |
| 网关 | 状态、调用记录、请求详情、示例命令、调用密钥管理 | 真实读取；密钥变更未在真实数据上执行 |
| 路由 | 路由组与模板、编辑器、自动发现、排除供应商、实时决策、历史详情 | 真实读取；保存与错误保留使用模拟请求验证 |
| 会话 | 自动读取 Agent、筛选搜索、分组、行内详情与消息、思考折叠、复制、转换、导出、删除确认、Claude 项目迁移 | 真实读取；删除／迁移／转换未对用户会话执行 |
| 资源库 | 指令方案、技能查找与安装、已有技能导入／删除、MCP、Hooks、子 Agent 编辑与分发 | 浏览器交互与失败保留验证；真实分发待验收 |
| RTK | 检测、安装／更新、统计、Agent Hook 开关 | 已安装版本曾独立核验；Hook 真实开关待验收 |
| 用量 | 概览／请求／会话／上下文、筛选、统计、柱状／曲线、内部滚动拆分列表、53 周热力图、请求明细 | 真实只读接口与桌面／手机尺寸浏览器验证 |
| 外观与导航 | 窄屏抽屉、中文导航、跟随 Paseo／浅色／暗色 | 浏览器验证；手机 App 实机待验收 |
| 上游／脱敏／插件／设置 | 对应页面与官方读取接口 | 完整操作覆盖见测试报告；不以接口可读替代操作验收 |

界面参考 `yetone/magpie` Windows GUI 源码，属于原生移植，未完成同尺寸逐像素 1:1 验收。

## 安装与配置

插件只提供 **Paseo 内的管理面板**；Magpie 本体、它的本机管理 API 与模型网关仍由 Magpie 提供。以下命令都在 **运行 Paseo daemon 的同一台机器、同一个系统用户** 下执行，不需要复制别人的供应商配置或密钥。Magpie 官方版本：[下载页](https://github.com/yetone/magpie-releases/releases/latest) · [安装文档](https://usemagpie.ai/docs/start)。

### Linux 服务器（无桌面）

1. 安装 Magpie 终端版本；安装完成后确认命令位置：

   ```bash
   curl -fsSL https://usemagpie.ai/install.sh | sh -s -- --tui
   export PATH="$HOME/.local/bin:$PATH"
   command -v magpie
   magpie --version
   ```

   插件按顺序使用 `MAGPIE_BIN` 指定的路径、`~/.local/bin/magpie`、系统 `PATH` 里的 `magpie`。`~` 是 **Paseo daemon 运行用户** 的家目录，不是插件开发者的 `/root`。终端版本的界面无需常驻；下面由服务保持 Magpie 运行。

2. 启动带认证的 **本机** Magpie 管理 API 和模型网关。插件调用 `/api/*`，因此后台服务必须开启 `--web`；裸 `magpie serve` 缺少面板所需的管理接口。服务监听 `127.0.0.1`，无需向外公开 3430 端口：

   ```bash
   mkdir -p ~/.config/magpie ~/.config/systemd/user
   chmod 700 ~/.config/magpie
   magpie daemon install --web --addr 127.0.0.1:3430
   systemctl --user enable --now magpie.service
   magpie daemon status  # 输出包含本机登录链接：勿分享或粘贴其完整内容
   ```

   若这台机器在退出登录后停止用户级 systemd 服务，由管理员为该用户开启 linger：`sudo loginctl enable-linger "$(id -un)"`。Windows/macOS 版本的安装与服务管理按 [Magpie 官方文档](https://usemagpie.ai/docs/start) 操作；Paseo 与 Magpie 仍运行于同一用户账户下。

3. 把 Magpie 服务使用的 **同一把** `MAGPIE_WEB_KEY` 存给插件服务端。先在当前终端设置密钥，服务通过用户级 systemd 环境文件读取它；插件读取 `~/.config/magpie/paseo-web-key`。以下密钥在同一用户的同一主机本地生成，不上传仓库：

   ```bash
   install -d -m 700 ~/.config/magpie
   MAGPIE_WEB_KEY="$(openssl rand -hex 32)"
   umask 077
   printf '%s\n' "MAGPIE_WEB_KEY=$MAGPIE_WEB_KEY" > ~/.config/magpie/paseo-web.env
   printf '%s' "$MAGPIE_WEB_KEY" > ~/.config/magpie/paseo-web-key
   chmod 600 ~/.config/magpie/paseo-web.env ~/.config/magpie/paseo-web-key
   # 沿用官方服务的 ExecStart，仅注入密钥文件。
   install -d -m 700 ~/.config/systemd/user/magpie.service.d
   printf '[Service]\nEnvironmentFile=%s/.config/magpie/paseo-web.env\n' "$HOME" > ~/.config/systemd/user/magpie.service.d/10-paseo-key.conf
   systemctl --user daemon-reload
   systemctl --user restart magpie.service
   unset MAGPIE_WEB_KEY
   ```

   已有 Magpie 服务且已有 `MAGPIE_WEB_KEY` 时，沿用原密钥并写入上述两个文件，避免其他正在使用的客户端会话失效。密钥也能通过 Paseo daemon 环境变量 `MAGPIE_WEB_KEY` 提供，后者优先。`MAGPIE_WEB_ORIGIN` 默认为 `http://127.0.0.1:3430`，仅在修改本机监听地址时设置。文件和服务都以 **daemon 运行用户** 读写。

4. 安装 GitHub 插件并打开 Paseo 面板：

   ```bash
   paseo plugin add git:noraluca0lwl-hub/paseo-magpie-manager
   paseo plugin ls
   paseo plugin reload magpie-manager
   ```

   Paseo 插件安装在该 daemon 自身的插件目录，具体安装路径由 Paseo 管理，无需手建或复制 `~/.paseo/plugins`。Paseo 客户端的侧边栏选择 **Magpie** 即可管理这台机器。插件面板通过 Paseo RPC 访问同机 Magpie，浏览器不用打开 3430；但当前版本的后台管理 API 仍由 `magpie web` 提供，关闭它会使面板失效。

### 路径、环境变量和验证

| 项目 | 路径或值 | 用途 |
|---|---|---|
| Magpie 程序 | `MAGPIE_BIN` → `~/.local/bin/magpie` → `PATH` | 插件服务端执行 Magpie CLI |
| Magpie 配置 | `~/.config/magpie/` | 由 Magpie 保存供应商与服务设置；勿复制他人的配置 |
| 插件登录密钥 | `~/.config/magpie/paseo-web-key`（`0600`） | 必须与 Magpie 服务的 `MAGPIE_WEB_KEY` 一致 |
| 服务环境文件 | `~/.config/magpie/paseo-web.env`（`0600`） | systemd 用户服务读取同一密钥 |
| 服务覆写文件 | `~/.config/systemd/user/magpie.service.d/10-paseo-key.conf` | 保留官方 ExecStart，只注入 EnvironmentFile |
| 本机管理 API | `MAGPIE_WEB_ORIGIN`，默认 `http://127.0.0.1:3430` | 仅插件服务端访问；不面向手机或公网 |
| 模型网关 | `http://127.0.0.1:3425/v1` | Magpie 模型请求通道，与面板管理 API 分离 |
| 插件目录 | Paseo 自行管理 | `paseo plugin ls` 可查实际安装位置 |

```bash
magpie daemon status
paseo plugin ls
paseo plugin logs magpie-manager
```

查看 `paseo plugin logs` 的 `Plugin ready` 仅验证服务端加载；最终还需在 Paseo 侧边栏打开 Magpie，检查供应商列表与编辑、移除按钮。

## 测试

Node.js 需支持 `--experimental-strip-types`。

```sh
npm ci
npm run typecheck
npm test
# 需要同机 Magpie 已启动、Web 密钥已配置；只执行 GET，不输出响应正文。
npm run test:live
```

- `tests/*.test.ts`：独立模拟服务／纯数据测试，不需要真实 Magpie。
- `tests/live-readonly.ts`：17 个真实读取接口的集成冒烟测试，不代表全部字段或写操作验收。
- 浏览器回归使用本机 `/tmp/magpie-panel-preview` 测试工作区；它不是仓库内可独立安装的测试套件，报告明确记录此限制。
- 正式结果、失败项、历史脚本失效情况见 [全功能回归报告](docs/TEST-REPORT-2026-11-09.md)。

## 已知未验收项

- 手机 App 真机剪贴板、弹层、图片格式和触摸滚动。
- 真实会话删除、迁移、转换、Markdown 导出，真实资源分发、密钥轮换与配置改写。
- 自定义日期、5 秒刷新、CSV 导出和完整 Windows 像素级对齐。
- 原生消息图片附件与在宿主直接执行继续命令。

历史实现保留在 Git 提交中；测试报告按“模拟交互”“真实读取”“真实写入”“实机验收”区分证据，不混报。
