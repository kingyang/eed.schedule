## 项目简介
@eed/schedule 外部服务仅依赖`redis`的超轻便高弹性资源定时调度系统, 支持集群化部署.

## 项目依赖
1. nodejs >= 8.0.0
2. crc-32
3. cron-parser
4. ioredis
5. dotenv
6. nitropack
7. node-schedule

## 使用场景

如 教育系统的班级 年级 学校 区域数据逐级响应统计,  可以逐级触发,延迟响应统计, 并可把部分业务安排在资源空闲时间段执行达到计算资源高效利用.

若是非常简单单系统业务,可考虑直接使用`node-schedule`实现.
## 部署流程

1. clone代码
2. pnpm i
3. pnpm build
4. 部署(如pm2 或 docker 或k8s)

## 使用流程
在自己的业务系统实现需要定时要处理的业务逻辑接口url, 且该接口能被调度系统访问
接口url

业务接口要求:
1. POST
2. 响应status 为200或204 则认为成功, 其它状态会一直重试
3. request body为TaskInfo.

长期调度可参照:demoHandler0
临时调度可参照:demoHandler1

配置流程:
1. 通过"项目编辑"接口 添加调度`项目`配置
   若是长期调度,则已经完成; 若是临时调度,则继续下列步骤
   如
```json
{
  "name": "demo",
  "cron": "0 0/1 * * * *",
  "concurrency": 1,
  "url": "http://localhost:3000/test/demoHandler1"
}
   ```
2. 通过"任务添加"接口 添加调度任务`任务`配置, 可以多次添加后调用 `状态查看`系系统状态.
```json
{
  "name": "demo",
  "keys": ["{% mock 'cname' %}"]
}
```
3. 查看调度系统(控制台或日志系统)日志及业务日志

## 配置说明
```shell
#密钥
SECRETS=!BCD9

# 调度配置

#存储前缀
SCHEDULE_PREFIX=eed:
#调度并发量
SCHEDULE_CONCURRENCY=10
# 延迟执行(秒数)
SCHEDULE_DELAY=30
# 最大延迟次数
SCHEDULE_DELAYMAX=30

# REDIS
SERVER_REDIS_ENABLED=true
SERVER_REDIS_HOST=
SERVER_REDIS_USERNAME=
SERVER_REDIS_PASSWORD=
SERVER_REDIS_PORT=6379
SERVER_REDIS_DB=20

# 日志

# 是否持久化
SERVER_LOG_ENABLE=false
# 控制台输出
SERVER_LOG_CONSOLE=true
# 日志前缀
SERVER_LOG_PREFIX=
# 日志db
SERVER_LOG_REDISDB=
# 持久化密钥
SERVER_LOG_SERVERKEY=
# 持久化地址
SERVER_LOG_SERVERURL=

```

##  常用接口

### GET 状态查看

GET /status

> 返回示例

> 200 Response

```json
{}
```

#### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|OK|none|Inline|

#### 返回数据结构

### POST 任务添加

POST /add

```typescript
{
  /**
   * 项目名称
   */
  name: string;
  /**
   *  键值源信息
   */
  keys?: string[];
  /**
   * 任务唯一键值
   */
  key?: string;

  /**
   * 队列中延迟次数
   */
  delayCount?: number;
  /**
   * 队列中初次加入时间
   */
  queueDate?: Date;
}
```

> Body 请求参数

```json
"{\r\n    \"name\": \"demo1\",\r\n    \"keys\": [ {% mock 'cname' %}]\r\n}"
```

#### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 否 |none|

> 返回示例

> 204 Response

#### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|No Content|none|Inline|

#### 返回数据结构

### POST 任务取消(完成)

POST /cancel

任务取消(完成)
```typescript
{
  /**
   * 项目名称
   */
  name: string;
  /**
   *  键值源信息
   */
  keys?: string[];
  /**
   * 任务唯一键值
   */
  key?: string;
}
```

> Body 请求参数

```json
{
  "key": "-1111142272",
  "keys": [
    "李静"
  ],
  "name": "demo"
}
```

#### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 否 |none|

> 返回示例

> 204 Response

#### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|No Content|none|Inline|

#### 返回数据结构

### POST 项目编辑

POST /project/edit

``` typescript
//Project
{
  /**
   * 任务并发量(默认1)
   */
  concurrency?: number
  /**
   * 调度配置
   * cron: '* * * * * *'
   * 见 https://www.npmjs.com/package/cron-parser
   */
  cron: string

  /**
   * 延迟时间
   */
  delay: number

  /**
   * 已延迟次数
   */
  delayCount?: number
  /**
   * 延迟次数
   */
  delayMax?: number
  /**
   * 0, 长期任务
   * 1, 短期任务
   * (默认值:1)
   */
  mode?: 0 | 1
  /**
   * 初次加入排队时间
   */
  queueDate?: Date
  /**
   * 任务状态
   * 0, 停止
   * 1, 运行
   * (默认值:1)
   */
  status?: number
  /**
   * 服务地址
   */
  url: string

}
```

> Body 请求参数

```json
{
  "name": "demo",
  "cron": "0 0/1 * * * *",
  "concurrency": 1,
  "url": "http://localhost:3000/test/demoHandler2"
}
```

#### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 否 |none|

> 返回示例

> 204 Response

#### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|No Content|none|Inline|

#### 返回数据结构

### POST 项目测试

POST /project/test

> Body 请求参数

```json
{
  "name": "demo",
  "cron": "0 0/2 * * *"
}
```

#### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

#### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|OK|none|Inline|

#### 返回数据结构

### GET 项目移除(清理任务,移除项目)

GET /project/remove

#### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|name|query|string| 是 |none|

> 返回示例

> 204 Response

#### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|No Content|none|Inline|

#### 返回数据结构

### GET 项目清理(清理任务)

GET /project/clear

#### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|name|query|string| 是 |none|

> 返回示例

> 204 Response

#### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|No Content|none|Inline|

#### 返回数据结构

### GET 项目暂停

GET /project/suspend

#### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|name|query|string| 是 |none|

> 返回示例

> 204 Response

#### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|No Content|none|Inline|

#### 返回数据结构

### GET 项目继续

GET /project/resume

#### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|name|query|string| 是 |none|

> 返回示例

> 204 Response

#### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|No Content|none|Inline|

#### 返回数据结构

### GET 项目重启

GET /project/restart

#### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|name|query|string| 是 |none|

> 返回示例

> 204 Response

#### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|No Content|none|Inline|

#### 返回数据结构

### POST 保存日志

POST /log/persistent

```typescript
{
  /**
   * 项目名称
   */
  name: string;
  /**
   *  键值源信息
   */
  keys?: string[];
  /**
   * 任务唯一键值
   */
  key?: string;

  /**
   * 队列中延迟次数
   */
  delayCount?: number;
  /**
   * 队列中初次加入时间
   */
  queueDate?: Date;
}
```

> Body 请求参数

```json
"{\r\n    \"name\": \"demo1\",\r\n    \"keys\": [ {% mock 'cname' %}]\r\n}"
```

#### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 否 |none|

> 返回示例

> 204 Response

#### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|No Content|none|Inline|

#### 返回数据结构

### POST 测试业务1

POST /test/demoHandler1

```typescript
{
  /**
   * 项目名称
   */
  name: string;
  /**
   *  键值源信息
   */
  keys?: string[];
  /**
   * 任务唯一键值
   */
  key?: string;

  /**
   * 队列中延迟次数
   */
  delayCount?: number;
  /**
   * 队列中初次加入时间
   */
  queueDate?: Date;
}
```

> Body 请求参数

```json
{
  "key": "-173455861",
  "keys": [
    "钱涛"
  ],
  "name": "demo",
  "cron": "0 0/1 * * * *",
  "url": "http://localhost:3000/test/demoHandler1",
  "workerId": "XEFt",
  "firstDate": "2025-01-02T03:39:39.317Z",
  "updateDate": "2025-01-02T03:49:41.231Z",
  "scheduleDate": "2025-01-02T03:54:00.013Z",
  "busy": 1,
  "round": 1,
  "handleDate": "2025-01-02T03:54:00.013Z",
  "handleStatus": 2,
  "errDate": "2025-01-02T03:53:20.032Z"
}
```

#### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 否 |none|

> 返回示例

> 204 Response

#### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|No Content|none|Inline|

#### 返回数据结构

### POST 测试业务2

POST /test/demoHandler2

```typescript
{
  /**
   * 项目名称
   */
  name: string;
  /**
   *  键值源信息
   */
  keys?: string[];
  /**
   * 任务唯一键值
   */
  key?: string;

  /**
   * 队列中延迟次数
   */
  delayCount?: number;
  /**
   * 队列中初次加入时间
   */
  queueDate?: Date;
}
```

> Body 请求参数

```json
{
  "key": "-173455861",
  "keys": [
    "钱涛"
  ],
  "name": "demo",
  "cron": "0 0/1 * * * *",
  "url": "http://localhost:3000/test/demoHandler1",
  "workerId": "XEFt",
  "firstDate": "2025-01-02T03:39:39.317Z",
  "updateDate": "2025-01-02T03:49:41.231Z",
  "scheduleDate": "2025-01-02T03:54:00.013Z",
  "busy": 1,
  "round": 1,
  "handleDate": "2025-01-02T03:54:00.013Z",
  "handleStatus": 2,
  "errDate": "2025-01-02T03:53:20.032Z"
}
```

#### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 否 |none|

> 返回示例

> 204 Response

#### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|No Content|none|Inline|
