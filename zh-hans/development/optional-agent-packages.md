# 可选智能体包与能力包

状态：已在 v2.3.0 开发周期内实现，对应 issue #3612。

## 目标

Marinara Engine 的基础发行版不编译、也不附带任何可选的智能体实现和能力实现。全新安装的应用里没有任何可选包。从旧版本升级时，这套包机制引入之前就已具备的能力会全部保留。

官方目录、包源码、可复现的产物、校验脚本和贡献流程都放在 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)。安装后的产物存放在配置好的 Marinara 数据目录下面，这样应用更新就不会覆盖它们。

## 包模型

一个智能体包可以提供一个或多个声明式智能体，以及可选的受信任可执行能力：

- 服务器端入口点：路由、生命周期钩子、提示词提供方、结果处理器、存储迁移；
- 客户端入口点：面板、聊天界面、设置区块、设置向导中的选项、运行时显示内容；
- 共享的 JSON 结构定义和稳定的通信契约；
- 包自带的资源文件、文档和 Professor Mari 知识片段。

包面向的是带版本号的 Marinara 能力 API，不允许从引擎导入私有源码路径。

客户端的能力组件通过自身的 `lang`、`dir` 属性和 `capabilityProps.localization` 对象拿到 Engine 当前选中的界面语言。包自带的界面维护自己的语言文件，缺失时回退到包内的英文；Engine 不翻译包的提示词，也不翻译包自己写死的机器可读值。切换语言时复用现有的 `marinara-capability-props` 事件，已安装的界面无需重启 Engine 就能重新渲染。

### 交付和缓存

已安装的包文件会带上强验证器，它们来自清单中每个文件的 SHA-256 哈希；Engine 每次读取时也会用这些值重新验证字节。客户端包(`/api/capability-packages/<id>/client`)和每个包资源都会始终重新验证(`no-cache` 加 `ETag`)。未变化的文件会返回 `304 Not Modified`，不会重新下载；重新发布的文件则会立即被取用。任何内容都不会以 `immutable` 方式提供：安装政策允许使用不同字节重新发布同一版本，因此包 URL 并不是内容寻址 URL。

Capability API 1.1 在服务器端的激活上下文里加了一层通用的运行时门面。包可以读取当前生效的智能体调试状态，也可以通过 Engine 的 Pino 日志器写日志，包括显式覆盖调试模式，全程不需要导入私有的日志模块或运行时配置模块。这层门面只暴露操作，不暴露 Engine 内部对象。

Capability API 1.2 加入了事务范围内的聊天/消息操作、范围收窄的聊天元数据写入和世界书条目存在性读取，以及空间快照兼容存储。包可以在一个 Engine 事务内校验领域数据的变更，并把元数据与所属消息、备选回复或空间快照一起原子提交，全程拿不到数据库句柄或数据表对象。回滚和历史存储兼容由 Engine 负责，校验和领域规则由包负责。同一套 API 还提供归一化后的聊天记录和角色记录、可用世界书条目的筛选、类 JSON 响应的解析，以及解析完成的语言模型调用。连接凭据、服务商实现、数据库句柄和存储对象始终只属于 Engine 内部。

### Capability API 1.7 的聊天分支

Capability API 1.7 给 `CapabilityChatRecord` 增加了归一化的分支元数据：

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title` 是持久化保存、去掉首尾空白后的分支名。根聊天返回 `null`。由 Engine 创建且可识别的分支会给出直接父聊天、分支来源的那条消息，以及复制出来的子消息。空分支的消息锚点为 null。旧版分支、元数据损坏的分支，以及导入进来、关系无从判断的群聊同级分支，血缘字段一律返回 null，Engine 不去推断历史关系。通用的导出/导入会省略父级 ID 和消息 ID，因为这些 ID 在不同安装之间并不相同。删除父级不会影响子级的血缘信息。

### Capability API 1.8 的 Game Experience

Capability API 1.8 增加了包提供的 Game Experience、每个 Game 回合的提示词上下文和资源写入。

包可以提供完整的 Game Mode，而不仅是内置模式的附加功能。它声明 `game-surface` 槽位，并在创建游戏时从设置向导的 Experiences 区块中选择。选择会记录到游戏中，并在整个游戏生命周期内保持不变，因此不会在游戏进行途中切换 Experience。该界面会在共享旁白之上绘制自己的 HUD、菜单和战斗，并声明要替换哪些内置系统。没有声明的功能会保留内置实现，所以 Experience 只会退出自己确实实现的部分。可选的 `contributions.gameSurface.surfaceClass` 指定界面挂载期间由 Engine 应用到游戏区域的类名，让包的样式表能够调整在自身元素之外渲染的共享界面。

持有 `prompt-context` 权限的包可以向每个生成的 Game 回合的系统提示词贡献文本。拥有实时状态的包因此能让模型与玩家眼前的内容保持一致。贡献项还可以声明它替换了哪些内置游戏系统；Engine 随后会停止指示模型驱动这些系统。贡献项按回合收集，而且从不是必需项：没有返回内容的贡献项会被跳过；抛出错误或没有在截止时间内完成的贡献项会被记录并跳过，不会影响生成。

资源门面在读取之外还提供写入，所以包的设置流程可以查找或创建玩家的用户角色及其世界书。存储、验证和身份信息仍由 Engine 管理；领域内容仍由包管理。

### Capability API 1.10 的包资源

Capability API 1.10 增加了包自有静态资源的通用交付方式。清单可以声明 `contributions.assets.paths`，即包内最多 256 个图像(`png`/`webp`/`gif`/`jpg`/`jpeg`)和 JSON 文件的允许列表。Engine 通过 `/api/capability-packages/<id>/assets/<path>` 提供这些文件，并使用与浏览器标签图标完全相同的验证链：路径限制、`files[]` 中的哈希成员关系、被动内容类型允许列表，以及每次读取时重新验证完整性。架构会拒绝主动文档类型（SVG、HTML 和脚本）；每条声明路径都必须在 `files[]` 中固定哈希；包内的 `manifest.json` 即使声明了也绝不能提供。声明 `contributions.assets` 需要使用 `schemaVersion` 2 且 `capabilityApi` 不低于 1.10 的清单；v1 清单完全无法声明。资源始终会重新验证：与客户端包一样，它们带有基于清单哈希的强 `ETag`，未变化的重新验证会返回无响应体的 `304 Not Modified`。图块集只有在字节确实变化时才会重新下载。响应被有意设为永远不使用 `immutable`，因为安装政策允许使用不同字节重新发布同一版本，带版本的 URL 也不是内容寻址 URL。这样，`game-surface` Experience 就能随包提供真正的美术资源，而不必把它内联进客户端包。

违反规则的清单会在安装时被拒绝，并显示以下消息之一："A declared package asset must be listed in the package file manifest"、"contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer"、针对非图像/JSON 路径的架构扩展名错误，或者，对于文件名仅大小写不同、会在不区分大小写的文件系统上合并成同一文件的压缩包，显示 "Package contains duplicate file" / "Package manifest declares files that collide on case-insensitive filesystems"。

为此，每个功能元素都会收到自己的身份信息：`capabilityProps.packageId` 和 `capabilityProps.packageVersion` 会和 `localization` 一起传入。客户端包可以据此把资源 URL 构造成 `/api/capability-packages/<packageId>/assets/<path>`，并可选择添加 `?v=<packageVersion>`，让版本升级清除所有中间缓存，不必重新获取已安装列表，也不必解析自己的导入 URL。

### Capability API 1.11 的 Experience 战斗接口

Capability API 1.11 向 `game-surface` 功能属性添加了战斗接口。`combatActive` 会在内置战斗 UI 真正挂载的那一刻报告状态；而 GM 的叙事场景状态 `chatMeta.gameActiveState` 会落后于切换，甚至可能在没有任何遭遇时显示 "combat"。`combatStyle` 会传递有效样式(`classic` 或 `tactical`)。`requestCombat()` 要求 Engine 通过与手动 Start Combat 按钮完全相同的流程生成遭遇，只省略确认对话框，因为 Experience 自己的界面已经表达了意图。遭遇的内容仍由 Engine 的生成流程决定。包有意无法直接提供战斗人员或战斗状态，战斗仍归 Engine 管理。

`requestCombat()` 的身份稳定，在包路径上不会显示消息，并返回一个由 Experience 自行渲染反馈的代码：成功为 `"started"`；拒绝为 `"combat-active"`、`"pending"`（已有生成正在进行）、`"no-turn"`（GM 尚未写出回合）或 `"unavailable"`（已结束的会话或重放）。`combatPending` 和 `combatError` 会反映生成进度和失败，让包不会在生成失败后继续等待 `combatActive`。与 1.7/1.8 接口一样，但不同于受到严格门控的 1.10 `contributions.assets`，无论包声明的 `capabilityApi` 是什么，这些属性都会提供给所有 `game-surface` 包。1.11 标签表示它们何时出现；依赖这些属性的包声明 1.11，旧版 Engine 就能明确拒绝它。

### Capability API 1.12：面向所属 Experience 的空间事件

Capability API 1.12 还会把空间功能事件发送给拥有游戏的 Experience 包。以前在 `marinara-capability-server-event` 窗口事件中只发送给 `hierarchical-maps` 的 `spatial_transition_committed`、`spatial_transition_rejected` 和无类型 `spatial_context_refresh` 提醒，现在还会把 `packageId` 设为聊天的 `gameExperienceId` 后再次发送。不同事件的载荷不同：已提交事件包含 `{ chatId, commandId, currentLocationId, definitionRevision, travel? }`；已拒绝事件包含 `{ chatId, commandId, code?, message? }`，因为移动没有发生，所以没有位置字段；刷新提醒包含 `data: null`。通过 `sendMessage` 的 `pendingSpatialTransition` 参数发送旅行命令的 Experience，可以在主机知道结果时立即确认或清除行程，不必根据之后的状态读取来推断。1.12 还补上了一个会影响 World Maps 自身的缺口：通过两个静默 HTTP 路径之一被拒绝的转换，也就是生成中流式输出前的所有者回合提交，或独立 REST 提交，以前完全不会产生事件。现在两者都会合成 `spatial_transition_rejected`，但仅限存在确定证据时，也就是出现 `already_applied` 以外的 `spatial_*` 错误代码。无法确定的失败，例如可能丢失成功提交响应的网络错误，会改为发送无类型 `spatial_context_refresh` 提醒，让监听器与服务器状态重新同步，而不是接受虚构的结论。已提交事件中 `travel.mode` 为 `"step_by_step"` 且 `complete: false`，表示行程仍在继续；请把待处理状态保留到完成事件。这是与 1.11 一样的软接口：无论声明的 `capabilityApi` 是什么，事件都会传递。只有包依赖这些事件时才声明 1.12。

### Capability API 1.13：临时折叠旁白

Capability API 1.13 向 `game-surface` 包传给 `setExperienceChrome` 的 chrome 声明中添加了 `requestsCollapsedNarration`。标记为 true 时，Game Mode 的旁白框会折叠成细窄手柄，让 Experience 可以为过场动画或全屏演出腾出屏幕。

这是请求，不是偏好设置。玩家自己的折叠设置绝不会被写入，并且只有 Experience 是当前界面时才会接受该标记。移除标记或不再作为当前界面，旁白框就会回到玩家选择的状态。这就是“结束后总会重新打开”的保证；包有意无法永久保存折叠状态。

Engine 的安全规则优先于请求。只要屏幕上显示玩家文本输入框，旁白框就会强制展开，包括场景刚开始、尚无任何分段时；分段推进控件处于活动状态时也会强制展开，因为这些控件是结束回合的唯一方式，能隐藏它们的包可能会让玩家永远卡住。存在待处理的场景分析、生成或战斗生成重试时，手柄也会继续显示注意提示。玩家在请求期间手动展开旁白框后，它会保持打开，直到请求结束。与 1.11/1.12 一样，这是软接口：无论声明的 `capabilityApi` 是什么，该字段都会生效。1.13 标签表示它何时出现，因此依赖它的包声明 1.13。

### Capability API 1.17：在首个回合前准备 Experience

`game-surface` 包可以使用架构版本 2 和 Capability API 1.17 声明 `contributions.gameSurface.prepareBeforeStart: true`。当游戏处于就绪状态时，Engine 会先挂载该界面，再启用 **Start Game**(开始游戏)。经典游戏和未设置此标志的包保留原有启动流程。

选择启用此功能的主界面会收到两个额外属性：

- `startup: boolean` 会保持 true，直到玩家通过 **Continue**(继续) 完成 Engine 的开场介绍。在此期间暂停世界模拟和玩家操作。
- `setStartupReady(context: string | null): void` 用于报告准备状态。加载、保存或从故障中恢复时发送 `null`。只有实际世界已经持久保存并且可用时，才发送字符串；空字符串允许不带额外上下文直接启动。

在收到就绪字符串前，宿主会阻止 **Start Game**、小组件准备确认和首回合重试。在等待期间，包自己的加载界面以及错误和重试界面仍然可见。准备完成后，包会隐藏在 Engine 的正常开场介绍后面。**Continue** 会打开常规界面，此时可能重新挂载：请让世界准备保持幂等，恢复已保存的状态，而不是再次生成。返回已经完成开场介绍的游戏时，不会重复启动准备。

开场上下文上限为 **8,000 个字符**。无效或过长的上下文会继续阻止启动并显示错误；宿主不会截断世界事实。请简洁描述准备好的起始地点及其实际角色阵容。Engine 会以 `game_start` 为来源，将这段文本追加到现有首回合 `generationGuide`，让开场使用已经存在的世界。这不会为后续回合注册上下文；后续仍应使用包正常提供的提示词内容或回合生成上下文。

就绪回调属于当前挂载的聊天、游戏和包。来自其他作用域的迟到回调会被忽略。模块或运行时故障会阻止启动，不会把缺少世界上下文当成成功。重新加载后，包必须根据保存的世界报告就绪状态。服务器端提示词上下文提供者仍然是只读的，并受较短的时限约束；不要用它生成世界，也不要把它当作长期等待的启动关卡。

### Capability API 1.19：包提供的工具

Capability API 1.16 让包能够要求模型_说出_某些内容，再据此执行操作。这一版本让模型能够_调用_某项功能。拥有新 `tools` 权限的包可以在服务器入口中注册具名工具。Engine 在每个聊天的每一轮中，将它与内置工具一起提供给模型，按包的 JSON Schema 验证调用，再把参数交给包的处理函数。

```ts
export async function activate({ api }) {
  api.registerTool({
    name: "set_time",
    description: "Move the world clock forward or back.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["advance", "rewind"] },
        minutes: { type: "integer", minimum: 0 },
      },
      required: ["action", "minutes"],
      additionalProperties: false,
    },
    handler: async (args, { chatId }) => {
      const clock = await moveClock(chatId, args.action, args.minutes);
      return { time: clock.label };
    },
  });
}
```

这里有意使用工具调用，而不是响应格式。响应格式会占用整个回复：叙述必须放进 JSON 对象的字段，也无法流式输出。工具调用可以与正文同时到达，模型仍然照常写完这一轮。包接收的是已经受提供商约束的参数，无需从完成的叙述里重新解析。这就是架构约束与仅仅要求模型遵守约定的区别。

枚举值能体现这个差别。如果包知道世界中的十二个地点，就可以把这十二个名称写进架构。第十三个名称会在到达处理函数之前被拒绝。Engine 现有的工具参数验证器会指出可用值，让模型能够修正调用。处理函数的返回值会作为工具结果展示给模型。

编写工具前，请了解这些规则：

- 名称采用 `<packageId>_<name>`，其中 `-` 转为 `_`。因此 `world-clock` 的 `set_time` 会以 `world_clock_set_time` 提供给模型。其他包已占用的名称会被拒绝。内置工具和已启用的自定义工具保留冲突名称；包的定义会被省略。完整名称最多 **64 个字符**。定义和执行都遵循相同优先级：内置、自定义、包。
- 只要包处于激活状态，它的工具就会被附加。这里没有像内置工具那样的额外聊天开关：声明权限并注册工具就是启用决定。所选提供商必须支持原生工具调用。
- 参数架构会在注册时复制并编译。如果 Engine 无法编译，包会在激活时失败，让开发者及时看到问题，而不是到一轮对话中途才失败。
- 处理函数抛出异常时，模型会收到调用失败的结果，异常会写入日志，但异常消息不会转发给模型。如果 **10 秒**内尚未完成，这一轮也会停止等待。处理函数仍会继续运行，但不会一直阻塞当前轮次。
- 结果必须能序列化为最多 **64 KiB**。更大或无法序列化的结果会使调用失败，而不是挤占对话空间。描述和结果属于受信任的包内容。包作者在读取或修改某个聊天的数据前，必须检查 `chatId`。
- 每个定义都会在每轮提供商请求中序列化，并计入上下文适配。因此注册有上限：**每个包 16 个工具**、**所有包合计 64 个**、描述最多 **512 个字符**、参数架构最多 **8 KiB**。超出任何上限都会抛出错误，导致激活失败。重新注册包自己拥有的名称会替换该工具，不会额外占用名额。
- 激活结束后，其上下文不再可用。如果包保留 `api`，并在后续回调中调用 `registerTool`，调用会被拒绝。已结束的运行时不能注册工具，也不能替换重新激活后注册的工具。
- 停用、更新或删除包会释放其工具。模型不会收到已经没有包能响应的工具。工具会在等待清理前移除；每个清理回调有 8 秒的时限。

这些时限仅限制异步等待。软件包以受信任代码的形式在服务器进程中运行；计时器无法中断阻塞事件循环的同步任务。强制取消需要独立的工作线程或进程，而此 API 不提供这种隔离。

`api.registerTool` 仅在这一版本及更新的 Engine 中存在。依赖它的包必须声明 `capabilityApi` 1.19，且会拒绝安装到更旧的版本。

## 首批包

- 目前所有内置智能体；
- Roleplay 和 Game 用的分层空间地图；
- Conversation 的语音和视频通话；
- UNO；
- 国际象棋；
- 扑克；
- 八球台球；
- 井字棋；
- 石头剪刀布。

基础发行版保留包管理器、目录客户端、通用智能体流程契约、通用回合制游戏宿主契约，以及处于待命状态的宿主接口。具体实现都归包所有。

## 信任与安装

官方目录是一份带版本号、经过结构校验的 JSON 文档，通过 HTTPS 获取。每个发布条目都包含不可变的产物 URL、SHA-256 摘要、字节大小、引擎兼容性、权限，以及该包的运行时是否需要重启。

包声明的模型命令只会在包已声明 `chat-write`、完成安装且准备就绪时运行。该权限也控制通过包持久化 API 执行的写入，包括消息、聊天元数据、roleplay 事件和空间快照。`chat-read` 控制聊天、消息、游戏状态和空间快照的读取。持久化事务和聊天锁内部也会执行相同检查；写入权限不会隐式授予读取权限。引擎自身的持久化调用仍受信任。

安装后，**Download Agents**(下载智能体) 详情页会显示已安装版本声明的权限。如果目录中的版本请求了不同权限，页面会将它们分开显示。安装或更新代码仍需获得现有的批准，且批准与确切的版本和校验和绑定；模型命令不会在每个回合另行请求批准。

这些是 API 检查，并不是 JavaScript 沙箱。网络、存储和 UI 权限只是访问声明。包的浏览器端和服务器端代码仍是受信任代码，可以访问宿主环境；请只安装你信任的包。系统检查的是就绪状态，而不是能否提供文件，因此更新后若包处于 `restart-required` 状态，其命令会停止解析，直到引擎重启。

服务器启动时，只要装有至少一个官方包，宿主就会拉取一次目录，只挑出与当前 Engine 和能力 API 兼容的更新版本，走常规安装流程完成校验，并在各个包的运行时激活之前装好。失败按包隔离，互不影响。目录离线或校验失败时，已有的文件和注册表状态照常可用；服务器运行时就绪失败则走回退到上一版本的路径。

安装器必须做到：

1. 要求具备本地环回/管理员级别的特权访问；
2. 强制 HTTPS，并施加下载大小上限和超时；
3. 解压前先校验目录的可信性和产物的 SHA-256；
4. 拒绝绝对路径、路径穿越、链接、设备文件和未声明的文件；
5. 校验清单和引擎兼容性；
6. 解压到同级的临时文件夹；
7. 只有全部校验通过后才原子地激活；
8. 在新运行时成功启动之前保留旧版本；
9. 失败时回滚激活操作；
10. 绝不执行安装、更新或卸载脚本。

官方目录只启用第一方的受信任可执行包。将来若要支持第三方，需要单独设计一套明确的信任机制。

## 运行时与重启行为

服务器持有已安装包的注册表，并把已安装的能力暴露给客户端。声明式模块和可热重载的模块会立即激活。激活之后，界面会让目录、智能体、模式能力和当前聊天这几类查询失效并重新拉取。

只有当宿主无法安全地重载某个入口点时，清单里才可以声明 `restartRequired`。热激活成功时提示 `Agent installed. It is ready to use.`，需要重启时提示 `Agent installed. Restart Marinara Engine to finish setup.`。

回合制游戏包支持热重载：安装时会立刻注册它的服务器引擎和手动斜杠命令启动方式，卸载时无需重启 Engine 就能卸下运行时。每个聊天里的 Conversation Commands 设置只决定角色能不能发出该包的隐藏命令，不会限制你自己用斜杠命令启动。目前官方的回合制游戏清单出于保守考虑仍保留旧版的重启标记，以兼容 Engine 2.x；Engine 3.x 能识别 `turn-game` 这个类型，会执行安全的热激活，并把包直接标记为已激活、可使用。

## 兼容性迁移

升级后首次启动时：

- 自定义智能体不受任何影响；
- 该安装能看到的每一个旧版内置智能体都会被记录为已安装；
- 地图、Conversation 通话和 Conversation 小游戏保持原来的可用状态；
- 已有的单聊天配置、快照、游戏状态、通话记录和智能体记忆全部原样保留；
- 迁移是幂等的，只有在所有旧版可用性记录都落盘之后才会记为完成。

旧版包的产物仍然可以从官方目录获取，作为迁移来源。全新安装的应用不会展示或激活它们，除非自己动手安装。

## 卸载

卸载会把这个包从各个聊天的启用列表里移除，删掉它的智能体配置和下载来的可执行文件，必要时在重启时卸下它的运行时。历史聊天、消息、地图快照、通话摘要和已完成的对局记录依然可读，所以卸载一个包不会毁掉已有的成果。要彻底删除这些历史领域数据，得由自己另外明确地操作一次。

每次卸载都需要确认。受影响的聊天会退回到普通的基础界面，历史记录不会损坏。

## 目录界面

Agents(智能体) 面板里有一个 `Download Agents` 控件，与 Card Browser 里的 `Download Cards` 一一对应。点开是一个全屏的自适应库页面，提供搜索、包类型、兼容性信息、安装/更新状态、权限、占用空间、文档和卸载控件。

桌面端用一份浏览列表加旁边的详情区。移动端只用一栏，配明确的返回导航和适合触摸的按钮。空列表、离线、不兼容、下载损坏、安装中断、有更新、已回滚、需重启这些状态都是一等公民，各有对应界面。

## 抽离验收标准

只有同时满足以下几点，抽离才算完成：基础版的生产客户端和服务器打包产物里不再含有该包的实现；全新安装的应用不下载这个包就无法激活它；升级上来的安装仍然保留它；而且包的安装、更新、卸载在桌面端、移动端和 Termux 兼容的文件系统上都能跑通。

### Capability API 1.20：Game Mode 规则集

规则集提供经验证的数据：Engine 已支持的检定方式、由固定元素组成的角色表、休息和 GM 指引。保留资源 `ruleset.json` 与 `gm-verbs.json` 一样，通过 `contributions.assets.paths` 发现，并在 `files[]` 中记录哈希。

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 20 },
  "id": "ruleset-5e-2014",
  "kind": ["ruleset"],
  "permissions": [],
  "entrypoints": {},
  "contributions": { "assets": { "paths": ["ruleset.json"] } },
  "files": [{ "path": "ruleset.json", "sha256": "<sha256 of the file>", "bytes": 25767 }]
}
```

示例只列出规则集相关字段；`name`、`version`、`description`、`engine`、`builtAgainst` 仍为必填。不需要权限、智能体或客户端、服务器入口。`ruleset` 类型与 `ruleset.json` 必须同时存在。文件不执行代码或字符串表达式；新的检定机制需要修改 Engine。格式及 5e 示例见 [`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md)。

清单必须声明 API 1.20，旧 Engine 会拒绝安装。Engine 在读取前拒绝声明大小超过 256 KB 的文件，再检查安装哈希，并按严格模式 `packages/shared/src/schemas/ruleset.schema.ts` 验证。无效文件会跳过，并用一条日志指出包及最先出现的 `path: message` 错误。ID 重复时，按包 ID 顺序保留第一个包，跳过另一个并记录日志。`engine-legacy` 与 `traditional` 为保留 ID。

游戏在 `chat.metadata.gameRuleset` 中保存一次选择。没有绑定时继续使用旧规则。包缺失或定义版本过旧时，规则集不可用，不会换成其他规则。绑定同时检查规则集 ID 和提供包，防止另一个包用相同 ID 接管游戏。

### Capability API 1.21：规则集目录

目录为角色表编辑器提供现成法术、职业能力和装备。头信息位于 `ruleset.json` 的 `catalogs` 中；条目可内联，也可使用保留资源：

```json
{
  "capabilityApi": { "major": 1, "minor": 21 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } },
  "files": [
    { "path": "ruleset.json", "sha256": "<sha256>", "bytes": 25767 },
    { "path": "catalogs/spells.json", "sha256": "<sha256>", "bytes": 418204 }
  ]
}
```

`catalogs/<id>.json` 必须对应自己的目录 ID，不能指向其他目录。文件需要 `files[]` 中的哈希，以及声明它的 `ruleset.json`。声明大小超过 1 MB 会在读取前被拒绝。内联和外部条目使用相同角色表验证。每个规则集最多 12 个目录，每个目录最多 2000 条。

客户端在打开选择器时才通过 `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=` 加载内容。安装列表只包含条目数量。目录文本不会自动进入提示词；GM 只看到 `gm.sheetSummary` 选择的内容。目录资源及经哈希验证的 `ruleset.json` 内的 `catalogs` 均要求 API 1.21。旧的严格模式会拒绝整个文件。不需要权限。

### Capability API 1.22：battle 块

可选 `battle` 指定生命池、可选 MP 池、法术位池，以及哪些列表的目录行变成 `CombatSkill`。战后通过与玩家按钮相同的角色表操作写回数值。

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

这是角色表与 Engine 战斗的数据连接，不是完整桌面规则适配器。伤害仍由内置机制计算，不读取 `attackRoll`、`save`、`concentration` 或 `perCostStep`。精确的系统规则属于另一项适配器接入工作。`coverage.combat` 保持独立含义，此连接不读取它。安装时检查经验证的 `ruleset.json`；`battle` 要求 API 1.22，正如 `catalogs` 要求 1.21。不需要权限，不影响没有该块的规则集。

### Capability API 1.23：随角色变化的目录数值

目录行可用 `scaled` 指定最多四个由规则集维护的自有数字列。每列使用现有数值引用及可选阶梯表，例如按等级计算资源或按属性计算次数，不新增算术机制。

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

数值在编辑时计算，不在读取时计算。游戏状态、GM 提示词及战斗读取保存的数字。行可位于 `ruleset.json` 或 `catalogs/<id>.json`；安装器检查这些清单资源的已验证内容，`scaled` 要求 API 1.23。不增加权限，不影响未使用缩放的目录。

`[sheet: op="use" name="..."]` 支付条目的 `mechanics.cost`，并扣除该条目创建的每个行资源池的一次使用。它只读取已支持的目录，无需新的声明。

### Capability API 1.24：骰池

`resolution` 可用 `"kind": "dice-pool"` 代替 `"dice-sum"`。角色表数值决定骰子数，引擎统计达到阈值的结果。规则集可定义双倍成功、爆骰、成功抵消、大失败、卓越成功及 GM 情境修正的范围。

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

角色表不变：原本用于求和的修正值在此表示骰子数。不新增表元素、编辑器槽位或包代码。经验证的 `ruleset.json` 中，`dice-pool` 要求 API 1.24；仅支持 `dice-sum` 的旧 Engine 会拒绝整个文件。不需要权限，不影响求和规则集。

### Capability API 1.25：层与世界指引

可选 `layers` 是创建时选择并固定在游戏绑定中的具名变体。`gm.worldGuidance` 在创建世界时读取一次，使世界符合队伍规则。

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

允许的效果是封闭集合：在规则集指引后追加指引、删除枚举值、将难度表替换为相同检定类型的表，以及在选择器中隐藏目录条目。不能添加表元素，因此任何层组合下的角色表都仍可读取。没有包代码或额外模型调用。第三方层留待后续支持。安装器检查内容后，两个字段都要求 API 1.25。不需要权限，不影响未使用这些字段的规则集。

### Capability API 1.26–1.27：战斗格式与生物目录

API 1.26 添加可选 `combat`，定义掷骰、目标、行动预算、攻击与能力列表、状态、专注、零生命规则、伤害类型和敌人强度等级。目录 `mechanics` 可描述目标、必定命中、状态、临时点数、随角色表变化的数值及预算消耗。

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

API 1.27 允许 `"holds": "creatures"`。生物数据使用 `combat` 的数值：固定或战斗开始时掷出的生命、防御、先攻、按角色表 ID 指定的属性与豁免、抗性、弱点、免疫、威胁等级及供 GM 阅读的特性。动作可以造成命中、要求豁免、施加状态、限制次数、通过掷骰充能、用一个预算执行动作序列，或消耗生物自身的特殊点数。

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

生物目录不声明 `feeds`，也不出现在角色表选择器中。这些版本提供格式及共享结算机制。服务器已经能结算和保存规则集战斗，并在每个动作后更新角色表；相应战斗界面尚未推出，玩家仍使用现有战斗界面。安装器验证 `ruleset.json` 和声明的 `catalogs/<id>.json` 后，会在低于 1.26 时拒绝 `combat` 及新增 `mechanics` 键，在低于 1.27 时拒绝 `holds` 和 `creature`。旧的严格模式会拒绝文件。不新增权限，也不影响没有这些字段的规则集。

### Capability API 1.18：在 Game 向导中保留 Experience 设置

`game-surface` 包可以使用架构版本 2 和 Capability API 1.18 声明 `contributions.gameSurface.setup`。Engine 保留通常的七个设置步骤，包括 **Party**(队伍)、目标、模型和世界书。只有新游戏提供 Experiences；重新打开已有游戏的设置会保留其 Experience 和包配置。没有此声明的包继续使用原有设置对话框。

```json
{
  "setup": {
    "seed": { "key": "seed", "label": "World seed" },
    "config": { "generate": true, "packWanted": true },
    "requires": { "enableCustomWidgets": false }
  }
}
```

三个字段均为可选。声明的种子会显示在所选 Experience 下方，并带有 **Randomize**(随机生成) 按钮。空输入或不是有限数值的输入会阻止 **Start**(开始)。宿主将数值种子和声明的常量写入 `experienceConfig`；`config` 不能包含种子键。常量序列化后不得超过 8,000 个字符。种子标签是包作者提供的显示文本；省略它即可使用 Engine 的本地化标签。

声明的小组件要求只在玩家首次修改该控件前提供默认值。关闭 Experience 会恢复常规默认值，而玩家明确选择的值保持不变。控件会说明 Experience 的预期设置，并始终可以编辑。这些 Experiences 会隐藏空间地图设置控件，因此不会启动单独的地图草稿、模板或构建器。

**Lorebooks**(世界书) 步骤最多可选择 100 条已启用的独立条目，也可选择尚未附加的世界书中的条目。已禁用的世界书、条目和聊天排除设置都会得到遵守。这些 ID 通过 `GameSetupConfig.activeLorebookEntryIds` 传递。在 `/game/setup` 中，它们作为额外的强制条目加入：跳过概率判定，但仍受常规 Token 上限约束。全局、绑定角色和已附加的世界设定仍参与常规扫描。包也可以从设置配置中读取同一组已选 ID，用于自身的世界生成请求。

导入设置文件时，会恢复已安装且兼容的 Experience 及其有效数值种子，但会丢弃任意包配置。常量由当前清单重新提供。已有游戏会跳过 Experience 导入并说明原因。创建快照会保留 Experience 名称和种子，用于设置摘要。

如果世界必须在首个回合前准备完毕，请独立使用现有的启动就绪声明。将 API 1.18 声明为包的最低要求；旧宿主无法理解此设置声明。
