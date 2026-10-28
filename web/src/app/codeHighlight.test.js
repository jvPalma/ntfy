import { describe, expect, it } from "vitest";
import { highlight, MAX_HIGHLIGHT_LENGTH, resolveLanguage } from "./codeHighlight";

describe("resolveLanguage", () => {
  it.each([
    ["sh", "bash"],
    ["shell", "bash"],
    ["zsh", "bash"],
    ["console", "bash"],
    ["bash", "bash"],
    ["js", "javascript"],
    ["jsx", "javascript"],
    ["ts", "typescript"],
    ["tsx", "typescript"],
    ["typescript", "typescript"],
    ["html", "xml"],
    ["xml", "xml"],
    ["svg", "xml"],
    ["markup", "xml"],
    ["py", "python"],
    ["kt", "kotlin"],
    ["yml", "yaml"],
    ["golang", "go"],
    ["cs", "csharp"],
    ["c++", "cpp"],
    ["md", "markdown"],
    ["json", "json"],
    ["YAML", "yaml"],
  ])("maps %s to %s", (name, expected) => {
    expect(resolveLanguage(name)).toBe(expected);
  });

  it("returns null for unknown or missing names", () => {
    expect(resolveLanguage("brainfuck")).toBeNull();
    expect(resolveLanguage("constructor")).toBeNull();
    expect(resolveLanguage("")).toBeNull();
    expect(resolveLanguage(undefined)).toBeNull();
  });
});

describe("highlight", () => {
  it("wraps tokens in hljs spans", () => {
    const html = highlight("# comment\necho $HOME", "bash");
    expect(html).toContain('<span class="hljs-comment"># comment</span>');
    expect(html).toContain('<span class="hljs-variable">$HOME</span>');
  });

  it("returns null for an unknown language", () => {
    expect(highlight("x", "brainfuck")).toBeNull();
  });

  it("returns null above the size cap", () => {
    expect(highlight("a".repeat(MAX_HIGHLIGHT_LENGTH + 1), "bash")).toBeNull();
    expect(highlight("a".repeat(MAX_HIGHLIGHT_LENGTH), "bash")).not.toBeNull();
  });

  it("escapes HTML in the code", () => {
    const html = highlight('<script>alert(1)</script><img src=x onerror="alert(1)">', "bash");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
  });
});
