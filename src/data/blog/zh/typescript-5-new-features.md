---
title: "TypeScript 5.x：真正改变你写法的那些特性"
description: "实用视角回顾 TypeScript 5.x 中最具影响力的新特性——装饰器、const 类型参数、可变元组类型等等。"
pubDatetime: 2026-02-15T10:00:00Z
tags:
  - typescript
  - javascript
  - dev
draft: false
featured: true
---

TypeScript 一直在快速演进。5.x 带来的变化不只是性能提升：它们重新定义了我们用了多年的那套写法。

## 标准装饰器（TC39 Stage 3）

终于来了。在实验性版本上耗了这么多年之后，TypeScript 5.0 采纳了 TC39 的**标准装饰器**。语法看着差不多，语义却变了不少。

```typescript file=decorators.ts
// 类装饰器——改造前（实验性）
@sealed
class OldClass { ... }

// 标准装饰器——TS 5.x // [!code highlight]
function logged<T extends new (...args: unknown[]) => unknown>(
  target: T,
  _ctx: ClassDecoratorContext,
) {
  return class extends target {
    constructor(...args: unknown[]) {
      super(...args);
      console.log(`[LOG] Instance of ${target.name} created`);
    }
  };
}

@logged
class UserService {
  constructor(private db: Database) {}
}
```

### 方法与访问器装饰器

```typescript file=method-decorator.ts
function measure(_target: unknown, ctx: ClassMethodDecoratorContext) {
  const name = String(ctx.name);
  return function (this: unknown, ...args: unknown[]) {
    const start = performance.now();
    const result = (this as Record<string, Function>)[name](...args); // [!code --]
    const result = Reflect.apply(
      // [!code ++]
      _target as Function,
      this,
      args // [!code ++]
    ); // [!code ++]
    console.log(`${name} took ${performance.now() - start}ms`);
    return result;
  };
}

class ReportService {
  @measure
  async generatePDF(id: string) {
    /* ... */
  }
}
```

## `const` 类型参数

以前想让调用处推断出字面量元组，每次都得写 `as const`。现在可以直接在泛型上声明：

```typescript file=const-type-params.ts
// 以前：推断为 string[]
function head<T>(arr: T[]) {
  return arr[0];
}
head(["a", "b"]); // 类型：string

// 现在：推断出精确的字面量 // [!code highlight]
function head<const T extends readonly unknown[]>(arr: T) {
  return arr[0];
}
head(["a", "b"] as const); // 类型："a"
head(["a", "b"]); // 类型："a"  ← 不用 as const 也能工作 // [!code ++]
```

## `satisfies` 操作符（再谈）

它 4.9 就引入了，但如今已经是日常工作流的一部分。它让你可以校验某个值满足某个类型，同时又不把类型“拓宽”：

```typescript file=satisfies.ts
type Palette = {
  red: [number, number, number] | string;
  green: [number, number, number] | string;
  blue: [number, number, number] | string;
};

const palette = {
  red: [255, 0, 0],
  green: "#00ff00",
  blue: [0, 0, 255],
} satisfies Palette; // [!code highlight]

// 现在 TypeScript 知道 red 是元组，而不是 string
palette.red.at(0); // ✓ ——以前这里会报错
```

## `infer` 推断的改进

```typescript file=infer-extends.ts
// 提取返回类型，并按约束过滤
type ReturnIfString<T> = T extends () => infer R extends string
  ? R
  : never;

type A = ReturnIfString<() => "hello">; // "hello"
type B = ReturnIfString<() => number>;  // never
```

## 性能：`--incremental` 与 `--composite` 模式

TS 5.x 优化了增量构建。在大型项目里，提升最多可达 **3 倍**：

```json file=tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",
    "moduleResolution": "bundler"
  }
}
```

> **提示：** 在 monorepo 里把 `composite` 和项目引用（`references`）配合使用。每个包只会编译发生变化的部分。

## 快速总结

| 特性                | 版本                | 影响                   |
| ------------------- | ------------------- | ---------------------- |
| 标准装饰器          | 5.0                 | 高——取代实验性版本     |
| `const` 类型参数    | 5.0                 | 中——少写 `as const`    |
| `satisfies`         | 4.9 / 在 5.x 中整合 | 高——类型表达力更强     |
| `infer ... extends` | 5.x                 | 中——条件类型更精确     |
| 增量构建改进        | 5.x                 | 在 monorepo 中影响很大 |
