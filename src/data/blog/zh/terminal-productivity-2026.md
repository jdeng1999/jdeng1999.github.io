---
title: "终端生产力：改变了我工作流的那些工具"
description: 一次现代命令行工具巡礼——它们取代了 Unix 经典工具，更快、更聪明，开发体验也更好。
pubDatetime: 2026-01-18T10:00:00Z
tags:
  - terminal
  - productivity
  - linux
  - cli
  - tools
draft: false
---

CLI 生态经历了一场静悄悄的革命。用 Rust 和 Go 写成的工具取代了几十年前的 Unix 二进制程序，带来了颜色、语法高亮、模糊搜索和 Git 感知能力，而速度几乎没有付出代价。下面这些是我每天都在用的。

## Shell：Zsh + Starship

[Starship](https://starship.rs) 毫无疑问是那种花最少力气、却最能让体验变好的提示符。它适配任何 shell，速度极快（用 Rust 写成），还会展示有用的上下文：Git 分支、Node/Python/Rust 版本、上一条命令的退出状态。

```toml file=~/.config/starship.toml
# Minimalist but informative style
format = """
$directory\
$git_branch\
$git_status\
$nodejs\
$rust\
$python\
$cmd_duration\
$line_break\
$character"""

[git_branch]
symbol = " "
style = "bold purple"

[git_status]
conflicted = "⚔️ "
ahead = "⇡${count}"
behind = "⇣${count}"
modified = "✎${count}"
untracked = "?${count}"

[cmd_duration]
min_time = 2_000
format = "took [$duration](bold yellow)"
```

## 经典工具的替代品

### `ls` → `eza`（原 `exa`）

```bash
eza --tree --level=2 --icons --git    # tree with icons and Git status
eza -la --sort=modified               # long list, sorted by date
```

### `find` → `fd`

```bash
# find: verbose and poor ergonomics
find . -name "*.ts" -not -path "*/node_modules/*"    # [!code --]

# fd: intuitive, respects .gitignore by default
fd -e ts                    # all .ts in the project          # [!code ++]
fd -e ts --exec bat {}      # open each result with bat       # [!code ++]
```

### `grep` → `ripgrep`（`rg`）

```bash
# classic grep
grep -r "useEffect" src/ --include="*.tsx"      # [!code --]

# rg: 5-10× faster, respects .gitignore
rg "useEffect" --type ts                         # [!code ++]
rg "TODO|FIXME|HACK" --type ts --stats           # [!code ++]
rg "deprecated" -l                               # filenames only # [!code ++]
```

### `cat` → `bat`

`bat` 就是带语法高亮、行号、分页和内置 Git diff 的 `cat`：

```bash
bat src/components/Header.astro     # with colors and lines
bat --diff file.ts                  # shows inline Git changes
```

### `cd` → `zoxide`

它会记住你常去的目录，让你敲几个字母就能跳过去：

```bash
z astro      # jumps to ~/projects/my-astro-blog if it's the most visited
z blog src   # multiple match
zi           # interactive mode with fzf
```

## 多路复用：配置了现代设置的 `tmux`

```bash file=~/.tmux.conf
# More comfortable prefix
set -g prefix C-a
unbind C-b

# Split panes with intuitive keys
bind | split-window -h -c "#{pane_current_path}"  # [!code highlight]
bind - split-window -v -c "#{pane_current_path}"  # [!code highlight]

# Navigation with Alt+arrow (no prefix)
bind -n M-Left  select-pane -L
bind -n M-Right select-pane -R
bind -n M-Up    select-pane -U
bind -n M-Down  select-pane -D

# Mouse enabled
set -g mouse on

# 256 colors
set -g default-terminal "tmux-256color"
```

## 模糊查找器：`fzf`——一切的乘数

`fzf` 能把任何列表变成交互式查找器。只要给任何命令加上 `| fzf` 就行。

```bash
# Search in command history
CTRL+R with integrated fzf

# Checkout branch with preview
git branch | fzf --preview 'git log --oneline {}' | xargs git checkout

# Kill processes
ps aux | fzf --multi | awk '{print $2}' | xargs kill

# Find and open file
fd -e ts | fzf --preview 'bat --color=always {}' | xargs nvim
```

## 现代 Git：`lazygit`

一个把仓库里正在发生什么变得一目了然的 Git TUI（终端界面）：

```bash
lazygit   # opens the interface
```

最出彩的几个特性：

- 按文件、按行查看 diff
- 选择性暂存（能精确到单行，而不只是整个文件）
- 可视化解决冲突
- 支持拖拽的交互式 rebase

## 我优化过的基础 `.zshrc`

```bash file=~/.zshrc
# Fast load with lazy loading
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"

# Modern aliases
alias ls='eza --icons'
alias ll='eza -la --icons --git'
alias tree='eza --tree --icons'
alias cat='bat'
alias find='fd'
alias grep='rg'
alias lg='lazygit'

# fzf integration
source <(fzf --zsh)

# zoxide
eval "$(zoxide init zsh)"

# starship
eval "$(starship init zsh)"
```

> 在终端生产力上，最划算的时间投资不是去学新工具，而是把手上已有的工具用透。不过，当一款现代工具能用更好的开发体验、快上五倍地完成同一件事时，换过去第一周就回本了。
