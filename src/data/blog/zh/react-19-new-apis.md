---
title: "React 19：useActionState、useOptimistic，以及手动 loading 状态的终结"
description: React 19 重新设计了表单、变更操作与过渡状态的处理方式。本文用真实示例带你实用地了解这些新 API。
pubDatetime: 2026-01-28T10:00:00Z
tags:
  - react
  - javascript
  - frontend
  - ux
draft: false
---

React 19 是 Hooks 问世以来最重要的一次更新。它并没有带来激进的全新概念，而是为我们用一千种写法解决过一千遍的问题，给出了最终答案：**表单与变更操作的处理**。

## React 19 要解决的问题

在 React 19 之前，一个带加载反馈、错误处理和乐观更新的表单，需要写成这样：

```tsx file=before.tsx
// Before: 35+ lines for something "basic"
function ProfileForm() {
  const [isPending, setIsPending] = useState(false); // [!code --]
  const [error, setError] = useState<string | null>(null); // [!code --]
  const [success, setSuccess] = useState(false); // [!code --]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // [!code --]
    e.preventDefault(); // [!code --]
    setIsPending(true); // [!code --]
    setError(null); // [!code --]
    try {
      // [!code --]
      const data = new FormData(e.currentTarget); // [!code --]
      await updateProfile(data); // [!code --]
      setSuccess(true); // [!code --]
    } catch (err) {
      // [!code --]
      setError("Error saving"); // [!code --]
    } finally {
      // [!code --]
      setIsPending(false); // [!code --]
    } // [!code --]
  }
  // ...
}
```

## `useActionState`：不用手写 useState 的表单

```tsx file=profile-form.tsx
import { useActionState } from "react"; // [!code ++]

async function updateProfileAction(prevState: State, formData: FormData) {
  try {
    await updateProfile({
      name: formData.get("name") as string,
      bio: formData.get("bio") as string,
    });
    return { success: true, error: null };
  } catch {
    return { success: false, error: "Error saving profile" };
  }
}

function ProfileForm() {
  const [state, action, isPending] = useActionState(
    // [!code highlight]
    updateProfileAction,
    { success: false, error: null }
  );

  return (
    <form action={action}>
      <input name="name" placeholder="Name" />
      <textarea name="bio" placeholder="Biography" />

      {state.error && <p className="error">{state.error}</p>}
      {state.success && <p className="success">Saved!</p>}

      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
```

## `useOptimistic`：即时 UI，自动回滚

乐观更新这种模式（在服务器确认之前就更新 UI）过去相当繁琐。现在：

```tsx file=todo-list.tsx
import { useOptimistic, useActionState } from "react";

function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    // [!code highlight]
    initialTodos,
    (state, newTodo: Todo) => [...state, newTodo]
  );

  async function addTodoAction(_: State, formData: FormData) {
    const title = formData.get("title") as string;

    // Immediate UI update
    addOptimisticTodo({ id: crypto.randomUUID(), title, done: false }); // [!code highlight]

    // Real mutation (the hook reverts if it fails)
    await createTodo(title);
    return { error: null };
  }

  const [state, action, isPending] = useActionState(addTodoAction, {
    error: null,
  });

  return (
    <>
      <ul>
        {optimisticTodos.map(todo => (
          <li
            key={todo.id}
            style={{ opacity: todo.id.startsWith("temp") ? 0.5 : 1 }}
          >
            {todo.title}
          </li>
        ))}
      </ul>
      <form action={action}>
        <input name="title" required />
        <button disabled={isPending}>Add</button>
      </form>
    </>
  );
}
```

## `use()`：有条件地消费 Promise 和 context

```tsx file=user-profile.tsx
import { use, Suspense } from "react";

async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // [!code highlight] — can be used inside conditionals

  return <h1>{user.name}</h1>;
}

// The Suspense boundary caches and resolves the promise
function App() {
  const userPromise = fetchUser("123"); // created outside the component

  return (
    <Suspense fallback={<p>Loading user…</p>}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}
```

## 实战中的 Server Actions

React 19 把 **Server Actions**（标注了 `"use server"`、在服务器上运行的函数）正式纳入规范：

```tsx file=actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function deletePost(id: string) {
  await db.post.delete({ where: { id } });
  revalidatePath("/posts"); // invalidates server cache // [!code highlight]
}
```

```tsx file=post-card.tsx
import { deletePost } from "./actions";

export function PostCard({ post }: { post: Post }) {
  return (
    <article>
      <h2>{post.title}</h2>
      <form action={deletePost.bind(null, post.id)}>
        <button type="submit">Delete</button>
      </form>
    </article>
  );
}
```

## 新 API 一览

| API              | 取代了什么                                  | 适用场景                        |
| ---------------- | ------------------------------------------- | ------------------------------- |
| `useActionState` | 表单里用 `useState` + `useReducer`          | 任何需要 UI 反馈的变更操作      |
| `useOptimistic`  | 手写的回滚逻辑                              | 能提升感知性能的更新            |
| `use(promise)`   | 数据获取时用 `useEffect` + `useState`       | 在渲染中读取 promise 的组件     |
| `use(context)`   | `useContext`                                | 需要有条件地读取 context 时     |
| `ref` as prop    | `forwardRef`                                | 任何时候——省掉多余的包装        |
