# CookieCloud 本地小补丁镜像

- 上游：https://github.com/easychen/CookieCloud
- 固定源码：`217612dd675d194db8036bc22e632173dc7ace34`，取自 `api/`，不是旧 `docker/app.js`。
- 本地版本 / 镜像标签：`cookiecloud-local:217612dd675d-p1`。
- 保留上游 GPL-3.0 LICENSE；本目录包含实际构建源码、依赖锁和测试。

## 补丁边界

1. Node 24 LTS Alpine，基础镜像通过 Dockerfile digest 固定。
2. 修复 SIGTERM：保存 HTTP server 引用，删除不存在的 cache 关闭逻辑，连接关闭后结束日志流并自然退出。
3. Winston 使用 JSON 控制台日志，不向容器可写层的 logs/ 写文件。
4. Multer 从 1.x 更新到 2.4.x；移除无须发布的 nodemon 和被 Node 内置模块替代的 npm path 依赖。`package-lock.json` 固定全部实际版本，构建使用 `npm ci --omit=dev --ignore-scripts`。
5. 以 UID/GID 1000:1000 运行，数据仍位于 `/data/api/data`，端口仍为 8088；增加 `/health` 容器检查（支持 PORT / API_ROOT）。

不修改 CookieCloud 协议、算法、访问控制、限流策略或服务端可选解密功能。UUID 仍不是完善的身份验证；应限制网络访问、使用 HTTPS，推荐消费端本地解密。反向代理后的限流仍按上游默认行为，未启用 trust proxy。

CryptoJS 4.2.0 已被上游标为停止维护；此补丁为保持算法兼容而保留它。npm audit 的零已知漏洞不等于整体安全审计通过。

## 验证与构建

构建上下文仅为本目录，`.dockerignore` 使用文件白名单，不包含 `../data/` 或部署配置。

Dockerfile 在独立测试阶段、非 root 用户下运行 `tests/smoke.cjs`，只生成临时虚构数据：

- 健康检查与 API_ROOT；
- gzip JSON 上传 / 密文下载 / 本地解密；
- legacy 和 aes-128-cbc-fixed，以及可选服务端解密；
- 旧 multipart 上传和默认 legacy 字段；
- SIGTERM 正常退出。

win-mini WSLC 构建命令（PowerShell，context 为本机上传的独立快照）：

```powershell
$WSLC = 'C:\Program Files\WSL\wslc.exe'
& $WSLC build --progress plain -t cookiecloud-local:217612dd675d-p1 $context
& $WSLC image inspect cookiecloud-local:217612dd675d-p1
& $WSLC save -o "$job\cookiecloud-local.tar" cookiecloud-local:217612dd675d-p1
```

每次构建保存源码清单和 SHA256、日志、镜像 inspect、导出产物 SHA256 到 `../builds/<job>/`（不纳入 Git）。未修改源码和锁文件的构建不重新解析依赖；升级依赖需显式刷新锁文件、audit 并重新构建。

## 部署边界

此镜像的构建不代表已部署。现有 `../docker-compose.yaml` 不自动改动，服务不会自动启动；本机镜像导入 / Dockge 应用需另行执行。

保留原数据挂载。部署前确认宿主机 data 目录可供 UID 1000 写入，不自动修改旧数据所有权。当前检查只涉及目录权限，没有读取 Cookie 内容。

真实浏览器扩展 / PT / MoviePilot 流程不在虚构数据冒烟测试的覆盖范围内。

## 远程构建记录（2026-09-20）

- 成功任务：`../builds/wslc-20260920T114145Z/`，win-mini WSLC 2.9.11，Linux/amd64，Node 24.21.0。
- 镜像 ID：`sha256:faa2e88d93308b0ca98f50d4fbd7fc33c179b0aa0b2a5d4547e252dd4c603a5b`。
- 本机归档：`../builds/wslc-20260920T114145Z/cookiecloud-local.tar`，179,882,496 bytes。
- 归档 SHA256：`1e3ec6416f17b3dcfb9ab80054a64fcf1ee6d749848fa6de41fc17ca7d68f271`，与远端一致；已核对归档镜像标签、config digest 及源码快照摘要。
- 构建阶段 API 冒烟测试通过；最终镜像使用 `--network none`、无宿主挂载的临时容器验证了非 root 启动、health 和 SIGTERM，退出后自动移除。
- 导出归档 config 包含 HEALTHCHECK（WSLC image inspect 输出省略此字段）。
- 依赖 audit：0 项已知漏洞，仅 npm 依赖范围，不是基础镜像 CVE 扫描。
- 首次任务 `wslc-20260920T113843Z` 构建成功但最终启动失败，原因是数据目录尚未创建。已修正为镜像预建 UID 1000 可写的空 data 目录，失败日志保留。成功重建约 12.19 秒，复用了首次构建缓存，不是冷构建成绩。
- 构建完成时：远端镜像与本机归档均已生成，尚未部署。后续已通过 Dockge 从同一冻结源码构建并上线；没有导入此远程镜像归档，当前状态及本机构建 digest 见 `../DEPLOYMENT.md`。
