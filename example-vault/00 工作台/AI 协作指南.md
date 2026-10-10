---
cssclasses:
  - sc-dashboard
---

# 在笔记旁边，留一个 AI 座位

Claudian 把 Claude Code 等本地 Agent 接入 Obsidian。点击侧边栏 Claudian 图标，或在命令面板搜索 Claudian。

## 三个可以直接试的请求

> 用 @ 选择一篇学习笔记，指出解释中缺少的前提。只给建议，先不要修改文件。

> 阅读我指定的几篇笔记，给出 3 条有依据的关联建议，标明笔记路径。资料不足时说明不足。

> 根据选中的笔记生成 3 道回忆题，放在聊天中供我确认，暂不写入笔记。

## 第一次使用

1. 安装并登录 Claude Code，或配置 Claudian 支持的其他 Agent。
2. 重启 Obsidian；如找不到 CLI，在 Claudian 设置中填写 `which claude` 返回的路径。
3. 从一篇示例笔记开始，并核对实际使用的账号、模型和权限模式。

Claudian 仅支持桌面端；插件安装不附带 AI 账号或额度。发送时，问题、附件和工具读取到的内容会交给所配置的服务。默认保留工具权限确认。

这是社区插件整合，Claudian 由 Yishen Tu 开发；Study Club 提供主题、学习流程及工作区组织。
