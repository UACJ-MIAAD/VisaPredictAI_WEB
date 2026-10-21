import katex from "katex";
import { describe, expect, it } from "vitest";

describe("KaTeX trust boundary", () => {
  it("does not inherit trust from a polluted options prototype", () => {
    const options = { throwOnError: false, output: "html" as const };
    Object.setPrototypeOf(options, { trust: true });
    const html = katex.renderToString(String.raw`\href{javascript:alert(1)}{demo}`, options);
    expect(html).not.toContain('href="javascript:');
    expect(Object.hasOwn(options, "trust")).toBe(false);
  });

  it("still renders an explicitly trusted ordinary link", () => {
    const html = katex.renderToString(String.raw`\href{https://example.com/}{demo}`, {
      throwOnError: false,
      output: "html",
      trust: true,
    });
    expect(html).toContain('href="https://example.com/"');
  });

  it("renders the mathematical notation used by the project", () => {
    for (const expression of [String.raw`\hat{y}_{t+h}`, String.raw`\frac{1}{n}\sum_{i=1}^{n}|y_i-\hat y_i|`]) {
      const html = katex.renderToString(expression, { throwOnError: false, output: "html" });
      expect(html).toContain('class="katex"');
      expect(html).not.toContain("katex-error");
    }
  });
});
