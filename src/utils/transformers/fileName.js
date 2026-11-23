/**
 * CustomShiki transformer that adds file name labels to code blocks.
 *
 * This transformer looks for the `file="filename"` meta attribute in code blocks
 * and creates a styled label showing the filename. It supports two different
 * styling options and can optionally hide the green dot indicator.
 *
 * @param {Object} options - Configuration options for the transformer
 * @param {string} [options.style="v2"] - The styling variant to use
 *   - `"v1"`: Tab-style with rounded top corners, positioned at top-left
 *   - `"v2"`: Badge-style with border, positioned at top-left with offset
 * @param {boolean} [options.hideDot=false] - Whether to hide the green dot indicator
 */
export const transformerFileName = ({
  style = "v2",
  hideDot = false,
} = {}) => ({
  pre(node) {
    // Add CSS custom property to the node
    const fileNameOffset = style === "v1" ? "0.75rem" : "-0.75rem";
    node.properties.style =
      (node.properties.style || "") + `--file-name-offset: ${fileNameOffset};`;

    const raw = this.options.meta?.__raw?.split(" ");

    if (!raw) return;

    const metaMap = new Map();

    for (const item of raw) {
      const [key, value] = item.split("=");
      if (!key || !value) continue;
      metaMap.set(key, value.replace(/["'`]/g, ""));
    }

    const file = metaMap.get("file");

    if (!file) return;

    // Add additional margin to code block
    this.addClassToHast(
      node,
      `mt-8 ${style === "v1" ? "rounded-tl-none" : ""}`
    );

    // Add file name to code block. The outer span handles positioning and
    // line breaking; the chip carries the translucent label surface.
    node.children.push({
      type: "element",
      tagName: "span",
      properties: {
        class: [
          "code-file-name absolute text-foreground text-xs font-medium leading-4",
          style === "v1" ? "left-0 -top-6" : "left-2 top-(--file-name-offset)",
        ],
      },
      children: [
        {
          type: "element",
          tagName: "span",
          properties: {
            class: [
              "code-file-name-chip inline-flex items-center rounded-md py-1",
              hideDot ? "px-2" : "pl-4 pr-2",
              hideDot ? "code-file-name-chip--plain" : "",
            ],
          },
          children: [
            {
              type: "text",
              value: file,
            },
          ],
        },
      ],
    });
  },
});
