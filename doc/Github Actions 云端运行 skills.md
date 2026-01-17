- # 作业
    - {{[[table]]}}
        - # **作业**
            - # 学习奖励
                - **作业：这次作业我们分两个：**
                    - ①第一个是普通的作业，你可以去复刻黄叔的这节课的内容，但建议你把自己的一个 skills 部署到 GitHub action 里面去运行
                        - ②第二个，对这节课，其实他会自动的去。运行 workflow，然后持续不断的产出一个网页，能不能把这些网页做一个集合？这样子你上来你就能看到过去所有它跑的结果的一个聚合。
                            - **全新"双提交模式"：****群内分享**：请将部署解析后的网页链接，发布在社团群中，让群友流口水！！！**提交到作业链接：****https://forchangesz.feishu.cn/share/base/form/shrcnM3Jn0dT85LVzprSrHSQRTc**
                                - （同学们写完的作业也可以提交在上面的问卷里哦~方便统计发奖励呀~）
                                    - **🚩奖励机制：**为了鼓励同学们笔耕不辍，持续学习，AI编程社团特推出《月度学习打卡》小奖励
                                        - 每月作业完成100%，奖励200次对话工具权益
                                        - 每月的**直播课**都能参加，额外再送100次对话工具
                                        - 荣获某些**AI编程创作挑战赛奖励or商单or其他相关荣誉**等，积极跟【小哲助教】报备，可能将会额外获得小小鼓励奖&风变平台的曝光哦！
                - 
                - 
                - 
                - 
                - 
                - 
    - 大家可以看我的实际的网页：https://backtthefuture.github.io/weibotoidea/
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=YjQwMTM5MmU0YjBhYmJhMDE1ZjA0NWE2ODdlNTYwMzJfSGVCWkl4Y25zVlh0elp6RG5OTFNBSXhhRUkycDJCazNfVG9rZW46SWhLQ2J5OUJob3lWT0V4Y3RWZGN1SXVPbmZiXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - （太长了，我们就不全部截取，大家自己点击链接进去查看）
    - 这个是我们在11月底的一节课，之前需要在你的电脑上面打开 Claude Code 手动去运行，但现在我们把它放在了云端，它全自动化，定时的运行完之后自己部署在云端，然后这个网页也是别人可以直接访问的，也就是说只要你去访问这个网页，它每天会定时的去更新它
- # 宏观逻辑
    - 这个逻辑是我们基于之前的微博热搜 skills [1128 使用Claude Skills，全自动完成从微博热搜提取产品创意](https://superhuang.feishu.cn/wiki/TyNOwfZahiMQpGk44accpTWanDg)的课程对应的 微博skills---》改造成部署在 GitHub Actions 云端自动定时运行的运行的流程。
    - 暂时无法在飞书文档外展示此内容
    - 暂时无法在飞书文档外展示此内容
- ## Github Actions：
    - 定位：外层调度器 + 执行环境
    - 定时触发、环境准备、流程编排、部署发布（推送到GitHub Pages）
    - 类比：GitHub Actions 就像一个项目经理，负责：
        - 安排什么时候开工
        - 准备工作环境
        - 按顺序分配任务
        - 检查完成情况
- ## Claude Agent SDK：
    - 定位：AI 任务执行器（只在 run_weibo_agent.py 中使用）
    - 自主任务执行、工具调用、多轮对话
    - 类比：Claude Agent SDK 就像一个智能员工，你只需告诉他目标，他会：自己规划怎么做自己使用各种工具遇到问题自己解决完成后给你结果
        - 使用 Agent SDK：写一个脚本，Agent 自主完成所有步骤
        - 不用 Agent SDK：写多个脚本，手动编排步骤
- # GitHub Actions的限制
    - Github也是一家商业公司，不可能无限制的给我们白嫖，所以它是有一些限制的，我们需要提前了解一下：
- ### GitHub Actions 核心限制（按用户类型划分）
    - 首先要明确，GitHub 的账户类型主要分为 **免费用户（Free）**、**团队用户（Team）** 和 **企业用户（Enterprise）**，其中免费用户的限制最为严格。以下是针对免费用户的核心限制，同时会对比说明付费用户的差异以便你理解：
- ### 1. 计算时长（CI/CD 分钟数）限制
    - 这是最核心的限制，直接决定了你能运行多少自动化任务。
        - **免费用户（****[GitHub.com](https://GitHub.com)****）**：
            - 每月仅提供 **2000 分钟** 的计算时长（针对公共仓库）；（像咱们微博热搜 skills，每一次运行大约消耗8分钟，大家可以做个参考，相当于每个月我可以运行微博热搜 skills 250次。如果我一天运行3次的话，其实我一个月只会消耗90乘以8=720分钟）
            - 私有仓库每月仅 **500 分钟**；
            - 注意：不同操作系统的分钟数会有 “倍率换算”，比如 macOS 运行时长会按 **10 倍** 计算（1 分钟 macOS 运行时间消耗 10 分钟配额），Windows 按 **2 倍** 计算，Linux 按 1 倍计算。
        - **付费用户**：Team/Enterprise 用户可购买额外分钟数（$0.008/分钟 Linux、$0.016 / 分钟 Windows、$0.08 / 分钟 macOS）。
- ### 2. 并行作业数量限制
    - 并行作业数决定了你能同时运行多少个 workflow：
        - **免费用户**：
            - 公共仓库：最多 **20 个** 并行作业；
            - 私有仓库：最多 **4 个** 并行作业。
        - **付费用户**：Team/Enterprise 用户私有仓库可提升至 30 个并行作业（可额外购买）。
- ### 3. 工作流执行时长限制
    - 单个 workflow 任务的运行时间有上限，超时会被强制终止：
        - **所有用户统一限制**：单个 job 最长运行 **6 小时（360 分钟）**；【这个可以认为是Workflow里的一个任务】
        - 补充：如果是自托管运行器（Self-hosted runners），则无此时间限制（但仍受账户总分钟数配额影响）。
- ### 4. 存储与 artifact 限制
    - **Artifact / 日志存储**：
        - 免费用户：构建产物（artifact）和日志的保留时间最长 **90 天**（可手动调整缩短）；
        - 单个 artifact 大小上限 **100GB**（但实际传输中建议单个文件不超过 2GB，否则易失败）。
    - **缓存存储**：
        - 免费用户：每月缓存存储上限 **10GB**，超过部分按 $0.05/GB/ 月收费；
        - 缓存保留时间：默认 7 天，最长可设置 400 天（但会被自动清理未使用的缓存）。
- ### 5. 其他关键限制
    - **API 调用频率**：GitHub Actions 调用 GitHub API 的频率限制与普通用户一致（每小时 5000 次），超出会被限流；
    - **工作流触发频率**：短时间内频繁触发 workflow（比如 1 分钟内多次 push），可能会被 GitHub 限流；
    - **自托管运行器限制**：免费用户可使用自托管运行器，但仍受账户的总分钟数配额（私有仓库）限制（公共仓库无此限制）；
    - **敏感操作限制**：比如部署到生产环境的 workflow，免费用户无额外限制，但需自行保障安全性。
- ### 免费用户避坑建议
    1. **优化分钟数消耗**：
        1. 优先使用 Linux 运行器（无倍率换算），避免频繁使用 macOS/Windows；
        2. 缩短 workflow 运行时间，比如提前缓存依赖、减少不必要的步骤；
        3. 对私有仓库的 workflow 设置触发条件（比如仅手动触发、仅特定分支触发），避免无意义的运行。
    2. **监控配额使用**：
        1. 在 GitHub 账户的「Settings → Billing → GitHub Actions」中查看剩余分钟数，避免超额；
    3. **处理超时问题**：
        1. 如果单个 job 超过 6 小时，可拆分为多个 job 串行执行，或使用自托管运行器。
- ### 总结
    1. 免费用户最核心的限制是 **每月计算分钟数（私有仓库 500 分钟、公共仓库 2000 分钟）**，且不同系统有倍率换算；
    2. 次要限制包括 **并行作业数（私有仓库 4 个）** 和 **单个 job 最长 6 小时运行时间**；
    3. 免费用户可通过优先使用 Linux 运行器、优化 workflow 步骤、监控配额来最大化利用资源。
- # 实操步骤
- ## 01 本地Skills改造为适合云端运行的版本
    - 好了，咱们知道了整体的逻辑之后，剩下的就是把咱们在本地运行的Skills，迁移到云端。
    - 首先第一步是基于你已经开发完的一个 skills 的文件夹，打开它，这里我们使用[1128 使用Claude Skills，全自动完成从微博热搜提取产品创意](https://superhuang.feishu.cn/wiki/TyNOwfZahiMQpGk44accpTWanDg)来作为案例，其实你使用其他类似的案例是差不多的。
    - 我们在打开文件夹后，CC里第一个命令是：
    - ```plain text
      帮我调研目前项目里的Skills：/weibo_hotspot_analyzer，  我想将它迁移到 GitHub Actions 实现云端定时执行。 请帮我分析技术可行性，以及改造方案，注意，GitHub Actions是支持Claude Agent SDK的，请优先按调用SDK的方案执行，然后仔细阅读整个Skill里调用的API信息，需要列出哪些信息我需要在GitHub Secrets里配置的！以及在改造方案执行完成后，告诉我如何一步步完成推送到配置的流程
      ```
    - 背景知识补充：
    - 请优先按调用SDK的方案执行：是因为 Claude Agent SDK 是去年比较新的一个技术，在模型的知识里面是没有的，所以它默认不会去优先推荐。那这样就会带来一个问题，**如果没有 SDK，它会写很多的脚本**，这样子实现起来其实就很复杂了，也就没有我们想要达到的一目。Claude Agent SDK 在前面我们写过，它等同于一个 Agent，有了它模型就知道怎么干活了，已经能够更聪明的干活。
    - 标黄的部分就是你具体技能的名称，如果你不清楚，可以直接问AI：
    - ```plain text
      这个文件夹里的skills叫什么？
      ```
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=MmY3NTkzOGE0MGE1ZDgyYWU0ZDIyNmEyZTZkM2I3MzZfcGx2ZHJaVUxKMVRmeXdMaGJLS2phSHlsbnlBMko0MkdfVG9rZW46Tm1GbGJuNHJDb29pNVd4ejJwQmNTTURCbk9oXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 接着 AI 会给出分析的方案，这里要选择带有 Claude Agent SDK 的方案：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=NmVkMTE5ZDdjMzQ0Yzk3NmJlOTZhOTk4YzczYzFmOTZfTEUwVWd6T09XTWZlSktCNjBjeUdjTG9VeWk5dXJ1UGRfVG9rZW46SGpEZmJ1Nkxpb200TWN4cFZlZWNWZjEyblRnXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 比如我这里就输入:
    - ```plain text
      使用方案B：使用 Claude Agent SDK（你提到的方案），请你列出详细的执行方案
      ```
    - 标黄色的部分，它的输出不一定是我这样的，你只要把它输出带有SDK方案的文字复制过来就行。
    - 稍等一会，他就完成了整个项目的改造，会把需要你做的动作告诉你，比如我这个它提供了完整部署指南：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=NTJlY2JmMjg5YzU5ZTZmNjc2YzlkYmVmMzU1Y2ViZjBfdWZyQktMcnZEcjRPNEM1ZGl5elJkSGU2WUFFNjk1Z0JfVG9rZW46RXBuVWJSOEI4b0x3cjJ4ckdrZWNRemM1bmhoXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 可以打开部署指南后看到如下详细信息：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=NTg5MDFlODI1ZWZjOWE3NThkYzQ0ODBjNTkyMjFmNzFfUnJ6Wnl6RFFqY3J5ekRWSlcwSlFxUUVIRU5WZ3VkUHZfVG9rZW46SmdDd2JCVmZab0JaWGl4Y05URmM0bllpbktjXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 这里比较关键的一点，AI默认使用官方的 API，但是其实我们是用第三方，所以我们需要把对应的一些信息给到他，让他去调整。把 CC switch 里面配置的大模型三个信息给到他：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=NzZmNTI1YmMwNDMwMGJjZjI1MjRkMTc4NDM3ZTk0OTBfQ1VzT3VtYVFvSmJVRjc3aG85Rlh4TnBIZFFaVm9NZEZfVG9rZW46VWxvN2J6WUtob2VhTDB4ZGhUR2NTOVBsbnlmXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
        1. API请求地址
        2. 模型id
        3. API Key
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=NWJiYWQxZmQwMTlhMjU0YmQwNjc0ZTFlNjE2ODUzMmRfb3BhREJlRTJSMjFEREZSOE5ZaXBMajlGYWg2VFlmUVFfVG9rZW46TjUyUWJnRVhSb3hqaUR4ZXdqUmNjbnFpbjdqXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 上面的三个信息都可以在你的 cc switch 里面对应位置拿到。
    - 这些信息给到 AI 之后它会进行进一步的优化：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=YzQ2ZWViNDk4ZTUwNjc4OTgzNGZjODUzNTY3MTViNDVfRlFPQVNxckxYYUw1bDlGenM5VDZTVEpVYWthbUVpMU9fVG9rZW46TEtFNmJ5cENYbzdJaEt4SzMwbGNNelZMbmtmXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 接着我们可以根据他的指示步骤，一步一步的去完成：
- ## 02 Github仓库建立
    - 第一步就是我们要去建立一个 GitHub 仓库，[教学文档---0711 五件套入门+上线第一个网站 ](https://forchangesz.feishu.cn/wiki/FoUYwTrRjiP1oSkxrMAcCBSGnBd)
    - 大家如果还没注册的话，可以去看上面的教程，注册一个 GitHub账号
    - 注册完成之后，你可以去新建一个仓库。
    - （GitHub 相当于是一个云盘，然后每个仓库相当于是一个文件夹）
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=OTM5NGE4ZWQ5ZmZlOWY5MzhiZWU0MTczNmY3MjBhOTNfa2wyeTRiMHIxUENYazJycW5vWXZ2OElmNHJaNzZWRVpfVG9rZW46THVNTGJTVHZBb3FieUh4OUZ1M2NjYkl1bldoXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 然后下面的123一步一步的填写就可以了。
    - 这个`Repository name`仓库名字你就填自己能够记得住的英文名或者拼音就行
    - `Description`描述是可选的。
    - 最后点击右下角的 `Create repository` 按钮创建：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=YWE3NmFiYTJhNWQwMzUyZjJjNjUyOTBmMzQwOTM5ZjRfc0oycWVhczJBUVk1V3dBNU9ON0VPSGI4b0NJQnRDeTRfVG9rZW46V3dvSWJ6SHpRb1p6Nmh4aW93RmNCb1lHbkZoXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 接着就完成了创建，你就能看到下面的界面：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=M2I5N2Q2OGY4ZWQ3ZTg0OGFiZjg3YTdhN2ZiNDBhOGRfV25hN2JaNVhVa1hLb0dGMVVTcDRsM3JMRkhmNzE2cjZfVG9rZW46TXhQOGJWdTVFb2pmc1V4NWtrTmNoaFhGbkZoXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 箭头所指的地方就是这个仓库的链接，然后我们点击一下复制。
- ## 03 把电脑上的代码传到 GitHub 仓库
    - 把刚才的链接，加上下面的文字，一起发给 AI：
    - ```plain text
      https://github.com/Backtthefuture/weibocheck.git 这是我新建的仓库，你上传到这里
      ```
    - 黄色字体部分替换为你自己的 GitHub 仓库地址
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=N2I1NzQ0NWU3MWM1ZDBhYmEwNzQ5OWFjNDAzYzdhMDlfVkNyUHlPbDFWSnhCNHBma3BkUTZVa2htMk94dm82cTFfVG9rZW46S3M5aWJCOWxUb2N3ZGF4N0JVN2N1YkJXbnpCXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 因为是新仓库，所以 AI 很快的就推送成功了。
    - 接下来我们来操作 GitHub Secrets，保存一些关键的密钥：
- ## 04 配置GitHub Secrets
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=MDNhMjNjMzA2MjllNTc4NTI1ZjllNjljYjI1OTBjOTJfRGNwWjNnZVZCZjU1REZWNXQ1MGtKYWxTR2c3NFp3ZGpfVG9rZW46QXlaSGJoaGNab3RSSHF4bHdNb2NKUkpibmhOXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 带你的仓库首页，然后依次点取：
    - 1 `Settings`
    - 2 `Secrets and variables`
    - 3 `Actions`
    - 4 `New repository secret`
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=Yzk0YzQ0M2UzODE4YjMwOTU0YjUxMzg2YzY3NTYzOTZfb1pMaFlPTVczSktlS3dTUkZzYmcyZnlKcUoydkR0OW9fVG9rZW46QlIzMGJNclUyb3JpejZ4c2ZOWmNlOHhQbjRnXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 在新建的界面里面依次填入：
    - 1 `Name`
    - 2 `Secret`
    - 这里需要填写的信息，你直接看 AI 给你的就行：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=ZjY3MWExZmUzNTlhNTBmNzBjMzBkZWNmOTBmZGI2ZTdfOU1raE9JaDh1SlBCUmpLQVFzSFo2N2tBUHNQTElqT1pfVG9rZW46TkZzTmIzdkYwb1UxNnZ4WjA1dWNmTzY1bnpjXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 3 点击`Add secret`
    - 逐个复制粘贴添加
    - 填写完毕之后，你可以自己看一下，检查一下：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=MmY4ZTE4NjdmZWIwMDAyNjhhZmUzN2I5YWQyYWY1ZDRfZFpmazgzR1VBSVZjQ3lFVzFZc2liZUViZ2V0VHF6WHRfVG9rZW46R3ZSZmJHeHdNb1ZYUXl4UzAwTmN6U0kwbmRkXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
- ## 05 配置Actions的权限
    - 我们首先要允许 Actions，它的 Workflow 跑完之后生成的网页能够存到我们的 GitHub 仓库里面：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=YTRiNzc2MWYyOGU2ZDIyNGNiMzJhNDQ3MTQ1NjIxZGZfV1QwUzBFZXRreG9qVUFtSDhxdkxhSFBVUUREeVpwNnBfVG9rZW46TVRXWGIzd1NBb2k4ZzZ4eW5VSWNFVEJqblRnXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 1 在你的仓库里点`Settings`
    - 2 点左侧列表的`Actions`
    - 3 点`General`
    - 往下滑，`Workflow permissions`这个部分默认是下面的状态的，这样子，等一下肯定会报错：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=NTJlY2JkZmQzMTQ3ZTFjYmNkMDcxNWQwNGRkODcyNTlfRUlRZXdUdWZQUXJjUjZFd2ZNZ3JPckFyTUNCUFFKUjVfVG9rZW46S3hJQWJ0UllIbzdsd0V4bWFEVmNaMzdkbjFnXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 我们需要改成下面这样：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=ZDYwMTcxZWJkNWMzODE1MmM0ZTY3MDFmMGVlYjZlYzRfam9kQXFiTmVYT0RUdGRWaGZya3hhRkQ1Smw5UVZ1S1JfVG9rZW46U1BWc2JucGtEbzlDQW94eUdTWmNVQWxSblBjXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 1 点选 `Read and write permissions`
    - 2 勾选上 `Allow Github Actions to create and approve pull requests`
    - 3 点击`Save`
- ## 05 检查是否正常运行
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=ZjU5MzAxYmJjYzk3MzJmNjRlZTAzMzgxNjE5Y2RiMjJfRjhnVlA4cTlkQUZ1eThJRzBxakdHRWdNRTd6OEZnUWRfVG9rZW46UGZpTmJKcDZWb0dNY1Z4RkFYdmNJRzlkbmxjXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 在你这个 GitHub 仓库里面点击：
    - 1 `Actions `
    - 2你具体的 workflow 的名称
    - 3 点击 `Run workflow`
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=ZDM3NDY4N2I1NGEyMjk5MTVlYjVlYTJmZjVmNDU1ZDdfeE9aYkdIY1M5OEpWbzUxU2M2UURBSUdMMGY3cVlEdENfVG9rZW46THlRY2IzOGFxb1hVUUZ4SjNwc2N5VGVCbnNoXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 点击 `Run Workflow`之后，会弹出浮层，我们再点击一下绿色的按钮`Run Workflow`：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=OTY0ZjI3ZDFjMzc5YmExOWI1MzJjNmU3YjhjMmZjZWJfUHJuZ1Vqc2hWV0JiODZMVzA1c0pxMktEbHhwOEFFTWpfVG9rZW46SUtWNGJLMnBFb1VWdFN4am5ONmNiTUZwbmljXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 然后他就会开始运行了：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=Yjk1NGZlYmI3ZmEzZGJkYTFiN2RmNzRiNjM5Y2MzMjFfUlNkOXhGZFkxajBPVEJXZ3F5MkVGUzNyblBvemZiQVFfVG9rZW46SGRyVmJ5ME1Vb01GbHp4Q090N2NvQ3JQbnBkXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 稍等片刻或者刷新一下页面，它的状态就会变成下图：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=MmEyNDI5MTFjMGQyYTc0ZTE0NTZkMTBhMGVlNzdhZTBfR1pMaWJkNzZTOGlDV1l4b1JDUnBHTkJBVUJsZ2pOZFBfVG9rZW46U2FZVWJVRG1Ybzlkb2h4aUUxdGNqNGdYbkNmXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 其中上图数字所对应的地方
    - 2 显示的是何时运行的Workflow
    - 3 显示这个Workflow的运行状态，In progress意思是正在运行
    - 我们可以点击1，进入到具体Workflow的详情页：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=NjFmY2Y0ZDdkZTVjMDk2NTY1NzE2ZWI4YmY0NjI3YjdfVEJaUzNYZUpyUTk5NXhuYno3Q285ZDNGNFM3aVdHcVNfVG9rZW46VE9ad2JSbGlob3pLU3l4cDhWeGNRb3lDblpnXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 这里也是可以看到它有两个小方框，
    - 第一个是`analyze-weibo-hotspots`，它在跑最重要的流程，
    - 然后第二个`deploy-to-pages`，相当于他前面跑出来的页面，它会部署到GitHub Pages（相当于网页部署在云端）。
    - 我们也可以点击1，进入到它具体的执行流程里面。
    - 我这个流程第一次跑的时候，过了5分钟，提示报错，我点击进去查看：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=NDFkOWM5YmU2Y2JhNzU1NjAzYTc0ZTA4YmU3NzA3YjNfSW41VUxYMDhpYlFCOUIwclJYTmNmd0hCdmlBWmFPRnZfVG9rZW46RUN2OGJGbTlwbzVnTUt4VERoS2NmNW90bjBkXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 然后把这个截图发给 AI，让他去修复。
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=OTE0ZmFhNjFlYzAzMjhjZmMyMWY3MTg1M2Q3NTkxYjBfdnh2bjdtWjRBendrUTFaZ21jRjZOVDliVmlHM0VCRnlfVG9rZW46U2xVR2JCRFlEbzF0R3h4NWRySGNNem1IblRmXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 过了一会他自己修复完毕，并且也已经推送到了 GitHub 仓库，让我们重新去运行一下 Actions：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=M2Y1MWViZjdkNTFjNWMzYTBiYmZkN2JhNWE5ODM5NTVfSmM1RE5LbFVuQVozbGYxUndmY21yME53T1ExZk5SeTJfVG9rZW46Wnc0YWIwNVg2b1k0SGl4eDVLTmNUTFlIbmhnXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 那我们重新尝试一遍，还是123这样重新点击一次：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=MDU5ZDk4ODQwMDdkMzRmM2YyM2I4OGU3OTI3MzNlNzlfYW1rUmxKa3JxcTFTWHEwQ2hNWWxPbnc3b0M2cGQ1T3BfVG9rZW46QUU0cmJTM3JGb0xjaDd4TFV0RmNZWENVbkhlXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 然后在deploy-to-pages这一步又报错了：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=NDY0NmUzYzkzNzlhZGNjOWRhOTMxZDZhNmZmMjMwYTJfWjAxN1RYR2pMR25aSDRYc0FpUk1hYlhOQ3dEV2xXczJfVG9rZW46UDhhZWJxNmJKbzFlcDJ4cUhLeWNOcVZYbm5mXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 没事，我们的核心就是报错之后我就截图给到 AI，让他来帮我修复。这个古往今来都是这样的！
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=YmY2ZTc2ZWY4Y2RjYzE1ZjdmYzdkZjYyZjdmZjFlOThfOGhPT1YxbWxRb2FRb1JocVk1VXlZbGNLUmRvMDd3VkdfVG9rZW46QUJKZWJQc0Ezb0llN0l4TmZ4dmNvdnlObkljXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 然后继续回到Actions，再来一遍测试，相信下一次就能跑通了！
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=ZTQ1MmY5YWEyMDAyZDUzMmJjOTgzYzVlNzY1MWI2MjlfeDlFMExCWUtlUmRGYmRHbklZVjRCRDAxRTc5M3k4U1FfVG9rZW46WkdIdGJiVERrb0g3RUZ4VTgzR2NlaEtibnFnXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 部署成功后，可以到Settings-Pages里找到对应的页面链接：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=YzkzMWM1YjFjZWQ0M2YyNzU1NzYzNjJiZDE1ZDljOGFfZEpCS2JOSFczamtaOGl3SkFJV29udUx2QmV0OWl0cE1fVG9rZW46SGJjVWJSQ21jbzBucVh4aE1MRGNNdVZSbmZmXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 但是发现还是有错误，打开的页面并不是应该的界面：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=YjIwZjU4YTdlMThkZWQ4MzIyMzdiNGI3ZmJhZGRhMDZfNjl5UGF3YXk2OWNsVVB4QWI0bHFvUWJsRWtvUkduajZfVG9rZW46SkU4VGJsNkVCb3VDS3p4SnBBNmNVbzUybk5iXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 这个是readme页面，没事，继续截图让AI修复：
    - ![](https://forchangesz.feishu.cn/space/api/box/stream/download/asynccode/?code=YzVkNTc4NmJhNzM3YmJkN2ZiMGQ4ZmZlMzYzZDg4ZDBfak9XUVdkMTFEbDNWYTVoYWV0TEtTbFh5ejllSEo2czdfVG9rZW46QXZrNmJPbG5BbzRLYlh4bjlUNWNTWHdFbjhjXzE3Njg2Mzg2NzA6MTc2ODY0MjI3MF9WNA)
    - 很快，又说修好了
