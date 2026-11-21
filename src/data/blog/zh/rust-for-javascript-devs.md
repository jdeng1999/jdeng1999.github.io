---
title: "写给 JavaScript 开发者的 Rust：值得迈出的那一步"
description: 如果你来自 JS/TS 世界，又对 Rust 心存畏惧，这篇指南就是为你写的。我们把熟悉的概念逐一映射到 Rust 生态，并配上直接的示例。
pubDatetime: 2026-02-12T10:00:00Z
tags:
  - rust
  - javascript
  - systems
  - webassembly
draft: false
---

Rust 好几年前就进入了 Web 开发者的视野，但采用速度一直不快。2026 年，局势变了：JS 生态里的关键工具都由 Rust 驱动（Biome、Oxc、Rolldown、SWC 编译器），再加上 WebAssembly，它在前端也变得不可或缺。是时候学它了。

## 最大的思维转变：所有权

在 JavaScript 里，内存由垃圾回收器管理。在 Rust 里，这份责任通过**所有权**系统交给了编译器。

```rust file=ownership.rs
// In JS: this works
// let a = [1, 2, 3];
// let b = a; // a is still valid

// In Rust:
fn main() {
    let a = vec![1, 2, 3];
    let b = a;          // a is "moved" to b // [!code highlight]
    println!("{:?}", a); // ✗ ERROR: a was moved
    println!("{:?}", b); // ✓
}
```

解决方案：使用引用进行**借用**。

```rust file=borrowing.rs
fn main() {
    let a = vec![1, 2, 3];
    let b = &a;          // immutable borrow // [!code ++]
    println!("{:?}", a); // ✓ a is still valid
    println!("{:?}", b); // ✓
}

fn print_vec(v: &Vec<i32>) { // receives reference, not ownership // [!code highlight]
    for n in v {
        print!("{} ", n);
    }
}
```

## 类型：从 `any` 到世界上最安全的类型系统

| JavaScript/TypeScript  | 对应的 Rust                      |
| ---------------------- | -------------------------------- |
| `number`               | `i32`、`u32`、`f64`……            |
| `string`               | `String`（堆上）/ `&str`（切片） |
| `T \| null`            | `Option<T>`                      |
| `T \| Error`           | `Result<T, E>`                   |
| `any[]`                | `Vec<T>`                         |
| `{ [key: string]: T }` | `HashMap<String, T>`             |

```rust file=types.rs
fn divide(a: f64, b: f64) -> Option<f64> {
    if b == 0.0 {
        None   // equivalent to null without the billion-dollar mistake
    } else {
        Some(a / b)
    }
}

fn main() {
    match divide(10.0, 0.0) {
        Some(result) => println!("Result: {result}"),
        None => println!("Division by zero"),
    }
}
```

## 错误处理：`Result` 就是 Rust 的 `Promise`

在 JS 里，你用 `try/catch` 或 `Promise` 链来处理错误。在 Rust 里，地道的做法是 `Result<T, E>`：

```rust file=errors.rs
use std::fs;
use std::io;

// Before: without the ? operator
fn read_config_verbose() -> Result<String, io::Error> {
    let content = match fs::read_to_string("config.toml") { // [!code --]
        Ok(c) => c,                                            // [!code --]
        Err(e) => return Err(e),                               // [!code --]
    };                                                         // [!code --]
    Ok(content.to_uppercase())
}

// With the ? operator (equivalent to JS await, but for errors)
fn read_config() -> Result<String, io::Error> {               // [!code ++]
    let content = fs::read_to_string("config.toml")?;       // [!code ++]
    Ok(content.to_uppercase())                               // [!code ++]
}
```

## 闭包与高阶函数

语法不同，但概念完全一样：

```rust file=closures.rs
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];

    // map + filter + collect (like Array.map + filter in JS)
    let double_evens: Vec<i32> = numbers
        .iter()
        .filter(|&&x| x % 2 == 0)  // [!code highlight]
        .map(|&x| x * 2)            // [!code highlight]
        .collect();

    println!("{:?}", double_evens); // [4, 8]
}
```

## Rust → WebAssembly：通往前端的那座桥

```rust file=lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn fibonacci(n: u32) -> u32 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}
```

```bash
# Compile to WASM
wasm-pack build --target web
```

```javascript file=main.js
import init, { fibonacci } from "./pkg/my_project.js";

await init();
console.log(fibonacci(40)); // ~10x faster than pure JS version
```

## 从哪里开始

1. **[The Rust Book](https://doc.rust-lang.org/book/)**——任何语言里最好的官方文档。
2. **Rustlings**——在终端里做互动练习。
3. **[Rust by Example](https://doc.rust-lang.org/rust-by-example/)**——通过真实示例来学。
4. 用 **`wasm-pack`** 做点东西，然后在当前的 Web 项目里用起来。

> 学习曲线确实陡峭，但 Rust 编译器是你所能找到的最好的老师：它的错误信息详尽、准确，而且几乎总会给出解决方案。
