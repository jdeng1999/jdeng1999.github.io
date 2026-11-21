---
title: "2026 年的现代 CSS：容器查询、:has() 与锚点定位"
description: 面对复杂布局，如今的 CSS 已经完全不输 JavaScript。本文是三大彻底改变界面开发方式的特性实用指南。
pubDatetime: 2026-02-03T10:00:00Z
tags:
  - css
  - frontend
  - design
  - web
draft: false
---

多年来，面对“CSS 里这个该怎么做？”这个问题，答案往往是“用 JavaScript”。到了 2026 年，大多数情况下这个答案已经不成立了。尤其是三个特性，重新绘制了浏览器里的设计版图。

## 容器查询：响应容器，而不是屏幕

媒体查询响应的是 _视口_ 宽度。问题在于：一个组件可能身处窄栏，也可能身处宽栏，取决于父级布局。**容器查询**正是为此而生。

```css file=card.css
/* Declare the container */
.card-wrapper {
  container-type: inline-size; /* [!code highlight] */
  container-name: card;
}

/* The component responds to its container */
@container card (min-width: 400px) {
  /* [!code highlight] */
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }

  .card__image {
    grid-row: 1 / 3;
  }
}

@container card (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```

```html file=card.html
<!-- The same component works in any context -->
<aside class="card-wrapper" style="width: 300px">
  <article class="card">...</article>
  <!-- vertical layout -->
</aside>

<main class="card-wrapper" style="width: 700px">
  <article class="card">...</article>
  <!-- horizontal layout -->
</main>
```

### 容器查询单位

查询还会暴露相对于容器的单位：

```css file=typography.css
.card__title {
  font-size: clamp(1rem, 4cqi, 2rem); /* cqi = container query inline size */
}
```

## `:has()` 伪类——我们一直想要的父选择器

`:has()` 依据**后代元素**来选择元素。它就是 CSS 拒绝了几十年的那个“父选择器”。

```css file=styles.css
/* Form with empty required field */
form:has(input:required:invalid) .submit-btn {
  opacity: 0.5;
  pointer-events: none;
}

/* Card containing an image: different layout */
.card:has(img) {
  /* [!code highlight] */
  display: grid;
  grid-template-columns: 150px 1fr;
}

.card:not(:has(img)) {
  padding: 1.5rem;
}

/* Navbar with open menu: disable scroll on body */
body:has(.nav-menu[aria-expanded="true"]) {
  /* [!code highlight] */
  overflow: hidden;
}
```

> 自 2023 年起，所有现代浏览器都已支持 `:has()`。今天你就可以在生产环境中直接使用它，无需任何 polyfill。

## 锚点定位：不用 JavaScript 也能做提示框和浮层

在锚点定位出现之前，想让提示框相对于它的触发元素摆放，必须用 JavaScript 计算位置。现在不必了：

```css file=tooltip.css
/* Declare the anchor */
.btn-trigger {
  anchor-name: --my-button; /* [!code highlight] */
}

/* Position the tooltip relative to the anchor */
.tooltip {
  position: absolute;
  position-anchor: --my-button; /* [!code highlight] */
  bottom: calc(anchor(top) + 8px); /* [!code highlight] */
  left: anchor(center); /* [!code highlight] */
  transform: translateX(-50%);

  /* Flip automatically if it doesn't fit */
  position-try-fallbacks: flip-block; /* [!code ++] */
}
```

```html file=tooltip.html
<button class="btn-trigger" popovertarget="tip">Hover me</button>
<div id="tip" class="tooltip" popover>
  This tooltip positions itself, without JS.
</div>
```

### `position-try-fallbacks`：声明式的碰撞逻辑

```css file=tooltip.css
.tooltip {
  position-try-fallbacks:
    flip-block,
    /* try top if it doesn't fit below */ flip-inline,
    /* try left if it doesn't fit right */ flip-start; /* combine both */
}
```

## 兼容性怎么样？

| 特性              | Chrome | Firefox | Safari  |
| ----------------- | ------ | ------- | ------- |
| 容器查询          | 105+ ✓ | 110+ ✓  | 16+ ✓   |
| `:has()`          | 105+ ✓ | 121+ ✓  | 15.4+ ✓ |
| 锚点定位          | 125+ ✓ | 131+ ✓  | 18+ ✓   |

在 2026 年，以当前的浏览器分布来看，大多数项目都可以在生产环境中使用这三项特性。只有当你的用户群体里还有非常老的浏览器时，才需要把 polyfill 纳入考虑。

## 今天的 CSS 既声明式，又富有表现力

CSS 的这场静悄悄的革命，并不是 Grid 或 Flexbox 带来的。它来自思维方式的转变：**由浏览器去推理约束条件，你只负责声明想要的结果**。容器查询、`:has()` 与锚点定位，正是这一范式的集大成之作。
