# 内网文件共享（share-file-unsafe）

一个用于局域网内快速共享与管理文件的极简 Spring Boot 应用。强调“快速”和“方便”，不包含认证与加密等安全能力，适用于可信内网环境的临时/便捷使用场景。

## 功能概览
- 浏览共享根目录及子目录，按目录优先排序
- 单文件下载（支持 UTF-8 文件名）
- 多方式上传：文件选择、粘贴上传、拖拽上传，含进度条
- 新建文件夹、重命名、移动
- 单项删除与批量删除（目录递归删除）

## 技术栈
- 后端：Spring Boot 2.3.x（`spring-boot-starter-web`）
- 前端：原生 HTML + CSS + JavaScript（无框架）

## 目录结构
```
share-file-unsafe/
├── pom.xml
└── src/
    └── main/
        ├── java/com/example/sharefileunsafe/
        │   ├── ShareFileUnsafeApplication.java    # 应用入口
        │   ├── config/StorageProperties.java      # 存储根目录配置
        │   ├── controller/FileController.java     # REST API 控制器
        │   ├── model/{FileInfo,DeleteResult}.java # 传输模型
        │   ├── service/FileService.java           # 文件操作服务
        │   └── util/PathUtils.java                # 路径解析与越界防护
        └── resources/
            ├── application.properties             # 应用配置
            └── static/{index.html,app.js}         # 前端页面与脚本
```

默认共享根目录：`storage.root=${user.dir}/share-root`（应用启动时自动创建）。

## 快速开始
- 环境依赖：`JDK 8+`、`Maven 3.6+`
- 启动应用：
  - 开发模式：`mvn -DskipTests spring-boot:run`
  - 打包运行：`mvn package && java -jar target/share-file-unsafe-0.0.1-SNAPSHOT.jar`
- 访问地址：`http://localhost:8080/`

可在 `src/main/resources/application.properties` 调整配置：
- `server.port=8080` 服务端口
- `storage.root=${user.dir}/share-root` 共享根目录
- `spring.servlet.multipart.max-file-size=-1` 上传大小（-1 表示不限制）
- `spring.servlet.multipart.max-request-size=-1` 单次请求大小（-1 表示不限制）

## API 说明
- `GET /api/files?path=/foo` 列出目录内容
- `GET /api/files/download?path=/foo/bar.txt` 下载文件
- `POST /api/files/upload` 上传文件（`multipart/form-data`，字段：`path`,`file`）
- `POST /api/folders/create` 新建文件夹（表单：`path`,`name`）
- `POST /api/files/rename` 重命名（表单：`path`,`newName`）
- `POST /api/files/move` 移动（表单：`sourcePath`,`targetDir`）
- `DELETE /api/files?path=/foo/bar.txt` 删除文件或目录（目录递归删除）
- `POST /api/files/batch-delete` 批量删除（多值表单：`paths=...`）

路径参数规则：所有 `path`/`sourcePath`/`targetDir` 视作位于共享根目录下的相对路径（以 `/` 开头）。服务端通过 `PathUtils.resolveUnderRoot` 规范化并阻止越界访问（`..`、反斜杠、路径跳转等）。

## 前端交互
- 浏览与导航：点击目录进入；“上一级”返回父目录；“刷新”重新加载
- 上传：
  - 点击“上传文件”选择多个文件
  - 支持“粘贴”上传（剪贴板含文件）
  - 支持“拖拽”上传（将文件拖到页面）
  - 逐个上传，显示每个文件进度条
- 管理操作：重命名、移动到目标目录、删除（目录递归）
- 批量删除：勾选多项后点击“批量删除”

## 设计与实现要点
- 路径安全：后端所有操作先通过 `resolveUnderRoot(root, inputPath)` 规范化，校验目标始终位于根目录之内
- 下载响应：`Content-Disposition: attachment; filename*="UTF-8''..."` 保证中文文件名兼容主流浏览器
- 排序规则：列表按“目录优先，其次名称”排序
- 进度展示：上传采用 `XMLHttpRequest` + `upload.onprogress`

## 已知缺陷与风险（unsafe）
- 无认证与授权：任何能访问服务的用户都可读写、删除文件；不适用于不可信环境
- 无 CSRF 防护：存在跨站请求伪造风险（同源场景下尤需注意）
- 上传无限制：`-1` 表示不限制，可能导致磁盘/内存资源耗尽
- 破坏性操作：
  - 允许递归删除目录；如误传 `path=/` 将删除整个共享根目录
  - 重命名/移动采用 `REPLACE_EXISTING`，可能覆盖同名文件
- 符号链接信息泄露：如共享根目录下存在指向外部的符号链接，`列表`可能展示其目标目录内容（虽后续读写会被越界校验阻止）
- 目标目录/文件名未做严格白名单校验：虽有根目录越界校验，但仍可能创建嵌套结构或非常规名称

## 适用场景
- 可信内网中的临时文件分发、共享与归档
- 小团队内部快速传输与整理，不追求安全合规

> 提醒：本项目不包含安全防护，请谨慎在公网或不可信环境使用。