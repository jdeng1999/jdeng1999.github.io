/**
 * code-copy.ts
 *
 * Attaches interactive copy-to-clipboard buttons to markdown code fences
 * and deep anchor links to article section headings.
 */

export function addHeadingLinks() {
  const headings = Array.from(
    document.querySelectorAll<HTMLElement>("h2, h3, h4, h5, h6")
  );
  for (const heading of headings) {
    if (heading.querySelector(".heading-link")) continue;

    heading.classList.add("group");
    const link = document.createElement("a");
    link.className =
      "heading-link ms-2 no-underline opacity-75 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100";
    link.href = "#" + heading.id;

    const span = document.createElement("span");
    span.ariaHidden = "true";
    span.innerText = "#";
    link.appendChild(span);
    link.ariaLabel = "link to heading";
    heading.appendChild(link);
  }
}

/**
 * Wheel/trackpad scrolling over a code block is eased toward the target
 * position instead of jumping with the raw wheel delta. Touch scrolling
 * keeps the browser's native momentum, so only wheel input is damped.
 */
function attachDampedHorizontalScroll(codeBlock: HTMLPreElement) {
  if (codeBlock.dataset.dampedScroll === "true") return;
  codeBlock.dataset.dampedScroll = "true";

  let target = codeBlock.scrollLeft;
  let frame = 0;

  const maxScroll = () =>
    Math.max(0, codeBlock.scrollWidth - codeBlock.clientWidth);

  const tick = () => {
    const max = maxScroll();
    target = Math.max(0, Math.min(max, target));
    const diff = target - codeBlock.scrollLeft;

    if (Math.abs(diff) < 0.5) {
      codeBlock.scrollLeft = target;
      frame = 0;
      return;
    }

    codeBlock.scrollLeft += diff * 0.16;
    frame = requestAnimationFrame(tick);
  };

  codeBlock.addEventListener(
    "wheel",
    event => {
      if (maxScroll() < 1) return;

      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (!horizontal && !event.shiftKey) return;

      event.preventDefault();
      if (!frame) target = codeBlock.scrollLeft;

      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? codeBlock.clientWidth
            : 1;
      const delta = (horizontal ? event.deltaX : event.deltaY) * unit;
      target += delta;

      if (!frame) frame = requestAnimationFrame(tick);
    },
    { passive: false }
  );
}

/**
 * Adds a quiet, non-selectable line-number gutter to Shiki code blocks.
 * Numbers are stripped again when copying so code output stays clean.
 */
function addLineNumbers(codeBlock: HTMLPreElement) {
  if (codeBlock.dataset.lineNumbers === "true") return;

  const lines = Array.from(
    codeBlock.querySelectorAll<HTMLElement>("code > .line")
  );
  if (lines.length === 0) return;

  codeBlock.dataset.lineNumbers = "true";
  const digits = String(lines.length).length;
  codeBlock.style.setProperty("--ln-digits", String(Math.max(2, digits)));

  lines.forEach((line, index) => {
    const number = document.createElement("span");
    number.className = "line-number";
    number.textContent = String(index + 1);
    number.setAttribute("aria-hidden", "true");
    line.prepend(number);
  });
}

export function attachCopyButtons() {
  const lang = document.documentElement.lang || "en";
  const copyLabel = lang.startsWith("zh")
    ? "复制代码"
    : lang.startsWith("es")
      ? "Copiar código"
      : "Copy code";
  const copiedLabel = lang.startsWith("zh")
    ? "已复制"
    : lang.startsWith("es")
      ? "Copiado"
      : "Copied";

  const copyIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
  // Shifted 0.5px down inside the viewBox so its ink bounds are symmetric.
  const checkIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6.5 9 17.5 4 12.5"></path></svg>`;

  const codeBlocks = Array.from(
    document.querySelectorAll<HTMLPreElement>("pre")
  );
  codeBlocks.forEach(attachDampedHorizontalScroll);
  codeBlocks.forEach(addLineNumbers);

  const unattachedCodeBlocks = codeBlocks.filter(
    cb => !cb.querySelector(".copy-code")
  );
  if (unattachedCodeBlocks.length === 0) return;

  // Pass 1: read all computed styles before touching DOM to avoid reflows
  const topClasses = unattachedCodeBlocks.map(cb =>
    getComputedStyle(cb).getPropertyValue("--file-name-offset").trim() !== ""
      ? "top-(--file-name-offset)"
      : "-top-3"
  );

  // Pass 2: mutate DOM
  unattachedCodeBlocks.forEach((codeBlock, i) => {
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";

    const copyButton = document.createElement("button");
    copyButton.className = `copy-code absolute end-3 ${topClasses[i]} inline-flex size-7 items-center justify-center rounded-md cursor-pointer`;
    copyButton.innerHTML = copyIcon;
    copyButton.setAttribute("aria-label", copyLabel);
    copyButton.setAttribute("type", "button");

    const fileName = codeBlock.querySelector<HTMLElement>(
      ":scope > span.absolute"
    );
    fileName?.classList.add("code-file-name");

    codeBlock.setAttribute("tabindex", "0");
    codeBlock.appendChild(copyButton);

    codeBlock.parentNode?.insertBefore(wrapper, codeBlock);
    wrapper.appendChild(codeBlock);

    copyButton.addEventListener("click", async () => {
      const code = codeBlock.querySelector("code");
      const lines = code?.querySelectorAll<HTMLElement>(":scope > .line");
      const text = lines?.length
        ? Array.from(lines)
            .map(line => {
              const clone = line.cloneNode(true) as HTMLElement;
              clone.querySelector(".line-number")?.remove();
              return clone.textContent ?? "";
            })
            .join("\n")
        : code?.innerText;

      await navigator.clipboard.writeText(text ?? "");

      copyButton.innerHTML = checkIcon;
      copyButton.setAttribute("aria-label", copiedLabel);
      copyButton.dataset.copied = "true";
      setTimeout(() => {
        copyButton.innerHTML = copyIcon;
        copyButton.setAttribute("aria-label", copyLabel);
        delete copyButton.dataset.copied;
      }, 1500);
    });
  });
}
